"""Auto-classification worker: match OCR text against rules to assign correspondent, type, tags, folder."""
import asyncio
import logging
import re
import uuid

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _classify_document(doc_id: str):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings
    from app.models.document import Document
    from app.models.matching_rule import MatchingRule
    from app.models.tag import Tag

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
        doc = result.scalar_one_or_none()
        if not doc:
            logger.warning(f"Classify: Document {doc_id} not found")
            await engine.dispose()
            return

        text = doc.ocr_text or ""
        if not text:
            logger.info(f"Classify: Document {doc_id} has no OCR text, skipping")
            await engine.dispose()
            return

        # Get all matching rules for the owner, ordered by priority
        rules_result = await db.execute(
            select(MatchingRule)
            .where(MatchingRule.owner_id == doc.owner_id)
            .order_by(MatchingRule.order.asc())
        )
        rules = rules_result.scalars().all()

        if not rules:
            logger.info(f"Classify: No matching rules for owner of document {doc_id}")
            await engine.dispose()
            return

        matched_rule = None
        for rule in rules:
            if _matches(rule, text):
                matched_rule = rule
                break

        if not matched_rule:
            logger.info(f"Classify: No rule matched for document {doc_id}")
            await engine.dispose()
            return

        logger.info(f"Classify: Rule '{matched_rule.name}' matched for document {doc_id}")

        # Apply actions from the matched rule
        changed = False
        if matched_rule.assign_correspondent_id:
            doc.correspondent_id = matched_rule.assign_correspondent_id
            changed = True
        if matched_rule.assign_document_type_id:
            doc.document_type_id = matched_rule.assign_document_type_id
            changed = True
        if matched_rule.assign_folder_id:
            doc.folder_id = matched_rule.assign_folder_id
            changed = True
        if matched_rule.assign_tag_ids:
            tag_uuids = [uuid.UUID(tid) if isinstance(tid, str) else tid for tid in matched_rule.assign_tag_ids]
            tags_result = await db.execute(select(Tag).where(Tag.id.in_(tag_uuids)))
            new_tags = list(tags_result.scalars().all())
            existing_tags = list(doc.tags) if doc.tags else []
            existing_ids = {t.id for t in existing_tags}
            for tag in new_tags:
                if tag.id not in existing_ids:
                    existing_tags.append(tag)
            doc.tags = existing_tags
            changed = True

        if changed:
            await db.commit()
            logger.info(f"Classify: Applied rule '{matched_rule.name}' to document {doc_id}")

    await engine.dispose()


def _matches(rule, text: str) -> bool:
    """Check if a matching rule matches the given text."""
    pattern = rule.pattern
    flags = 0 if rule.case_sensitive else re.IGNORECASE
    check_text = text if rule.case_sensitive else text.lower()

    if rule.match_type == "keyword":
        keywords = pattern.split()
        if not rule.case_sensitive:
            keywords = [k.lower() for k in keywords]
        return all(k in check_text for k in keywords)
    elif rule.match_type == "regex":
        try:
            return bool(re.search(pattern, text, flags))
        except re.error:
            logger.warning(f"Classify: Invalid regex in rule '{rule.name}': {pattern}")
            return False
    elif rule.match_type == "exact":
        if rule.case_sensitive:
            return pattern == text
        return pattern.lower() == text.lower()
    return False


@celery_app.task(bind=True, max_retries=2, default_retry_delay=10)
def classify_document(self, doc_id: str):
    logger.info(f"Classify task started for {doc_id}")
    try:
        _run_async(_classify_document(doc_id))
    except Exception as exc:
        logger.error(f"Classify task error for {doc_id}: {exc}")
        raise self.retry(exc=exc)
