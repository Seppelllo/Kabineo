import asyncio
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


async def _process_ocr(doc_id: str):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings
    from app.models.document import Document, OCRStatus

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
        doc = result.scalar_one_or_none()
        if not doc:
            logger.warning(f"OCR: Document {doc_id} not found")
            return

        if not (doc.mime_type.startswith("image/") or doc.mime_type == "application/pdf"):
            doc.ocr_status = OCRStatus.not_applicable
            await db.commit()
            logger.info(f"OCR: Document {doc_id} not applicable ({doc.mime_type})")
            return

        doc.ocr_status = OCRStatus.processing
        await db.commit()
        logger.info(f"OCR: Processing {doc_id} ({doc.mime_type})")

        try:
            from app.storage import get_storage_backend
            storage = get_storage_backend()

            file_data = await storage.get(doc.storage_key)

            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(doc.filename).suffix) as tmp:
                tmp.write(file_data)
                tmp_path = tmp.name

            import pytesseract

            text = ""
            if doc.mime_type == "application/pdf":
                from pdf2image import convert_from_path
                images = convert_from_path(tmp_path)
                for img in images:
                    text += pytesseract.image_to_string(img, lang="deu+eng") + "\n"
            else:
                from PIL import Image
                img = Image.open(tmp_path)
                text = pytesseract.image_to_string(img, lang="deu+eng")

            Path(tmp_path).unlink(missing_ok=True)

            doc.ocr_text = text.strip() if text.strip() else "(kein Text erkannt)"
            doc.ocr_status = OCRStatus.completed
            await db.commit()
            logger.info(f"OCR: Completed {doc_id}, {len(doc.ocr_text)} chars extracted")

        except Exception as e:
            logger.error(f"OCR: Failed for {doc_id}: {e}")
            doc.ocr_status = OCRStatus.failed
            await db.commit()

    await engine.dispose()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=10)
def process_ocr(self, doc_id: str):
    logger.info(f"OCR task started for {doc_id}")
    try:
        _run_async(_process_ocr(doc_id))
    except Exception as exc:
        logger.error(f"OCR task error for {doc_id}: {exc}")
        raise self.retry(exc=exc)
