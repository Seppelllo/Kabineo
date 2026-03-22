from sqlalchemy import BigInteger, Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class TelegramLink(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "telegram_links"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    telegram_user_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False)
    telegram_chat_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    auth_token: Mapped[str | None] = mapped_column(String(64))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User")
