"""Webhook dispatcher worker: send webhook notifications for document events."""
import asyncio
import hashlib
import hmac
import json
import logging
import uuid

from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _dispatch_webhook(event: str, payload: dict, owner_id: str):
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.config import settings
    from app.models.webhook import WebhookEndpoint

    engine = create_async_engine(settings.database_url)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        # Get all active webhooks for this owner that include this event
        result = await db.execute(
            select(WebhookEndpoint).where(
                WebhookEndpoint.owner_id == uuid.UUID(owner_id),
                WebhookEndpoint.is_active == True,
            )
        )
        webhooks = result.scalars().all()

        if not webhooks:
            logger.debug(f"Webhook: No active webhooks for owner {owner_id}")
            await engine.dispose()
            return

        for webhook in webhooks:
            # Check if this webhook is subscribed to this event
            if webhook.events and event not in webhook.events:
                continue

            try:
                await _send_webhook(webhook, event, payload)
            except Exception as e:
                logger.error(f"Webhook: Failed to send to '{webhook.name}' ({webhook.url}): {e}")

    await engine.dispose()


async def _send_webhook(webhook, event: str, payload: dict):
    import aiohttp

    body = json.dumps(payload, default=str)
    body_bytes = body.encode("utf-8")

    # Sign payload with HMAC-SHA256
    signature = hmac.new(
        webhook.secret.encode("utf-8"),
        body_bytes,
        hashlib.sha256,
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": f"sha256={signature}",
        "X-Webhook-Event": event,
        "User-Agent": "DMS-Webhook/1.0",
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            webhook.url,
            data=body_bytes,
            headers=headers,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as response:
            if response.status < 300:
                logger.info(f"Webhook: Sent '{event}' to '{webhook.name}' ({response.status})")
            else:
                resp_text = await response.text()
                logger.warning(
                    f"Webhook: '{webhook.name}' returned {response.status}: {resp_text[:200]}"
                )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def dispatch_webhook(self, event: str, payload: dict, owner_id: str):
    logger.info(f"Webhook dispatch task started: {event} for owner {owner_id}")
    try:
        _run_async(_dispatch_webhook(event, payload, owner_id))
    except Exception as exc:
        logger.error(f"Webhook dispatch task error: {exc}")
        raise self.retry(exc=exc)
