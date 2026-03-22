"""Consume folder watcher: auto-import files from a watched folder."""
import asyncio
import logging
import os
import shutil
import uuid
from io import BytesIO
from pathlib import Path

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _consume_folder():
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings

    if not settings.consume_folder_path:
        logger.debug("Consume: No consume folder configured, skipping")
        return

    consume_path = Path(settings.consume_folder_path)
    if not consume_path.exists() or not consume_path.is_dir():
        logger.warning(f"Consume: Folder '{consume_path}' does not exist or is not a directory")
        return

    # Create processed subfolder
    processed_path = consume_path / "processed"
    processed_path.mkdir(exist_ok=True)

    files = [f for f in consume_path.iterdir() if f.is_file()]
    if not files:
        logger.debug("Consume: No files in consume folder")
        return

    logger.info(f"Consume: Found {len(files)} file(s) to import")

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    for file_path in files:
        try:
            await _import_file(file_path, processed_path, session_factory)
        except Exception as e:
            logger.error(f"Consume: Error importing '{file_path.name}': {e}")

    await engine.dispose()


async def _import_file(file_path: Path, processed_path: Path, session_factory):
    import magic as libmagic

    from app.models.user import User
    from app.services import document_service
    from sqlalchemy import select

    # Read file
    content = file_path.read_bytes()
    if not content:
        logger.warning(f"Consume: File '{file_path.name}' is empty, skipping")
        return

    mime_type = libmagic.from_buffer(content[:2048], mime=True)

    async with session_factory() as db:
        # Get the first user as the owner (in production, this could be configurable)
        user_result = await db.execute(select(User).limit(1))
        owner = user_result.scalar_one_or_none()
        if not owner:
            logger.error("Consume: No users found in system, cannot import")
            return

        try:
            doc = await document_service.upload_document(
                db=db,
                owner_id=owner.id,
                file_data=BytesIO(content),
                filename=file_path.name,
                mime_type=mime_type,
                file_size=len(content),
                title=file_path.stem,
            )
            logger.info(f"Consume: Imported '{file_path.name}' as document {doc.id}")

            # Move to processed folder
            dest = processed_path / file_path.name
            if dest.exists():
                # Add unique suffix to avoid overwriting
                dest = processed_path / f"{file_path.stem}_{uuid.uuid4().hex[:8]}{file_path.suffix}"
            shutil.move(str(file_path), str(dest))
            logger.info(f"Consume: Moved '{file_path.name}' to processed folder")

            # Trigger processing chain
            from app.workers.scan_tasks import process_document_scan
            from app.workers.ocr_tasks import process_ocr
            from app.workers.extract_tasks import extract_date
            from app.workers.classify_tasks import classify_document
            from app.workers.thumbnail_tasks import generate_thumbnail
            from app.workers.webhook_tasks import dispatch_webhook

            chain = (
                process_document_scan.si(str(doc.id))
                | process_ocr.si(str(doc.id))
                | extract_date.si(str(doc.id))
                | classify_document.si(str(doc.id))
                | generate_thumbnail.si(str(doc.id))
                | dispatch_webhook.si("document.created", {"document_id": str(doc.id)}, str(owner.id))
            )
            chain.apply_async()

        except Exception as e:
            logger.error(f"Consume: Failed to import '{file_path.name}': {e}")


@celery_app.task(bind=True, max_retries=1, default_retry_delay=10)
def consume_folder(self):
    logger.info("Consume folder task started")
    try:
        _run_async(_consume_folder())
    except Exception as exc:
        logger.error(f"Consume folder task error: {exc}")
        raise self.retry(exc=exc)
