import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str = Field(..., min_length=8)
    full_name: str | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    full_name: str | None
    role: str
    is_active: bool
    must_change_password: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class TokenRefresh(BaseModel):
    refresh_token: str


class AdminUserCreate(BaseModel):
    email: EmailStr
    username: str
    full_name: str | None = None
    role: str = "user"
    password: str | None = None  # If None, generate random


class ChangePassword(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)
