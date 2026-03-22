import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentTypeCreate(BaseModel):
    name: str
    match_pattern: str | None = None


class DocumentTypeUpdate(BaseModel):
    name: str | None = None
    match_pattern: str | None = None


class DocumentTypeResponse(BaseModel):
    id: uuid.UUID
    name: str
    match_pattern: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
