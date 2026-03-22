"""Date extraction worker: extract document date from OCR text using common date patterns."""
import asyncio
import logging
import re
import uuid
from datetime import date

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# German month names → month number
GERMAN_MONTHS = {
    "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4,
    "mai": 5, "juni": 6, "juli": 7, "august": 8, "september": 9,
    "oktober": 10, "november": 11, "dezember": 12,
}

# Date patterns in order of priority
DATE_PATTERNS = [
    # DD.MM.YYYY (German)
    (r"\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b", "dmy"),
    # DD/MM/YYYY
    (r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", "dmy"),
    # YYYY-MM-DD (ISO)
    (r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", "ymd"),
    # DD. Month YYYY (German: "21. März 2026")
    (r"\b(\d{1,2})\.\s*(" + "|".join(GERMAN_MONTHS.keys()) + r")\s+(\d{4})\b", "dMonthY"),
]


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _parse_date(text: str) -> date | None:
    """Try to extract the first valid date from text."""
    text_lower = text.lower()

    for pattern, fmt in DATE_PATTERNS:
        match = re.search(pattern, text_lower if fmt == "dMonthY" else text)
        if not match:
            continue

        try:
            if fmt == "dmy":
                day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
            elif fmt == "ymd":
                year, month, day = int(match.group(1)), int(match.group(2)), int(match.group(3))
            elif fmt == "dMonthY":
                day = int(match.group(1))
                month = GERMAN_MONTHS.get(match.group(2))
                year = int(match.group(3))
                if month is None:
                    continue
            else:
                continue

            # Validate reasonable date range
            if year < 1900 or year > 2100:
                continue
            return date(year, month, day)
        except (ValueError, KeyError):
            continue

    return None


async def _extract_date(doc_id: str):
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
            logger.warning(f"ExtractDate: Document {doc_id} not found")
            await engine.dispose()
            return

        # Don't overwrite manually set dates
        if doc.document_date is not None:
            logger.info(f"ExtractDate: Document {doc_id} already has a date, skipping")
            await engine.dispose()
            return

        text = doc.ocr_text or ""
        if not text:
            logger.info(f"ExtractDate: Document {doc_id} has no OCR text, skipping")
            await engine.dispose()
            return

        extracted = _parse_date(text)
        if extracted:
            doc.document_date = extracted
            await db.commit()
            logger.info(f"ExtractDate: Set date {extracted} for document {doc_id}")
        else:
            logger.info(f"ExtractDate: No date found in document {doc_id}")

    await engine.dispose()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=10)
def extract_date(self, doc_id: str):
    logger.info(f"ExtractDate task started for {doc_id}")
    try:
        _run_async(_extract_date(doc_id))
    except Exception as exc:
        logger.error(f"ExtractDate task error for {doc_id}: {exc}")
        raise self.retry(exc=exc)
