import hashlib
import uuid
from datetime import date, datetime, timezone
from typing import BinaryIO

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document
from app.models.tag import Tag, document_tags
from app.models.version import DocumentVersion
from app.storage import storage


async def _compute_checksum(file_data: BinaryIO) -> str:
    """Compute SHA256 checksum of file data and reset position."""
    sha256 = hashlib.sha256()
    file_data.seek(0)
    while True:
        chunk = file_data.read(8192)
        if not chunk:
            break
        sha256.update(chunk)
    file_data.seek(0)
    return sha256.hexdigest()


async def check_duplicate(db: AsyncSession, checksum: str, owner_id: uuid.UUID) -> Document | None:
    """Check if a document with the same checksum already exists for this owner."""
    result = await db.execute(
        select(Document).where(
            Document.checksum == checksum,
            Document.owner_id == owner_id,
            Document.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def upload_document(
    db: AsyncSession,
    owner_id: uuid.UUID,
    file_data: BinaryIO,
    filename: str,
    mime_type: str,
    file_size: int,
    title: str | None = None,
    description: str | None = None,
    folder_id: uuid.UUID | None = None,
    tag_ids: list[uuid.UUID] | None = None,
) -> Document:
    doc_id = uuid.uuid4()
    storage_key = f"{owner_id}/{doc_id}/v1/{filename}"

    # Compute checksum for duplicate detection
    checksum = await _compute_checksum(file_data)
    duplicate = await check_duplicate(db, checksum, owner_id)

    await storage.put(storage_key, file_data, mime_type)

    doc = Document(
        id=doc_id,
        title=title or filename,
        description=description,
        filename=filename,
        mime_type=mime_type,
        file_size=file_size,
        storage_key=storage_key,
        folder_id=folder_id,
        owner_id=owner_id,
        checksum=checksum,
    )
    # Store duplicate info for response
    doc._duplicate_of = duplicate
    db.add(doc)

    version = DocumentVersion(
        document_id=doc_id,
        version_number=1,
        storage_key=storage_key,
        file_size=file_size,
        uploaded_by=owner_id,
        comment="Initial upload",
    )
    db.add(version)

    if tag_ids:
        result = await db.execute(select(Tag).where(Tag.id.in_(tag_ids)))
        tags = result.scalars().all()
        doc.tags = list(tags)

    await db.commit()
    await db.refresh(doc)
    return doc


async def get_documents(
    db: AsyncSession,
    owner_id: uuid.UUID | None = None,
    folder_id: uuid.UUID | None = None,
    root_only: bool = False,
    favorites_only: bool = False,
    trash: bool = False,
    mime_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Document], int]:
    from app.models.document_share import DocumentShare

    query = select(Document).options(selectinload(Document.tags))

    if owner_id:
        from app.models.folder_permission import FolderPermission
        from app.models.group import GroupMember

        # Subquery: folders shared with user directly
        user_shared_folders = select(FolderPermission.folder_id).where(
            FolderPermission.user_id == owner_id
        )
        # Subquery: folders shared with groups the user is a member of
        group_shared_folders = (
            select(FolderPermission.folder_id)
            .join(GroupMember, GroupMember.group_id == FolderPermission.group_id)
            .where(GroupMember.user_id == owner_id)
        )

        query = query.where(
            (Document.owner_id == owner_id) |
            Document.id.in_(
                select(DocumentShare.document_id).where(
                    (DocumentShare.shared_with_id == owner_id) |
                    (DocumentShare.shared_with_id.is_(None))
                )
            ) |
            Document.folder_id.in_(user_shared_folders) |
            Document.folder_id.in_(group_shared_folders)
        )

    # Trash vs active
    if trash:
        query = query.where(Document.deleted_at.isnot(None))
    else:
        query = query.where(Document.deleted_at.is_(None))

    if folder_id is not None:
        query = query.where(Document.folder_id == folder_id)
    elif root_only and not trash:
        query = query.where(Document.folder_id.is_(None))

    if favorites_only:
        query = query.where(Document.is_favorite == True)
    if mime_type:
        safe_mime = mime_type.replace("%", r"\%").replace("_", r"\_")
        query = query.where(Document.mime_type.ilike(f"%{safe_mime}%", escape="\\"))
    if date_from:
        query = query.where(Document.created_at >= date_from)
    if date_to:
        query = query.where(Document.created_at <= date_to)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(Document.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    documents = result.scalars().all()
    return list(documents), total


async def get_document(db: AsyncSession, doc_id: uuid.UUID) -> Document | None:
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.tags), selectinload(Document.versions), selectinload(Document.comments))
        .where(Document.id == doc_id)
    )
    return result.scalar_one_or_none()


async def update_document(
    db: AsyncSession,
    doc: Document,
    title: str | None = None,
    description: str | None = None,
    folder_id: uuid.UUID | str | None = None,
    clear_folder: bool = False,
    tag_ids: list[uuid.UUID] | None = None,
    metadata: dict | None = None,
    is_favorite: bool | None = None,
    correspondent_id: uuid.UUID | None = None,
    document_type_id: uuid.UUID | None = None,
    document_date: date | None = None,
    archive_serial_number: str | None = None,
    retention_date: date | None = None,
) -> Document:
    if title is not None:
        doc.title = title
    if description is not None:
        doc.description = description
    if clear_folder:
        doc.folder_id = None
    elif folder_id is not None and folder_id != "CLEAR":
        doc.folder_id = folder_id
    if metadata is not None:
        doc.custom_metadata = metadata
    if is_favorite is not None:
        doc.is_favorite = is_favorite
    if tag_ids is not None:
        result = await db.execute(select(Tag).where(Tag.id.in_(tag_ids)))
        doc.tags = list(result.scalars().all())
    if correspondent_id is not None:
        doc.correspondent_id = correspondent_id
    if document_type_id is not None:
        doc.document_type_id = document_type_id
    if document_date is not None:
        doc.document_date = document_date
    if archive_serial_number is not None:
        doc.archive_serial_number = archive_serial_number
    if retention_date is not None:
        doc.retention_date = retention_date

    await db.commit()
    await db.refresh(doc)
    return doc


async def soft_delete_document(db: AsyncSession, doc: Document) -> None:
    doc.deleted_at = datetime.now(timezone.utc)
    await db.commit()


async def restore_document(db: AsyncSession, doc: Document) -> None:
    doc.deleted_at = None
    await db.commit()


async def permanent_delete_document(db: AsyncSession, doc: Document) -> None:
    for key in {doc.storage_key, doc.thumbnail_key, *(v.storage_key for v in doc.versions)}:
        if key:
            try:
                await storage.delete(key)
            except Exception:
                pass
    await db.delete(doc)
    await db.commit()


async def download_document(doc: Document) -> bytes:
    if not await storage.exists(doc.storage_key):
        raise FileNotFoundError(f"File not found: {doc.storage_key}")
    return await storage.get(doc.storage_key)
