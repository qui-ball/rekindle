"""
Database models for jobs, restore attempts, and animation attempts
"""

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base
from app.core.types import GUID


class Job(Base):
    """Represents a user's upload session"""
    __tablename__ = "jobs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    selected_restore_id = Column(GUID(), nullable=True)
    latest_animation_id = Column(GUID(), nullable=True)
    thumbnail_s3_key = Column(String, nullable=True)  # Thumbnail path in S3
    
    # Relationships
    restore_attempts = relationship(
        "RestoreAttempt", 
        back_populates="job",
        cascade="all, delete-orphan",
        foreign_keys="RestoreAttempt.job_id"
    )
    animation_attempts = relationship(
        "AnimationAttempt", 
        back_populates="job",
        cascade="all, delete-orphan",
        foreign_keys="AnimationAttempt.job_id"
    )


class RestoreAttempt(Base):
    """Represents every restore step on a job"""
    __tablename__ = "restore_attempts"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    job_id = Column(
        GUID(), 
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    s3_key = Column(String, nullable=False)
    model = Column(String, nullable=True)
    params = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    job = relationship("Job", back_populates="restore_attempts", foreign_keys=[job_id])
    animation_attempts = relationship(
        "AnimationAttempt",
        back_populates="restore_attempt",
        cascade="all, delete-orphan"
    )


class AnimationAttempt(Base):
    """Represents every animation of a restored image"""
    __tablename__ = "animation_attempts"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    job_id = Column(
        GUID(),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    restore_id = Column(
        GUID(),
        ForeignKey("restore_attempts.id"),
        nullable=True
    )
    preview_s3_key = Column(String, nullable=False)
    result_s3_key = Column(String, nullable=True)
    thumb_s3_key = Column(String, nullable=True)
    model = Column(String, nullable=True)
    params = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    job = relationship("Job", back_populates="animation_attempts", foreign_keys=[job_id])
    restore_attempt = relationship("RestoreAttempt", back_populates="animation_attempts")