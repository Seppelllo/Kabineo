from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin


class MatchingRule(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "matching_rules"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    match_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "keyword", "regex", "exact"
    pattern: Mapped[str] = mapped_column(String(500), nullable=False)
    case_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Actions
    assign_correspondent_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("correspondents.id", ondelete="SET NULL")
    )
    assign_document_type_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_types.id", ondelete="SET NULL")
    )
    assign_tag_ids: Mapped[list | None] = mapped_column(JSONB, default=list)
    assign_folder_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="SET NULL")
    )
    owner_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    owner = relationship("User")
    assign_correspondent = relationship("Correspondent")
    assign_document_type = relationship("DocumentType")
    assign_folder = relationship("Folder")
