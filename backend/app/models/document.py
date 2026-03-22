import enum
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, Date, DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDMixin
from app.models.tag import document_tags


class OCRStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    not_applicable = "not_applicable"


class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_search_vector", "search_vector", postgresql_using="gin"),
        Index("ix_documents_custom_metadata", "custom_metadata", postgresql_using="gin"),
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    thumbnail_key: Mapped[str | None] = mapped_column(String(1000))

    folder_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("folders.id", ondelete="SET NULL"), index=True
    )
    owner_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    correspondent_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("correspondents.id", ondelete="SET NULL"), index=True
    )
    document_type_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_types.id", ondelete="SET NULL"), index=True
    )
    document_date: Mapped[datetime | None] = mapped_column(Date)
    archive_serial_number: Mapped[str | None] = mapped_column(String(100), unique=True)
    checksum: Mapped[str | None] = mapped_column(String(64))

    current_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    ocr_status: Mapped[OCRStatus] = mapped_column(
        Enum(OCRStatus), default=OCRStatus.pending, nullable=False
    )
    ocr_text: Mapped[str | None] = mapped_column(Text)
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR)
    custom_metadata: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    retention_date: Mapped[datetime | None] = mapped_column(Date)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    page_count: Mapped[int | None] = mapped_column(Integer)

    owner = relationship("User", back_populates="documents")
    folder = relationship("Folder", back_populates="documents")
    correspondent = relationship("Correspondent", back_populates="documents")
    document_type = relationship("DocumentType", back_populates="documents")
    tags = relationship("Tag", secondary=document_tags, back_populates="documents", lazy="selectin")
    versions = relationship("DocumentVersion", back_populates="document", lazy="selectin", order_by="DocumentVersion.version_number.desc()", cascade="all, delete-orphan", passive_deletes=True)
    share_links = relationship("ShareLink", back_populates="document", lazy="selectin", cascade="all, delete-orphan", passive_deletes=True)
    comments = relationship("Comment", back_populates="document", lazy="selectin", cascade="all, delete-orphan", passive_deletes=True, order_by="Comment.created_at.desc()")
