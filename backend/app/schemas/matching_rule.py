import uuid
from datetime import datetime

from pydantic import BaseModel


class MatchingRuleCreate(BaseModel):
    name: str
    order: int = 0
    match_type: str  # "keyword", "regex", "exact"
    pattern: str
    case_sensitive: bool = False
    assign_correspondent_id: uuid.UUID | None = None
    assign_document_type_id: uuid.UUID | None = None
    assign_tag_ids: list[uuid.UUID] | None = None
    assign_folder_id: uuid.UUID | None = None


class MatchingRuleUpdate(BaseModel):
    name: str | None = None
    order: int | None = None
    match_type: str | None = None
    pattern: str | None = None
    case_sensitive: bool | None = None
    assign_correspondent_id: uuid.UUID | None = None
    assign_document_type_id: uuid.UUID | None = None
    assign_tag_ids: list[uuid.UUID] | None = None
    assign_folder_id: uuid.UUID | None = None


class MatchingRuleResponse(BaseModel):
    id: uuid.UUID
    name: str
    order: int
    match_type: str
    pattern: str
    case_sensitive: bool
    assign_correspondent_id: uuid.UUID | None = None
    assign_document_type_id: uuid.UUID | None = None
    assign_tag_ids: list[uuid.UUID] | None = None
    assign_folder_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MatchingRuleTestRequest(BaseModel):
    document_id: uuid.UUID
    rule_id: uuid.UUID | None = None
    # Or inline rule definition
    match_type: str | None = None
    pattern: str | None = None
    case_sensitive: bool = False


class MatchingRuleTestResponse(BaseModel):
    matches: bool
    matched_text: str | None = None


class MatchingRuleTextTestRequest(BaseModel):
    text: str


class MatchingRuleTextTestMatch(BaseModel):
    rule_id: uuid.UUID
    rule_name: str
    matched_text: str | None = None
    assign_correspondent_id: uuid.UUID | None = None
    assign_document_type_id: uuid.UUID | None = None
    assign_tag_ids: list[uuid.UUID] | None = None
    assign_folder_id: uuid.UUID | None = None


class MatchingRuleTextTestResponse(BaseModel):
    matches: list[MatchingRuleTextTestMatch]
