import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.correspondent import Correspondent
from app.models.user import User
from app.schemas.correspondent import CorrespondentCreate, CorrespondentResponse, CorrespondentUpdate

router = APIRouter(prefix="/api/correspondents", tags=["correspondents"])


@router.get("", response_model=list[CorrespondentResponse])
async def list_correspondents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Correspondent)
        .where(Correspondent.owner_id == current_user.id)
        .order_by(Correspondent.name)
    )
    return list(result.scalars().all())


@router.post("", response_model=CorrespondentResponse, status_code=status.HTTP_201_CREATED)
async def create_correspondent(
    data: CorrespondentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Correspondent).where(
            Correspondent.name == data.name,
            Correspondent.owner_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Correspondent already exists")
    correspondent = Correspondent(
        name=data.name,
        match_pattern=data.match_pattern,
        owner_id=current_user.id,
    )
    db.add(correspondent)
    await db.commit()
    await db.refresh(correspondent)
    return correspondent


@router.put("/{correspondent_id}", response_model=CorrespondentResponse)
async def update_correspondent(
    correspondent_id: uuid.UUID,
    data: CorrespondentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Correspondent).where(
            Correspondent.id == correspondent_id,
            Correspondent.owner_id == current_user.id,
        )
    )
    correspondent = result.scalar_one_or_none()
    if not correspondent:
        raise HTTPException(status_code=404, detail="Correspondent not found")
    if data.name is not None:
        correspondent.name = data.name
    if data.match_pattern is not None:
        correspondent.match_pattern = data.match_pattern
    await db.commit()
    await db.refresh(correspondent)
    return correspondent


@router.delete("/{correspondent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_correspondent(
    correspondent_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Correspondent).where(
            Correspondent.id == correspondent_id,
            Correspondent.owner_id == current_user.id,
        )
    )
    correspondent = result.scalar_one_or_none()
    if not correspondent:
        raise HTTPException(status_code=404, detail="Correspondent not found")
    await db.delete(correspondent)
    await db.commit()
