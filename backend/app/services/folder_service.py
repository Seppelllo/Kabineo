import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.folder import Folder


async def create_folder(
    db: AsyncSession, name: str, owner_id: uuid.UUID, parent_id: uuid.UUID | None = None
) -> Folder:
    folder = Folder(name=name, owner_id=owner_id, parent_id=parent_id)
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return folder


async def get_folders(
    db: AsyncSession, owner_id: uuid.UUID | None, parent_id: uuid.UUID | None = None
) -> list[Folder]:
    query = select(Folder)
    if owner_id is not None:
        query = query.where(Folder.owner_id == owner_id)
    if parent_id is None:
        query = query.where(Folder.parent_id.is_(None))
    else:
        query = query.where(Folder.parent_id == parent_id)
    query = query.order_by(Folder.name)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_folder(db: AsyncSession, folder_id: uuid.UUID) -> Folder | None:
    result = await db.execute(select(Folder).where(Folder.id == folder_id))
    return result.scalar_one_or_none()


async def get_breadcrumb(db: AsyncSession, folder_id: uuid.UUID) -> list[Folder]:
    breadcrumb = []
    current_id = folder_id
    while current_id:
        folder = await get_folder(db, current_id)
        if not folder:
            break
        breadcrumb.insert(0, folder)
        current_id = folder.parent_id
    return breadcrumb


async def update_folder(
    db: AsyncSession, folder: Folder, name: str | None = None, parent_id: uuid.UUID | None = None
) -> Folder:
    if name is not None:
        folder.name = name
    if parent_id is not None:
        folder.parent_id = parent_id
    await db.commit()
    await db.refresh(folder)
    return folder


async def delete_folder(db: AsyncSession, folder: Folder) -> None:
    await db.delete(folder)
    await db.commit()
