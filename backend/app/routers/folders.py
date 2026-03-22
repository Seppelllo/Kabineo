import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.folder import FolderCreate, FolderDetailResponse, FolderResponse, FolderUpdate
from app.services import folder_service

router = APIRouter(prefix="/api/folders", tags=["folders"])


@router.get("", response_model=list[FolderResponse])
async def list_folders(
    parent_id: uuid.UUID | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    owner_filter = None if current_user.role == "admin" else current_user.id
    return await folder_service.get_folders(db, owner_filter, parent_id)


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    data: FolderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await folder_service.create_folder(db, data.name, current_user.id, data.parent_id)


@router.get("/{folder_id}", response_model=FolderDetailResponse)
async def get_folder(
    folder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await folder_service.get_folder(db, folder_id)
    if not folder or folder.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Folder not found")

    owner_filter = None if current_user.role == "admin" else current_user.id
    children = await folder_service.get_folders(db, owner_filter, folder_id)
    return FolderDetailResponse(
        id=folder.id,
        name=folder.name,
        parent_id=folder.parent_id,
        owner_id=folder.owner_id,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
        children=children,
    )


@router.get("/{folder_id}/breadcrumb", response_model=list[FolderResponse])
async def get_breadcrumb(
    folder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    breadcrumb = await folder_service.get_breadcrumb(db, folder_id)
    for folder in breadcrumb:
        if folder.owner_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=404, detail="Folder not found")
    return breadcrumb


@router.put("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: uuid.UUID,
    data: FolderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await folder_service.get_folder(db, folder_id)
    if not folder or folder.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Folder not found")
    return await folder_service.update_folder(db, folder, data.name, data.parent_id)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    folder = await folder_service.get_folder(db, folder_id)
    if not folder or folder.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=404, detail="Folder not found")
    await folder_service.delete_folder(db, folder)
