import uuid
from datetime import datetime, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.api_key import APIKey
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # API key authentication: tokens starting with "dms_"
    if token.startswith("dms_"):
        prefix = token[:8]
        result = await db.execute(
            select(APIKey).where(APIKey.key_prefix == prefix, APIKey.is_active == True)
        )
        api_keys = result.scalars().all()
        for api_key in api_keys:
            if bcrypt.checkpw(token.encode(), api_key.key_hash.encode()):
                # Update last_used_at
                api_key.last_used_at = datetime.now(timezone.utc)
                await db.commit()
                # Return the key's owner
                user_result = await db.execute(select(User).where(User.id == api_key.owner_id))
                user = user_result.scalar_one_or_none()
                if user is None or not user.is_active:
                    raise credentials_exception
                return user
        raise credentials_exception

    # Standard JWT authentication
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
