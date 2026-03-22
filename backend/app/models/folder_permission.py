from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class FolderPermission(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "folder_permissions"
    __table_args__ = (
        UniqueConstraint("folder_id", "user_id", name="uq_folder_user"),
    )

    folder_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    group_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=True, index=True
    )
    permission: Mapped[str] = mapped_column(String(20), nullable=False)  # "read", "write", "admin"
    granted_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )

    folder = relationship("Folder", backref="permissions")
    user = relationship("User", foreign_keys=[user_id])
    group = relationship("Group", foreign_keys=[group_id])
    granter = relationship("User", foreign_keys=[granted_by])
