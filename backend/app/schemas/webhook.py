import uuid
from datetime import datetime

from pydantic import BaseModel


class WebhookCreate(BaseModel):
    name: str
    url: str
    secret: str
    events: list[str] = []
    is_active: bool = True


class WebhookUpdate(BaseModel):
    name: str | None = None
    url: str | None = None
    secret: str | None = None
    events: list[str] | None = None
    is_active: bool | None = None


class WebhookResponse(BaseModel):
    id: uuid.UUID
    name: str
    url: str
    events: list[str] | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
