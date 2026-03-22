"""Barcode/QR scanner worker: detect barcodes and QR codes in document images."""
import asyncio
import io
import logging
import re
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


async def _scan_barcodes(doc_id: str):
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
            logger.warning(f"Barcode: Document {doc_id} not found")
            await engine.dispose()
            return

        # Only process images and PDFs
        if not (doc.mime_type.startswith("image/") or doc.mime_type == "application/pdf"):
            logger.info(f"Barcode: Document {doc_id} not an image/PDF, skipping")
            await engine.dispose()
            return

        try:
            from PIL import Image
            from pyzbar.pyzbar import decode as pyzbar_decode

            from app.storage import get_storage_backend
            storage = get_storage_backend()

            file_data = await storage.get(doc.storage_key)

            images = []
            if doc.mime_type == "application/pdf":
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    tmp.write(file_data)
                    tmp_path = tmp.name
                from pdf2image import convert_from_path
                images = convert_from_path(tmp_path)
                Path(tmp_path).unlink(missing_ok=True)
            else:
                images = [Image.open(io.BytesIO(file_data))]

            found_codes = []
            for img in images:
                decoded = pyzbar_decode(img)
                for barcode in decoded:
                    code_data = barcode.data.decode("utf-8", errors="replace")
                    code_type = barcode.type
                    found_codes.append({"type": code_type, "data": code_data})

            if not found_codes:
                logger.info(f"Barcode: No barcodes found in document {doc_id}")
                await engine.dispose()
                return

            logger.info(f"Barcode: Found {len(found_codes)} code(s) in document {doc_id}")

            # Check for ASN pattern (e.g. "ASN-001234")
            for code in found_codes:
                asn_match = re.match(r"^ASN[-_]?(\d+)$", code["data"], re.IGNORECASE)
                if asn_match and not doc.archive_serial_number:
                    doc.archive_serial_number = code["data"]
                    logger.info(f"Barcode: Set ASN '{code['data']}' for document {doc_id}")
                    break

            # Store all found codes in custom_metadata
            metadata = dict(doc.custom_metadata or {})
            metadata["barcodes"] = found_codes
            doc.custom_metadata = metadata

            await db.commit()

        except ImportError:
            logger.error("Barcode: pyzbar not installed, skipping barcode scanning")
        except Exception as e:
            logger.error(f"Barcode: Failed for {doc_id}: {e}")

    await engine.dispose()


@celery_app.task(bind=True, max_retries=1, default_retry_delay=10)
def scan_barcodes(self, doc_id: str):
    logger.info(f"Barcode task started for {doc_id}")
    try:
        _run_async(_scan_barcodes(doc_id))
    except Exception as exc:
        logger.error(f"Barcode task error for {doc_id}: {exc}")
        raise self.retry(exc=exc)
