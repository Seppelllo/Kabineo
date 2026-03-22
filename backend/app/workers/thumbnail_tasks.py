import asyncio
import io
import logging
import tempfile
import uuid
from pathlib import Path

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _generate_thumbnail(doc_id: str):
    from PIL import Image
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings
    from app.models.document import Document

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
        doc = result.scalar_one_or_none()
        if not doc:
            return

        if not (doc.mime_type.startswith("image/") or doc.mime_type == "application/pdf"):
            return

        try:
            from app.storage import get_storage_backend
            storage = get_storage_backend()

            file_data = await storage.get(doc.storage_key)

            if doc.mime_type == "application/pdf":
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    tmp.write(file_data)
                    tmp_path = tmp.name
                from pdf2image import convert_from_path
                images = convert_from_path(tmp_path, first_page=1, last_page=1)
                img = images[0]
                Path(tmp_path).unlink(missing_ok=True)
            else:
                img = Image.open(io.BytesIO(file_data))

            img.thumbnail((400, 400), Image.Resampling.LANCZOS)

            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGB")

            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=80)
            buf.seek(0)

            thumbnail_key = f"{doc.owner_id}/{doc.id}/thumbnail.webp"
            await storage.put(thumbnail_key, buf, "image/webp")

            doc.thumbnail_key = thumbnail_key
            await db.commit()
            logger.info(f"Thumbnail: Generated for {doc_id}")

        except Exception as e:
            logger.error(f"Thumbnail: Failed for {doc_id}: {e}")

    await engine.dispose()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=10)
def generate_thumbnail(self, doc_id: str):
    try:
        _run_async(_generate_thumbnail(doc_id))
    except Exception as exc:
        logger.error(f"Thumbnail task error for {doc_id}: {exc}")
        raise self.retry(exc=exc)
