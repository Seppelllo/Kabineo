import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.folder import Folder
from app.models.folder_permission import FolderPermission
from app.models.group import Group
from app.models.user import User

router = APIRouter(prefix="/api/folders", tags=["folder-permissions"])


class PermissionGrant(BaseModel):
    user_id: uuid.UUID | None = None
    group_id: uuid.UUID | None = None
    permission: str = "read"  # "read", "write", "admin"


class PermissionResponse(BaseModel):
    id: uuid.UUID
    folder_id: uuid.UUID
    user_id: uuid.UUID | None = None
    group_id: uuid.UUID | None = None
    username: str | None = None
    email: str | None = None
    group_name: str | None = None
    permission: str
    granted_by: uuid.UUID | None = None

    model_config = {"from_attributes": True}


@router.get("/{folder_id}/permissions", response_model=list[PermissionResponse])
async def list_folder_permissions(
    folder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await db.get(Folder, folder_id)
    if not folder or folder.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Folder not found")

    result = await db.execute(
        select(FolderPermission).where(FolderPermission.folder_id == folder_id)
    )
    perms = list(result.scalars().all())

    responses = []
    for p in perms:
        username = email = group_name = None
        if p.user_id:
            user = await db.get(User, p.user_id)
            if user:
                username = user.username
                email = user.email
        if p.group_id:
            group = await db.get(Group, p.group_id)
            if group:
                group_name = group.name
        responses.append(PermissionResponse(
            id=p.id, folder_id=p.folder_id, user_id=p.user_id,
            group_id=p.group_id, username=username, email=email,
            group_name=group_name, permission=p.permission,
            granted_by=p.granted_by,
        ))
    return responses


@router.post("/{folder_id}/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
async def grant_folder_permission(
    folder_id: uuid.UUID,
    data: PermissionGrant,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await db.get(Folder, folder_id)
    if not folder or folder.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Folder not found")

    if data.permission not in ("read", "write", "admin"):
        raise HTTPException(status_code=400, detail="Permission must be 'read', 'write', or 'admin'")

    if not data.user_id and not data.group_id:
        raise HTTPException(status_code=400, detail="user_id or group_id required")

    if data.group_id:
        # Group permission
        existing = await db.execute(
            select(FolderPermission).where(
                FolderPermission.folder_id == folder_id,
                FolderPermission.group_id == data.group_id,
            )
        )
        perm = existing.scalar_one_or_none()
        if perm:
            perm.permission = data.permission
        else:
            perm = FolderPermission(
                folder_id=folder_id, group_id=data.group_id,
                permission=data.permission, granted_by=current_user.id,
            )
            db.add(perm)
    else:
        # User permission
        existing = await db.execute(
            select(FolderPermission).where(
                FolderPermission.folder_id == folder_id,
                FolderPermission.user_id == data.user_id,
            )
        )
        perm = existing.scalar_one_or_none()
        if perm:
            perm.permission = data.permission
        else:
            perm = FolderPermission(
                folder_id=folder_id, user_id=data.user_id,
                permission=data.permission, granted_by=current_user.id,
            )
            db.add(perm)

    await db.commit()
    await db.refresh(perm)

    username = email = group_name = None
    if perm.user_id:
        user = await db.get(User, perm.user_id)
        if user:
            username = user.username
            email = user.email
    if perm.group_id:
        group = await db.get(Group, perm.group_id)
        if group:
            group_name = group.name

    return PermissionResponse(
        id=perm.id, folder_id=perm.folder_id, user_id=perm.user_id,
        group_id=perm.group_id, username=username, email=email,
        group_name=group_name, permission=perm.permission,
        granted_by=perm.granted_by,
    )


@router.delete("/{folder_id}/permissions/{perm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_folder_permission(
    folder_id: uuid.UUID,
    perm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await db.get(Folder, folder_id)
    if not folder or folder.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Try by permission id first
    perm = await db.get(FolderPermission, perm_id)
    if not perm or perm.folder_id != folder_id:
        # Fallback: try as user_id for backward compatibility
        result = await db.execute(
            select(FolderPermission).where(
                FolderPermission.folder_id == folder_id,
                FolderPermission.user_id == perm_id,
            )
        )
        perm = result.scalar_one_or_none()
    if not perm:
        raise HTTPException(status_code=404, detail="Permission not found")

    await db.delete(perm)
    await db.commit()
