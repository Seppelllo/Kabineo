import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as app_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.system_setting import SystemSetting
from app.models.user import User

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _get_setting(db: AsyncSession, key: str) -> str | None:
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    return setting.value if setting else None


async def _set_setting(db: AsyncSession, key: str, value: str) -> None:
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    if setting:
        setting.value = value
    else:
        db.add(SystemSetting(key=key, value=value))
    await db.commit()


# ── Email Import ─────────────────────────────────────────────────────────────

class EmailImportConfig(BaseModel):
    enabled: bool = False
    server: str | None = None
    user: str | None = None
    password: str | None = None
    folder: str | None = None


@router.get("/email-import")
async def get_email_import(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stored = await _get_setting(db, "email_import")
    if stored:
        data = json.loads(stored)
        # Never return password
        data.pop("password", None)
        return data

    return {
        "enabled": app_settings.imap_enabled,
        "server": app_settings.imap_server or None,
        "email": app_settings.imap_user or None,
        "folder": app_settings.imap_folder or "INBOX",
    }


@router.put("/email-import")
async def update_email_import(
    data: EmailImportConfig,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stored_raw = await _get_setting(db, "email_import")
    existing = json.loads(stored_raw) if stored_raw else {}

    update = data.model_dump(exclude_none=True)
    # Keep existing password if not provided
    if "password" not in update or not update.get("password"):
        update["password"] = existing.get("password", "")

    await _set_setting(db, "email_import", json.dumps(update))
    safe = {k: v for k, v in update.items() if k != "password"}
    return safe


# ── Consume Folder ───────────────────────────────────────────────────────────

class ConsumeFolderConfig(BaseModel):
    enabled: bool = False
    path: str | None = None


@router.get("/consume-folder")
async def get_consume_folder(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stored = await _get_setting(db, "consume_folder")
    if stored:
        return json.loads(stored)

    return {
        "enabled": bool(app_settings.consume_folder_path),
        "path": app_settings.consume_folder_path or None,
    }


@router.put("/consume-folder")
async def update_consume_folder(
    data: ConsumeFolderConfig,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _set_setting(db, "consume_folder", json.dumps(data.model_dump()))
    return data.model_dump()
