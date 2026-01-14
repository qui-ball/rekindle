"""
Pydantic schemas for jobs, restore attempts, and animation attempts
"""

from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from uuid import UUID
from typing import Optional, Dict, Any, List


# Job Schemas
class JobCreate(BaseModel):
    """Schema for creating a new job"""

    email: EmailStr


class JobResponse(BaseModel):
    """Schema for job responses"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    created_at: datetime
    selected_restore_id: Optional[UUID] = None
    latest_animation_id: Optional[UUID] = None
    thumbnail_s3_key: Optional[str] = None
    thumbnail_url: Optional[str] = None


# Restore Attempt Schemas
class RestoreAttemptCreate(BaseModel):
    """Schema for creating a restore attempt"""

    model: Optional[str] = None
    params: Optional[Dict[str, Any]] = None


class RestoreAttemptResponse(BaseModel):
    """Schema for restore attempt responses"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: UUID
    s3_key: str
    model: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    created_at: datetime
    url: Optional[str] = None


# Animation Attempt Schemas
class AnimationParams(BaseModel):
    """Parameters for animation generation"""

    prompt: str  # Required: text description for video generation
    resolution: str = "720p"  # Optional: 480p, 720p, or 1080p


class AnimationAttemptCreate(BaseModel):
    """Schema for creating an animation attempt"""

    restore_id: Optional[UUID] = (
        None  # Optional: if not provided, will use original photo
    )
    model: Optional[str] = "replicate_wan"  # Default to Replicate
    params: AnimationParams  # Required: must include prompt


class AnimationAttemptResponse(BaseModel):
    """Schema for animation attempt responses"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: UUID
    restore_id: Optional[UUID] = None
    preview_s3_key: str
    result_s3_key: Optional[str] = None
    thumb_s3_key: Optional[str] = None
    model: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    created_at: datetime
    preview_url: Optional[str] = None
    result_url: Optional[str] = None
    thumb_url: Optional[str] = None


# Job with Relations
class JobWithRelations(JobResponse):
    """Schema for job with all related data"""

    restore_attempts: List[RestoreAttemptResponse] = []
    animation_attempts: List[AnimationAttemptResponse] = []


# Upload Response
class UploadResponse(BaseModel):
    """Response after uploading and processing an image"""

    job_id: UUID
    message: str
    processed_url: Optional[str] = None
