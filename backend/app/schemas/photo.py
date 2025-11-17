"""
Pydantic schemas for photo operations.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, Field, ConfigDict


class PhotoBase(BaseModel):
    """Base photo schema."""
    pass


class PhotoCreate(BaseModel):
    """Schema for creating a new photo."""
    filename: str = Field(..., description="Original filename")
    content_type: str = Field(..., description="MIME type (e.g., 'image/jpeg')")
    size_bytes: int = Field(..., ge=1, description="File size in bytes")
    checksum_sha256: str = Field(..., description="SHA256 checksum of file content")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Optional metadata")


class PhotoResponse(BaseModel):
    """Schema for photo response."""
    id: UUID
    owner_id: str
    original_key: str
    processed_key: Optional[str] = None
    thumbnail_key: Optional[str] = None
    storage_bucket: str
    status: str
    size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    checksum_sha256: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    # Presigned URLs (generated on-demand)
    original_url: Optional[str] = None
    processed_url: Optional[str] = None
    thumbnail_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PhotoListResponse(BaseModel):
    """Schema for photo list response."""
    photos: list[PhotoResponse]
    total: int
    limit: int
    offset: int


class PresignedUploadResponse(BaseModel):
    """Schema for presigned upload URL response."""
    url: str = Field(..., description="Presigned POST URL")
    fields: Dict[str, str] = Field(..., description="Form fields to include in POST request")
    key: str = Field(..., description="S3 key for the upload")
    photo_id: UUID = Field(..., description="Photo ID (created in database)")


class PhotoUpdate(BaseModel):
    """Schema for updating photo metadata."""
    metadata: Optional[Dict[str, Any]] = Field(None, description="Updated metadata")


class PhotoPresignedUrlResponse(BaseModel):
    """Schema for presigned download URL response."""
    url: str = Field(..., description="Presigned GET URL")
    expires_in: int = Field(3600, description="URL expiration in seconds")

