from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class DocumentType(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "document_types"

    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    match_pattern: Mapped[str | None] = mapped_column(String(500))
    owner_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    owner = relationship("User")
    documents = relationship("Document", back_populates="document_type")
