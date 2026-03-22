import hashlib
import hmac
import json
import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.webhook import WebhookEndpoint
from app.schemas.webhook import WebhookCreate, WebhookResponse, WebhookUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings/webhooks", tags=["webhooks"])


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebhookEndpoint)
        .where(WebhookEndpoint.owner_id == current_user.id)
        .order_by(WebhookEndpoint.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    data: WebhookCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    webhook = WebhookEndpoint(
        name=data.name,
        url=data.url,
        secret=data.secret,
        events=data.events,
        is_active=data.is_active,
        owner_id=current_user.id,
    )
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    return webhook


@router.put("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: uuid.UUID,
    data: WebhookUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebhookEndpoint).where(
            WebhookEndpoint.id == webhook_id,
            WebhookEndpoint.owner_id == current_user.id,
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    if data.name is not None:
        webhook.name = data.name
    if data.url is not None:
        webhook.url = data.url
    if data.secret is not None:
        webhook.secret = data.secret
    if data.events is not None:
        webhook.events = data.events
    if data.is_active is not None:
        webhook.is_active = data.is_active
    await db.commit()
    await db.refresh(webhook)
    return webhook


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebhookEndpoint).where(
            WebhookEndpoint.id == webhook_id,
            WebhookEndpoint.owner_id == current_user.id,
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(webhook)
    await db.commit()


@router.post("/{webhook_id}/test")
async def test_webhook(
    webhook_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WebhookEndpoint).where(
            WebhookEndpoint.id == webhook_id,
            WebhookEndpoint.owner_id == current_user.id,
        )
    )
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(status_code=404, detail="Webhook not found")

    test_payload = {
        "event": "test",
        "data": {"message": "This is a test webhook event from DMS."},
    }
    body = json.dumps(test_payload)
    signature = hmac.new(
        webhook.secret.encode(), body.encode(), hashlib.sha256
    ).hexdigest()

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                webhook.url,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-DMS-Signature": signature,
                },
            )
        return {
            "success": response.status_code < 400,
            "status_code": response.status_code,
            "response_body": response.text[:500],
        }
    except Exception as e:
        logger.warning(f"Webhook test failed for {webhook.url}: {e}")
        return {
            "success": False,
            "error": str(e),
        }
