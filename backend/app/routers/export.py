import io
import json
import uuid
import zipfile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.document import Document
from app.models.user import User
from app.storage import storage

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("")
async def export_all_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export all documents as a ZIP archive with metadata."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.tags))
        .where(
            Document.owner_id == current_user.id,
            Document.deleted_at.is_(None),
        )
        .order_by(Document.created_at.desc())
    )
    docs = list(result.scalars().all())

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for doc in docs:
            # Add the file
            try:
                content = await storage.get(doc.storage_key)
                zf.writestr(f"documents/{doc.filename}", content)
            except Exception:
                continue

            # Add metadata JSON
            meta = {
                "id": str(doc.id),
                "title": doc.title,
                "description": doc.description,
                "filename": doc.filename,
                "mime_type": doc.mime_type,
                "file_size": doc.file_size,
                "folder_id": str(doc.folder_id) if doc.folder_id else None,
                "correspondent_id": str(doc.correspondent_id) if doc.correspondent_id else None,
                "document_type_id": str(doc.document_type_id) if doc.document_type_id else None,
                "document_date": str(doc.document_date) if doc.document_date else None,
                "archive_serial_number": doc.archive_serial_number,
                "checksum": doc.checksum,
                "tags": [{"id": str(t.id), "name": t.name} for t in doc.tags],
                "custom_metadata": doc.custom_metadata,
                "created_at": doc.created_at.isoformat(),
                "updated_at": doc.updated_at.isoformat(),
            }
            zf.writestr(
                f"documents/{doc.filename}.metadata.json",
                json.dumps(meta, indent=2, ensure_ascii=False),
            )

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="dms-export.zip"'},
    )


@router.get("/{doc_id}")
async def export_single_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a single document with its metadata as a ZIP."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.tags))
        .where(
            Document.id == doc_id,
            Document.owner_id == current_user.id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        content = await storage.get(doc.storage_key)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found in storage")

    meta = {
        "id": str(doc.id),
        "title": doc.title,
        "description": doc.description,
        "filename": doc.filename,
        "mime_type": doc.mime_type,
        "file_size": doc.file_size,
        "folder_id": str(doc.folder_id) if doc.folder_id else None,
        "correspondent_id": str(doc.correspondent_id) if doc.correspondent_id else None,
        "document_type_id": str(doc.document_type_id) if doc.document_type_id else None,
        "document_date": str(doc.document_date) if doc.document_date else None,
        "archive_serial_number": doc.archive_serial_number,
        "checksum": doc.checksum,
        "tags": [{"id": str(t.id), "name": t.name} for t in doc.tags],
        "custom_metadata": doc.custom_metadata,
        "created_at": doc.created_at.isoformat(),
        "updated_at": doc.updated_at.isoformat(),
    }

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(doc.filename, content)
        zf.writestr(
            f"{doc.filename}.metadata.json",
            json.dumps(meta, indent=2, ensure_ascii=False),
        )

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}.zip"'},
    )
