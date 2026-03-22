"""Document sharing — share with specific users or everyone."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.document import Document
from app.models.document_share import DocumentShare
from app.models.user import User
from app.services import document_service

router = APIRouter(prefix="/api/documents", tags=["document-shares"])


class ShareRequest(BaseModel):
    user_id: uuid.UUID | None = None  # None = share with everyone
    permission: str = "read"  # "read" or "write"


class ShareResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    shared_with_id: uuid.UUID | None
    shared_with_username: str | None = None
    permission: str
    shared_by: uuid.UUID
    created_at: str

    model_config = {"from_attributes": True}


@router.get("/{doc_id}/shares/users", response_model=list[ShareResponse])
async def list_document_shares(
    doc_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all user shares for a document (owner or admin only)."""
    doc = await document_service.get_document(db, doc_id)
    if not doc or (doc.owner_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Document not found")

    result = await db.execute(
        select(DocumentShare).where(DocumentShare.document_id == doc_id).order_by(DocumentShare.created_at.desc())
    )
    shares = result.scalars().all()

    response = []
    for s in shares:
        username = None
        if s.shared_with_id:
            user = await db.get(User, s.shared_with_id)
            username = user.username if user else None
        else:
            username = "Alle Benutzer"
        response.append(ShareResponse(
            id=s.id,
            document_id=s.document_id,
            shared_with_id=s.shared_with_id,
            shared_with_username=username,
            permission=s.permission,
            shared_by=s.shared_by,
            created_at=str(s.created_at),
        ))
    return response


@router.post("/{doc_id}/shares/users", status_code=status.HTTP_201_CREATED)
async def share_document(
    doc_id: uuid.UUID,
    data: ShareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Share a document with a user or everyone."""
    doc = await document_service.get_document(db, doc_id)
    if not doc or (doc.owner_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Document not found")

    if data.permission not in ("read", "write"):
        raise HTTPException(status_code=400, detail="Permission must be 'read' or 'write'")

    # Check if share already exists
    query = select(DocumentShare).where(
        DocumentShare.document_id == doc_id,
        DocumentShare.shared_with_id == data.user_id,
    )
    existing = (await db.execute(query)).scalar_one_or_none()

    if existing:
        existing.permission = data.permission
        await db.commit()
        return {"detail": "Permission updated"}

    share = DocumentShare(
        document_id=doc_id,
        shared_with_id=data.user_id,
        permission=data.permission,
        shared_by=current_user.id,
    )
    db.add(share)
    await db.commit()
    return {"detail": "Document shared"}


@router.delete("/{doc_id}/shares/users/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_document_share(
    doc_id: uuid.UUID,
    share_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a document share."""
    doc = await document_service.get_document(db, doc_id)
    if not doc or (doc.owner_id != current_user.id and current_user.role != "admin"):
        raise HTTPException(status_code=404, detail="Document not found")

    result = await db.execute(select(DocumentShare).where(DocumentShare.id == share_id))
    share = result.scalar_one_or_none()
    if share:
        await db.delete(share)
        await db.commit()
