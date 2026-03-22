import uuid
from datetime import datetime

from pydantic import BaseModel


class SearchResult(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    filename: str
    mime_type: str
    file_size: int
    folder_id: uuid.UUID | None
    ocr_status: str
    snippet: str | None = None
    rank: float = 0.0
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchResponse(BaseModel):
    items: list[SearchResult]
    total: int
    query: str
