from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class Folder(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "folders"
    __table_args__ = (
        UniqueConstraint("name", "parent_id", name="uq_folder_name_parent"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="CASCADE")
    )
    owner_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    owner = relationship("User", back_populates="folders")
    parent = relationship("Folder", remote_side="Folder.id", backref="children")
    documents = relationship("Document", back_populates="folder", lazy="selectin")
