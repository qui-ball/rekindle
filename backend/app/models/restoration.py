"""
Database models for restoration jobs
"""

from sqlalchemy import Column, String, Float, DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import enum
import uuid

from app.core.database import Base


class JobStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RestorationJob(Base):
    __tablename__ = "restoration_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, nullable=False, index=True)
    status = Column(
        Enum(JobStatus), default=JobStatus.PENDING, nullable=False, index=True
    )
    original_image_url = Column(String, nullable=False)
    processed_image_url = Column(String, nullable=True)
    denoise = Column(Float, nullable=False, default=0.7)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
