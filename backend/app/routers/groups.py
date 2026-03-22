import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.group import Group, GroupJoinRequest, GroupMember
from app.models.notification import Notification
from app.models.user import User
from app.schemas.group import (
    GroupCreate,
    GroupMemberResponse,
    GroupResponse,
    GroupUpdate,
    JoinRequestCreate,
    JoinRequestResponse,
)

router = APIRouter(prefix="/api/groups", tags=["groups"])


async def _create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    message: str,
    type: str,
    link: str | None = None,
):
    notif = Notification(user_id=user_id, title=title, message=message, type=type, link=link)
    db.add(notif)
    # Also send via Telegram
    try:
        from app.telegram.notifications import notify_user
        await notify_user(str(user_id), f"{title}\n{message}")
    except Exception:
        pass


async def _group_response(db: AsyncSession, group: Group) -> GroupResponse:
    count_result = await db.execute(
        select(func.count()).where(GroupMember.group_id == group.id)
    )
    member_count = count_result.scalar() or 0
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        member_count=member_count,
        created_at=group.created_at,
    )


@router.get("", response_model=list[GroupResponse])
async def list_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Group).order_by(Group.name))
    groups = result.scalars().all()
    return [await _group_response(db, g) for g in groups]


@router.get("/my", response_model=list[GroupResponse])
async def my_groups(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Group).join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == current_user.id)
        .order_by(Group.name)
    )
    groups = result.scalars().all()
    return [await _group_response(db, g) for g in groups]


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Group).where(Group.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Gruppenname existiert bereits")
    group = Group(name=data.name, description=data.description, created_by=current_user.id)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return await _group_response(db, group)


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: uuid.UUID,
    data: GroupUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    if data.name is not None:
        group.name = data.name
    if data.description is not None:
        group.description = data.description
    await db.commit()
    await db.refresh(group)
    return await _group_response(db, group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    await db.delete(group)
    await db.commit()


@router.get("/{group_id}/members", response_model=list[GroupMemberResponse])
async def list_members(
    group_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id)
    )
    members = result.scalars().all()
    responses = []
    for m in members:
        user = await db.get(User, m.user_id)
        if user:
            responses.append(GroupMemberResponse(
                id=m.id, user_id=m.user_id, username=user.username,
                full_name=user.full_name, email=user.email, role=m.role,
                joined_at=m.created_at,
            ))
    return responses


@router.post("/{group_id}/members", response_model=GroupMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: uuid.UUID,
    data: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")

    user_id = data.get("user_id")
    role = data.get("role", "member")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id erforderlich")

    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")

    existing = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Benutzer ist bereits Mitglied")

    member = GroupMember(group_id=group_id, user_id=user.id, role=role)
    db.add(member)
    await _create_notification(
        db, user.id,
        "Gruppe beigetreten",
        f'Du wurdest zur Gruppe "{group.name}" hinzugefuegt.',
        "group_added",
        "/groups",
    )
    await db.commit()
    await db.refresh(member)
    return GroupMemberResponse(
        id=member.id, user_id=user.id, username=user.username,
        full_name=user.full_name, email=user.email, role=member.role,
        joined_at=member.created_at,
    )


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")
    result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Mitglied nicht gefunden")

    await _create_notification(
        db, user_id,
        "Aus Gruppe entfernt",
        f'Du wurdest aus der Gruppe "{group.name}" entfernt.',
        "group_removed",
        "/groups",
    )
    await db.delete(member)
    await db.commit()


# ── Join Requests ────────────────────────────────────────────────────────────

@router.post("/{group_id}/join", status_code=status.HTTP_201_CREATED)
async def request_join(
    group_id: uuid.UUID,
    data: JoinRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")

    # Already a member?
    existing_member = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id)
    )
    if existing_member.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Du bist bereits Mitglied")

    # Already pending?
    existing_req = await db.execute(
        select(GroupJoinRequest).where(
            GroupJoinRequest.group_id == group_id,
            GroupJoinRequest.user_id == current_user.id,
            GroupJoinRequest.status == "pending",
        )
    )
    if existing_req.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Anfrage bereits gestellt")

    req = GroupJoinRequest(
        group_id=group_id, user_id=current_user.id,
        message=data.message, status="pending",
    )
    db.add(req)

    # Notify all admins
    admin_result = await db.execute(select(User).where(User.role == "admin"))
    for admin in admin_result.scalars().all():
        await _create_notification(
            db, admin.id,
            "Beitrittsanfrage",
            f'{current_user.username} moechte der Gruppe "{group.name}" beitreten.',
            "join_request",
            "/groups",
        )

    await db.commit()
    return {"status": "pending"}


@router.get("/{group_id}/requests", response_model=list[JoinRequestResponse])
async def list_requests(
    group_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GroupJoinRequest).where(
            GroupJoinRequest.group_id == group_id,
            GroupJoinRequest.status == "pending",
        )
    )
    requests = result.scalars().all()
    responses = []
    for r in requests:
        user = await db.get(User, r.user_id)
        group = await db.get(Group, r.group_id)
        if user and group:
            responses.append(JoinRequestResponse(
                id=r.id, group_id=r.group_id, group_name=group.name,
                user_id=r.user_id, username=user.username,
                status=r.status, message=r.message, created_at=r.created_at,
            ))
    return responses


@router.post("/{group_id}/requests/{request_id}/approve")
async def approve_request(
    group_id: uuid.UUID,
    request_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    req = await db.get(GroupJoinRequest, request_id)
    if not req or req.group_id != group_id or req.status != "pending":
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")

    group = await db.get(Group, group_id)
    req.status = "approved"
    req.reviewed_by = current_user.id

    member = GroupMember(group_id=group_id, user_id=req.user_id, role="member")
    db.add(member)

    await _create_notification(
        db, req.user_id,
        "Beitrittsanfrage genehmigt",
        f'Deine Anfrage fuer die Gruppe "{group.name}" wurde genehmigt.',
        "join_approved",
        "/groups",
    )
    await db.commit()
    return {"status": "approved"}


@router.post("/{group_id}/requests/{request_id}/deny")
async def deny_request(
    group_id: uuid.UUID,
    request_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    req = await db.get(GroupJoinRequest, request_id)
    if not req or req.group_id != group_id or req.status != "pending":
        raise HTTPException(status_code=404, detail="Anfrage nicht gefunden")

    group = await db.get(Group, group_id)
    req.status = "denied"
    req.reviewed_by = current_user.id

    await _create_notification(
        db, req.user_id,
        "Beitrittsanfrage abgelehnt",
        f'Deine Anfrage fuer die Gruppe "{group.name}" wurde abgelehnt.',
        "join_denied",
        "/groups",
    )
    await db.commit()
    return {"status": "denied"}
