import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.share import ShareCreate, ShareResponse
from app.services import document_service, share_service

router = APIRouter(tags=["shares"])


@router.post("/api/documents/{doc_id}/share", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
async def create_share(
    doc_id: uuid.UUID,
    data: ShareCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await document_service.get_document(db, doc_id)
    if not doc or doc.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    link = await share_service.create_share_link(
        db, doc_id, current_user.id, data.expires_in_hours, data.password, data.max_downloads
    )
    return link


@router.get("/api/documents/{doc_id}/shares", response_model=list[ShareResponse])
async def list_shares(
    doc_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await document_service.get_document(db, doc_id)
    if not doc or doc.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    return await share_service.get_document_shares(db, doc_id)


@router.delete("/api/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share(
    share_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.share_link import ShareLink
    from sqlalchemy import select

    result = await db.execute(select(ShareLink).where(ShareLink.id == share_id))
    link = result.scalar_one_or_none()
    if not link or link.created_by != current_user.id:
        raise HTTPException(status_code=404, detail="Share not found")
    await share_service.revoke_share(db, share_id)


@router.get("/api/shared/{token}")
async def access_shared(
    token: str,
    password: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    link = await share_service.get_share_by_token(db, token)
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found or expired")
    if link.password_hash and not password:
        raise HTTPException(status_code=401, detail="Password required")
    if password and not await share_service.verify_share_password(link, password):
        raise HTTPException(status_code=401, detail="Invalid password")
    doc = link.document
    return {
        "id": doc.id,
        "title": doc.title,
        "filename": doc.filename,
        "mime_type": doc.mime_type,
        "file_size": doc.file_size,
        "has_password": bool(link.password_hash),
    }


@router.get("/api/shared/{token}/download")
async def download_shared(
    token: str,
    password: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    link = await share_service.get_share_by_token(db, token)
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found or expired")
    if link.password_hash and not password:
        raise HTTPException(status_code=401, detail="Password required")
    if password and not await share_service.verify_share_password(link, password):
        raise HTTPException(status_code=401, detail="Invalid password")
    doc = link.document
    content = await document_service.download_document(doc)
    await share_service.increment_download(db, link)
    return Response(
        content=content,
        media_type=doc.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'},
    )
