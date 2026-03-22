import uuid
from datetime import datetime

from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    description: str | None = None


class GroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class GroupResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    member_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class GroupMemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    username: str
    full_name: str | None
    email: str
    role: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class JoinRequestCreate(BaseModel):
    message: str | None = None


class JoinRequestResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    group_name: str
    user_id: uuid.UUID
    username: str
    status: str
    message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationResponse(BaseModel):
    id: uuid.UUID
    title: str
    message: str
    type: str
    read: bool
    link: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
