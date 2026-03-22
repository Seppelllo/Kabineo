import uuid
from datetime import date, datetime

from pydantic import BaseModel


class TagResponse(BaseModel):
    id: uuid.UUID
    name: str
    color: str

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    text: str
    created_at: datetime
    username: str | None = None

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    filename: str
    mime_type: str
    file_size: int
    folder_id: uuid.UUID | None
    owner_id: uuid.UUID
    current_version: int
    ocr_status: str
    correspondent_id: uuid.UUID | None = None
    document_type_id: uuid.UUID | None = None
    document_date: date | None = None
    archive_serial_number: str | None = None
    checksum: str | None = None
    tags: list[TagResponse] = []
    custom_metadata: dict | None = None
    retention_date: date | None = None
    is_favorite: bool = False
    deleted_at: datetime | None = None
    page_count: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    folder_id: uuid.UUID | None = None
    clear_folder: bool = False  # Set to true to move to root (folder_id=null)
    tag_ids: list[uuid.UUID] | None = None
    custom_metadata: dict | None = None
    is_favorite: bool | None = None
    correspondent_id: uuid.UUID | None = None
    document_type_id: uuid.UUID | None = None
    document_date: date | None = None
    archive_serial_number: str | None = None
    retention_date: date | None = None


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
    page: int
    page_size: int


class VersionResponse(BaseModel):
    id: uuid.UUID
    version_number: int
    file_size: int
    uploaded_by: uuid.UUID
    comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    text: str


class BulkActionRequest(BaseModel):
    document_ids: list[uuid.UUID]
    action: str  # "delete", "move", "tag", "favorite", "unfavorite"
    folder_id: uuid.UUID | None = None
    tag_ids: list[uuid.UUID] | None = None
