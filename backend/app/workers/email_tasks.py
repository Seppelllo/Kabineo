"""Email import worker: poll IMAP inbox for new emails with attachments and import them."""
import asyncio
import email
import email.policy
import imaplib
import logging
import uuid
from io import BytesIO

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _poll_email():
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings

    if not settings.imap_enabled:
        logger.debug("Email: IMAP not enabled, skipping")
        return

    if not all([settings.imap_server, settings.imap_user, settings.imap_password]):
        logger.warning("Email: IMAP settings incomplete, skipping")
        return

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        # Connect to IMAP
        mail = imaplib.IMAP4_SSL(settings.imap_server)
        mail.login(settings.imap_user, settings.imap_password)
        mail.select(settings.imap_folder)

        # Search for unseen messages
        status, data = mail.search(None, "UNSEEN")
        if status != "OK" or not data[0]:
            logger.debug("Email: No unseen messages")
            mail.logout()
            await engine.dispose()
            return

        message_ids = data[0].split()
        logger.info(f"Email: Found {len(message_ids)} unseen message(s)")

        for msg_id in message_ids:
            try:
                await _process_email_message(mail, msg_id, session_factory, settings)
            except Exception as e:
                logger.error(f"Email: Error processing message {msg_id}: {e}")

        mail.logout()

    except imaplib.IMAP4.error as e:
        logger.error(f"Email: IMAP error: {e}")
    except Exception as e:
        logger.error(f"Email: Connection error: {e}")

    await engine.dispose()


async def _process_email_message(mail, msg_id, session_factory, settings):
    import magic as libmagic

    from app.models.correspondent import Correspondent
    from app.services import document_service

    from sqlalchemy import select

    status, msg_data = mail.fetch(msg_id, "(RFC822)")
    if status != "OK":
        return

    raw_email = msg_data[0][1]
    msg = email.message_from_bytes(raw_email, policy=email.policy.default)

    sender = msg.get("From", "Unknown")
    subject = msg.get("Subject", "Email Import")

    # Extract clean sender name
    sender_name = sender
    if "<" in sender:
        sender_name = sender.split("<")[0].strip().strip('"')
    if not sender_name:
        sender_name = sender

    attachments = []
    for part in msg.walk():
        content_disposition = part.get("Content-Disposition", "")
        if "attachment" in content_disposition:
            filename = part.get_filename()
            if filename:
                content = part.get_payload(decode=True)
                if content:
                    attachments.append((filename, content))

    if not attachments:
        logger.debug(f"Email: Message from '{sender_name}' has no attachments, skipping")
        # Still mark as seen
        mail.store(msg_id, "+FLAGS", "\\Seen")
        return

    async with session_factory() as db:
        # Find or create correspondent by sender name
        correspondent_result = await db.execute(
            select(Correspondent).where(Correspondent.name == sender_name)
        )
        correspondent = correspondent_result.scalar_one_or_none()

        for filename, content in attachments:
            try:
                mime_type = libmagic.from_buffer(content[:2048], mime=True)

                # We need an owner_id. For email import, use the first user or a system user.
                # In practice, this would be configured per IMAP account.
                # For now, find the correspondent's owner or use a default approach.
                from app.models.user import User
                user_result = await db.execute(select(User).limit(1))
                owner = user_result.scalar_one_or_none()
                if not owner:
                    logger.error("Email: No users found in system, cannot import")
                    return

                doc = await document_service.upload_document(
                    db=db,
                    owner_id=owner.id,
                    file_data=BytesIO(content),
                    filename=filename,
                    mime_type=mime_type,
                    file_size=len(content),
                    title=f"{subject} - {filename}",
                )

                # Assign correspondent if found
                if correspondent:
                    doc.correspondent_id = correspondent.id
                else:
                    # Create new correspondent
                    new_correspondent = Correspondent(
                        name=sender_name,
                        owner_id=owner.id,
                    )
                    db.add(new_correspondent)
                    await db.flush()
                    doc.correspondent_id = new_correspondent.id
                    correspondent = new_correspondent

                await db.commit()
                logger.info(f"Email: Imported '{filename}' from '{sender_name}'")

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
                logger.error(f"Email: Failed to import attachment '{filename}': {e}")

    # Mark email as seen
    mail.store(msg_id, "+FLAGS", "\\Seen")


@celery_app.task(bind=True, max_retries=1, default_retry_delay=30)
def poll_email(self):
    logger.info("Email poll task started")
    try:
        _run_async(_poll_email())
    except Exception as exc:
        logger.error(f"Email poll task error: {exc}")
        raise self.retry(exc=exc)
