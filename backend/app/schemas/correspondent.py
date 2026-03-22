import uuid
from datetime import datetime

from pydantic import BaseModel


class CorrespondentCreate(BaseModel):
    name: str
    match_pattern: str | None = None


class CorrespondentUpdate(BaseModel):
    name: str | None = None
    match_pattern: str | None = None


class CorrespondentResponse(BaseModel):
    id: uuid.UUID
    name: str
    match_pattern: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
