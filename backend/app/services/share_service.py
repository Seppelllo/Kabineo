import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.share_link import ShareLink


async def create_share_link(
    db: AsyncSession,
    document_id: uuid.UUID,
    created_by: uuid.UUID,
    expires_in_hours: int | None = None,
    password: str | None = None,
    max_downloads: int | None = None,
) -> ShareLink:
    token = secrets.token_urlsafe(48)
    expires_at = None
    if expires_in_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)

    link = ShareLink(
        document_id=document_id,
        token=token,
        created_by=created_by,
        expires_at=expires_at,
        password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode() if password else None,
        max_downloads=max_downloads,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


async def get_share_by_token(db: AsyncSession, token: str) -> ShareLink | None:
    result = await db.execute(
        select(ShareLink)
        .options(selectinload(ShareLink.document))
        .where(ShareLink.token == token, ShareLink.is_active == True)
    )
    link = result.scalar_one_or_none()
    if link and link.expires_at and link.expires_at < datetime.now(timezone.utc):
        return None
    if link and link.max_downloads and link.download_count >= link.max_downloads:
        return None
    return link


async def increment_download(db: AsyncSession, link: ShareLink) -> None:
    link.download_count += 1
    await db.commit()


async def verify_share_password(link: ShareLink, password: str) -> bool:
    if not link.password_hash:
        return True
    return bcrypt.checkpw(password.encode(), link.password_hash.encode())


async def get_document_shares(db: AsyncSession, document_id: uuid.UUID) -> list[ShareLink]:
    result = await db.execute(
        select(ShareLink).where(ShareLink.document_id == document_id).order_by(ShareLink.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_share(db: AsyncSession, share_id: uuid.UUID) -> None:
    result = await db.execute(select(ShareLink).where(ShareLink.id == share_id))
    link = result.scalar_one_or_none()
    if link:
        link.is_active = False
        await db.commit()
