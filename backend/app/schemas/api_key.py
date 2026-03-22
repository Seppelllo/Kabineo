import uuid
from datetime import datetime

from pydantic import BaseModel


class APIKeyCreate(BaseModel):
    name: str


class APIKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    is_active: bool
    last_used_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class APIKeyCreateResponse(APIKeyResponse):
    """Returned only on creation — includes the full key (shown once)."""
    full_key: str
