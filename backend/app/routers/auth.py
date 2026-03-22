import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.system_setting import SystemSetting
from app.models.telegram_link import TelegramLink
from app.models.user import User
from app.schemas.user import (
    ChangePassword,
    TokenRefresh,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    create_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _is_registration_enabled(db: AsyncSession) -> bool:
    """Check registration_enabled from DB (overrides env), fallback to settings."""
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "registration_enabled")
    )
    setting = result.scalar_one_or_none()
    if setting is not None:
        return setting.value.lower() in ("true", "1", "yes")
    return settings.registration_enabled


@router.get("/config")
async def auth_config(db: AsyncSession = Depends(get_db)):
    """Public endpoint — no auth required."""
    reg_enabled = await _is_registration_enabled(db)
    return {"registration_enabled": reg_enabled}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    reg_enabled = await _is_registration_enabled(db)
    if not reg_enabled:
        raise HTTPException(status_code=403, detail="Registrierung ist deaktiviert")

    existing = await db.execute(select(User).where((User.email == data.email) | (User.username == data.username)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email or username already registered")
    user = await create_user(db, data.email, data.username, data.password, data.full_name)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        must_change_password=user.must_change_password,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(data.refresh_token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        must_change_password=user.must_change_password,
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
async def change_password(
    data: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Altes Passwort ist falsch")
    current_user.hashed_password = hash_password(data.new_password)
    current_user.must_change_password = False
    await db.commit()
    return {"detail": "Passwort erfolgreich geändert"}


@router.post("/telegram-link")
async def generate_telegram_link(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token = secrets.token_urlsafe(32)
    existing = await db.execute(
        select(TelegramLink).where(TelegramLink.user_id == current_user.id)
    )
    link = existing.scalar_one_or_none()
    if link:
        link.auth_token = token
        link.is_verified = False
    else:
        link = TelegramLink(
            user_id=current_user.id,
            telegram_user_id=0,
            telegram_chat_id=0,
            auth_token=token,
        )
        db.add(link)
    await db.commit()
    return {"link_code": token}
