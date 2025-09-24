"""
Pydantic schemas for restoration API
"""

from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RestorationRequest(BaseModel):
    denoise: float = Field(
        default=0.7, ge=0.0, le=1.0, description="Denoising strength (0.0 to 1.0)"
    )


class RestorationResponse(BaseModel):
    job_id: UUID
    status: JobStatus
    message: str


class JobStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: str
    status: JobStatus
    original_image_url: str
    processed_image_url: Optional[str] = None
    denoise: float
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
