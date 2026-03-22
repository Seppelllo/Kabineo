from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class DocumentShare(Base, UUIDMixin, TimestampMixin):
    """Share a document with a specific user or all users."""
    __tablename__ = "document_shares"

    document_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    shared_with_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )  # NULL = shared with everyone
    permission: Mapped[str] = mapped_column(String(20), default="read", nullable=False)  # "read" or "write"
    shared_by: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    document = relationship("Document")
    user = relationship("User", foreign_keys=[shared_with_id])
    sharer = relationship("User", foreign_keys=[shared_by])
