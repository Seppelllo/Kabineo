import uuid
from datetime import datetime

from pydantic import BaseModel


class ShareCreate(BaseModel):
    expires_in_hours: int | None = None
    password: str | None = None
    max_downloads: int | None = None


class ShareResponse(BaseModel):
    id: uuid.UUID
    token: str
    document_id: uuid.UUID
    expires_at: datetime | None
    download_count: int
    max_downloads: int | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
