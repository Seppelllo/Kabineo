import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import require_admin
from app.models.document import Document
from app.models.system_setting import SystemSetting
from app.models.user import User, UserRole
from app.schemas.audit import AuditLogListResponse
from app.schemas.user import AdminUserCreate, UserResponse
from app.services.audit_service import get_audit_logs
from app.services.auth_service import hash_password
from app.services.email_service import send_password_reset_email, send_welcome_email

router = APIRouter(prefix="/api/admin", tags=["admin"])


# --- System Settings ---


class SystemSettingsResponse(BaseModel):
    registration_enabled: bool
    smtp_configured: bool


class SystemSettingsUpdate(BaseModel):
    registration_enabled: bool


@router.get("/settings", response_model=SystemSettingsResponse)
async def get_settings(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "registration_enabled")
    )
    setting = result.scalar_one_or_none()
    if setting is not None:
        reg_enabled = setting.value.lower() in ("true", "1", "yes")
    else:
        reg_enabled = settings.registration_enabled

    return SystemSettingsResponse(
        registration_enabled=reg_enabled,
        smtp_configured=settings.smtp_enabled and bool(settings.smtp_host),
    )


@router.put("/settings", response_model=SystemSettingsResponse)
async def update_settings(
    data: SystemSettingsUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "registration_enabled")
    )
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = str(data.registration_enabled).lower()
    else:
        setting = SystemSetting(key="registration_enabled", value=str(data.registration_enabled).lower())
        db.add(setting)
    await db.commit()

    return SystemSettingsResponse(
        registration_enabled=data.registration_enabled,
        smtp_configured=settings.smtp_enabled and bool(settings.smtp_host),
    )


# --- Users ---


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


class UserUpdate(BaseModel):
    role: UserRole | None = None
    is_active: bool | None = None


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/users", status_code=201)
async def create_user(
    data: AdminUserCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Check for existing user
    existing = await db.execute(
        select(User).where((User.email == data.email) | (User.username == data.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="E-Mail oder Benutzername bereits vergeben")

    temp_password = data.password or secrets.token_urlsafe(12)

    user = User(
        email=data.email,
        username=data.username,
        full_name=data.full_name,
        hashed_password=hash_password(temp_password),
        role=UserRole(data.role) if data.role in [r.value for r in UserRole] else UserRole.user,
        must_change_password=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Send welcome email if SMTP configured
    email_sent = False
    if settings.smtp_enabled:
        try:
            await send_welcome_email(data.email, data.username, temp_password)
            email_sent = True
        except Exception:
            pass  # Don't fail user creation if email fails

    user_data = UserResponse.model_validate(user).model_dump()
    user_data["temporary_password"] = temp_password
    user_data["email_sent"] = email_sent
    return user_data


@router.post("/users/{user_id}/reset-password")
async def reset_password(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")

    temp_password = secrets.token_urlsafe(12)
    user.hashed_password = hash_password(temp_password)
    user.must_change_password = True
    await db.commit()

    # Send email if SMTP configured
    email_sent = False
    if settings.smtp_enabled:
        try:
            await send_password_reset_email(user.email, user.username, temp_password)
            email_sent = True
        except Exception:
            pass

    return {"temporary_password": temp_password, "email_sent": email_sent}


# --- Audit Logs ---


@router.get("/audit-logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    resource_type: str | None = None,
    action: str | None = None,
    user_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 50,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    items, total = await get_audit_logs(
        db, resource_type=resource_type, action=action, user_id=user_id, page=page, page_size=page_size
    )
    return AuditLogListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/stats")
async def get_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user_count = (await db.execute(select(func.count()).select_from(User))).scalar() or 0
    doc_count = (await db.execute(select(func.count()).select_from(Document))).scalar() or 0
    total_size = (await db.execute(select(func.sum(Document.file_size)))).scalar() or 0
    return {
        "total_users": user_count,
        "total_documents": doc_count,
        "total_storage_bytes": total_size,
    }
