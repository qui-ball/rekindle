"""
Database model for user-owned photos
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Column,
    DateTime,
    JSON,
    String,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.core.database import Base
from app.core.types import GUID


class Photo(Base):
    """Represents a photo owned by a specific authenticated user."""

    __tablename__ = "photos"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    owner_id = Column(String(255), nullable=False, index=True)
    original_key = Column(String, nullable=False)
    processed_key = Column(String, nullable=True)
    thumbnail_key = Column(String, nullable=True)
    storage_bucket = Column(String(255), nullable=False, default="rekindle-uploads")
    status = Column(String(20), nullable=False, default="uploaded", index=True)
    size_bytes = Column(BigInteger, nullable=True)
    mime_type = Column(String(100), nullable=True)
    checksum_sha256 = Column(String(64), nullable=False)
    metadata_json = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint(
            "owner_id",
            "original_key",
            name="uniq_photo_original_per_owner",
        ),
        CheckConstraint(
            "status IN ('uploaded', 'processing', 'ready', 'archived', 'deleted')",
            name="chk_photos_valid_status",
        ),
    )

    def mark_processed(
        self,
        processed_key: Optional[str] = None,
        thumbnail_key: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Mark the photo as processed and update related keys/metadata.
        """
        self.status = "ready"
        if processed_key is not None:
            self.processed_key = processed_key
        if thumbnail_key is not None:
            self.thumbnail_key = thumbnail_key
        if metadata is not None:
            self.metadata_json = metadata

    def mark_archived(self) -> None:
        """Mark the photo as archived without deleting data."""
        self.status = "archived"

    def mark_deleted(self) -> None:
        """Mark the photo as deleted."""
        self.status = "deleted"

    def __repr__(self) -> str:
        return f"<Photo {self.id} owner={self.owner_id} status={self.status}>"

