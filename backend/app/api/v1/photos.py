"""
Photo API endpoints with user-scoped storage.

All endpoints require authentication and enforce user ownership.
"""

import hashlib
from typing import List, Optional, Dict
from uuid import UUID, uuid4
from datetime import datetime as dt
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Query, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from loguru import logger

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.user import User
from app.models.photo import Photo
from app.schemas.photo import (
    PhotoResponse,
    PhotoListResponse,
    PresignedUploadResponse,
    PhotoUpdate,
    PhotoPresignedUrlResponse,
)
from app.services.storage_service import storage_service
from app.services.photo_service import photo_service

router = APIRouter()

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address)

# User-specific rate limiting store
_user_rate_limit_store: Dict[str, list] = defaultdict(list)

def check_user_rate_limit(user_id: str, endpoint: str, limit: int, window_seconds: int) -> bool:
    """
    Simple in-memory rate limiting for user-specific endpoints.
    
    Args:
        user_id: User identifier
        endpoint: Endpoint name for tracking
        limit: Maximum requests allowed
        window_seconds: Time window in seconds
        
    Returns:
        True if allowed, False if rate limited
    """
    key = f"{user_id}:{endpoint}"
    now = dt.now()
    
    # Clean old entries
    if key in _user_rate_limit_store:
        _user_rate_limit_store[key] = [
            ts for ts in _user_rate_limit_store[key]
            if (now - ts).total_seconds() < window_seconds
        ]
    
    # Check if limit exceeded
    if len(_user_rate_limit_store[key]) >= limit:
        return False
    
    # Record this request
    _user_rate_limit_store[key].append(now)
    return True


@router.post(
    "/presigned-upload",
    response_model=PresignedUploadResponse,
    responses={
        200: {"description": "Presigned URL generated successfully"},
        400: {"description": "Invalid file type or parameters"},
        401: {"description": "Unauthorized - authentication required"},
        429: {"description": "Too many requests - rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
@limiter.limit("10/minute")
async def generate_presigned_upload_url(
    request: Request,
    filename: str = Query(..., description="Original filename"),
    content_type: str = Query(..., description="MIME type (e.g., 'image/jpeg')"),
    max_size_bytes: int = Query(50 * 1024 * 1024, description="Maximum file size in bytes (default: 50MB)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate a presigned URL for direct photo upload to S3.
    
    This endpoint:
    1. Creates a Photo record in the database
    2. Generates a user-scoped S3 key
    3. Returns a presigned POST URL with enforced prefix conditions
    
    The client should POST the file directly to S3 using the returned URL and fields.
    """
    # Validate content type
    if content_type not in settings.ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {content_type}",
        )
    
    # Validate file size
    if max_size_bytes > settings.MAX_FILE_SIZE:
        max_size_bytes = settings.MAX_FILE_SIZE
    
    # Generate photo ID
    photo_id = uuid4()
    
    # Extract extension from filename
    extension = filename.split(".")[-1].lower() if "." in filename else "jpg"
    if extension not in ["jpg", "jpeg", "png", "webp", "heic"]:
        extension = "jpg"  # Default to jpg
    
    try:
        # Generate user-scoped S3 key
        s3_key = storage_service.generate_original_key(
            user_id=current_user.supabase_user_id,
            photo_id=photo_id,
            extension=extension,
        )
        
        # Generate presigned POST URL with conditions
        presigned_data = storage_service.generate_presigned_upload_url(
            user_id=current_user.supabase_user_id,
            photo_id=photo_id,
            category="raw",
            filename=f"original.{extension}",
            content_type=content_type,
            max_size_bytes=max_size_bytes,
            expiration=3600,  # 1 hour
        )
        
        # Create photo record in database (status: 'uploaded' after client uploads)
        # We'll update it after the client confirms upload
        photo = photo_service.create_photo(
            db=db,
            owner_id=current_user.supabase_user_id,
            original_key=s3_key,
            checksum_sha256="",  # Will be updated after upload
            size_bytes=None,  # Will be updated after upload
            mime_type=content_type,
            status="uploaded",
            commit=True,
        )
        
        logger.info(
            "Generated presigned upload URL",
            user_id=current_user.supabase_user_id,
            photo_id=str(photo_id),
            key=s3_key,
        )
        
        return PresignedUploadResponse(
            url=presigned_data["url"],
            fields=presigned_data["fields"],
            key=presigned_data["key"],
            photo_id=photo.id,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to generate presigned upload URL",
            user_id=current_user.supabase_user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate upload URL",
        )


@router.post(
    "/upload",
    response_model=PhotoResponse,
    responses={
        200: {"description": "Photo uploaded successfully"},
        400: {"description": "Invalid file type or size"},
        401: {"description": "Unauthorized - authentication required"},
        413: {"description": "File too large"},
        429: {"description": "Too many requests - rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
@limiter.limit("20/minute")
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload a photo directly to the server (alternative to presigned URL).
    
    This endpoint handles the upload server-side and creates the Photo record.
    For better performance, consider using /presigned-upload instead.
    """
    # Validate user has supabase_user_id set (required for storage operations)
    if not current_user.supabase_user_id or not current_user.supabase_user_id.strip():
        logger.error(
            "User missing supabase_user_id",
            user_id=str(current_user.id),
            email=current_user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account configuration error. Please contact support.",
        )
    
    # Validate file type
    if not file.content_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content type is required",
        )
    if file.content_type not in settings.ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}",
        )
    
    # Read file content
    file_content = await file.read()
    
    # Check file size
    if len(file_content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE // (1024*1024)}MB limit",
        )
    
    # Generate checksum
    checksum = hashlib.sha256(file_content).hexdigest()
    
    # Generate photo ID
    photo_id = uuid4()
    
    # Extract extension
    extension = file.filename.split(".")[-1].lower() if "." in file.filename else "jpg"
    if extension not in ["jpg", "jpeg", "png", "webp", "heic"]:
        extension = "jpg"
    
    try:
        # Upload to S3 using user-scoped key
        s3_url = storage_service.upload_file(
            file_content=file_content,
            user_id=current_user.supabase_user_id,
            photo_id=photo_id,
            category="raw",
            filename=f"original.{extension}",
            content_type=file.content_type,
        )
        
        # Generate thumbnail
        thumbnail_key = None
        try:
            # Use S3Service for thumbnail generation (utility method)
            from app.services.s3 import s3_service
            thumbnail_bytes = s3_service.generate_thumbnail(file_content)
            thumbnail_key = storage_service.generate_thumbnail_key(
                current_user.supabase_user_id,
                photo_id,
            )
            storage_service.upload_file(
                file_content=thumbnail_bytes,
                user_id=current_user.supabase_user_id,
                photo_id=photo_id,
                category="thumbs",
                filename=f"{photo_id}.jpg",
                content_type="image/jpeg",
            )
        except Exception as thumb_error:
            logger.warning(f"Failed to generate thumbnail: {thumb_error}")
            # Continue without thumbnail - non-critical
        
        # Create photo record
        photo = photo_service.create_photo(
            db=db,
            owner_id=current_user.supabase_user_id,
            original_key=storage_service.generate_original_key(
                current_user.supabase_user_id,
                photo_id,
                extension,
            ),
            checksum_sha256=checksum,
            size_bytes=len(file_content),
            mime_type=file.content_type,
            thumbnail_key=thumbnail_key,
            status="ready",
            commit=True,
        )
        
        logger.info(
            "Photo uploaded successfully",
            user_id=current_user.supabase_user_id,
            photo_id=str(photo.id),
        )
        
        # Generate presigned URLs for response
        original_url = storage_service.generate_presigned_download_url(
            photo.original_key,
            current_user.supabase_user_id,
        )
        thumbnail_url = None
        if photo.thumbnail_key:
            thumbnail_url = storage_service.generate_presigned_download_url(
                photo.thumbnail_key,
                current_user.supabase_user_id,
            )
        
        return PhotoResponse(
            id=photo.id,
            owner_id=photo.owner_id,
            original_key=photo.original_key,
            processed_key=photo.processed_key,
            thumbnail_key=photo.thumbnail_key,
            storage_bucket=photo.storage_bucket,
            status=photo.status,
            size_bytes=photo.size_bytes,
            mime_type=photo.mime_type,
            checksum_sha256=photo.checksum_sha256,
            metadata=photo.metadata_json,
            created_at=photo.created_at,
            updated_at=photo.updated_at,
            original_url=original_url,
            thumbnail_url=thumbnail_url,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        # Safely get user info for logging
        user_id_str = str(current_user.id) if current_user else "unknown"
        supabase_user_id_str = getattr(current_user, "supabase_user_id", None) if current_user else None
        
        logger.error(
            "Failed to upload photo",
            user_id=user_id_str,
            supabase_user_id=supabase_user_id_str,
            error=str(e),
            error_type=type(e).__name__,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload photo: {str(e)}",
        )


@router.get(
    "/",
    response_model=PhotoListResponse,
    responses={
        200: {"description": "Photos listed successfully"},
        401: {"description": "Unauthorized - authentication required"},
        429: {"description": "Too many requests - rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
@limiter.limit("60/minute")
async def list_photos(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of photos to return"),
    offset: int = Query(0, ge=0, description="Number of photos to skip"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List photos for the current user.
    
    All queries are automatically scoped to the authenticated user.
    """
    try:
        # Build status filter
        statuses = None
        if status_filter:
            statuses = [status_filter]
        
        # Get photos (automatically scoped by owner_id)
        photos = photo_service.list_photos(
            db=db,
            owner_id=current_user.supabase_user_id,
            statuses=statuses,
            limit=limit,
            offset=offset,
        )
        
        # Get total count (exclude deleted by default, unless explicitly requested)
        total_query = db.query(Photo).filter(Photo.owner_id == current_user.supabase_user_id)
        if status_filter:
            total_query = total_query.filter(Photo.status == status_filter)
        else:
            # By default, exclude deleted photos from count
            total_query = total_query.filter(Photo.status != "deleted")
        total = total_query.count()
        
        # Generate presigned URLs for each photo
        photo_responses = []
        for photo in photos:
            original_url = storage_service.generate_presigned_download_url(
                photo.original_key,
                current_user.supabase_user_id,
            )
            
            processed_url = None
            if photo.processed_key:
                processed_url = storage_service.generate_presigned_download_url(
                    photo.processed_key,
                    current_user.supabase_user_id,
                )
            
            thumbnail_url = None
            if photo.thumbnail_key:
                thumbnail_url = storage_service.generate_presigned_download_url(
                    photo.thumbnail_key,
                    current_user.supabase_user_id,
                )
            
            photo_responses.append(
                PhotoResponse(
                    id=photo.id,
                    owner_id=photo.owner_id,
                    original_key=photo.original_key,
                    processed_key=photo.processed_key,
                    thumbnail_key=photo.thumbnail_key,
                    storage_bucket=photo.storage_bucket,
                    status=photo.status,
                    size_bytes=photo.size_bytes,
                    mime_type=photo.mime_type,
                    checksum_sha256=photo.checksum_sha256,
                    metadata=photo.metadata_json,
                    created_at=photo.created_at,
                    updated_at=photo.updated_at,
                    original_url=original_url,
                    processed_url=processed_url,
                    thumbnail_url=thumbnail_url,
                )
            )
        
        return PhotoListResponse(
            photos=photo_responses,
            total=total,
            limit=limit,
            offset=offset,
        )
        
    except Exception as e:
        logger.error(
            "Failed to list photos",
            user_id=current_user.supabase_user_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list photos",
        )


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo(
    photo_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a specific photo by ID.
    
    Returns 404 if photo doesn't exist or doesn't belong to the user.
    """
    photo = photo_service.get_photo(
        db=db,
        owner_id=current_user.supabase_user_id,
        photo_id=photo_id,
    )
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )
    
    # Generate presigned URLs
    original_url = storage_service.generate_presigned_download_url(
        photo.original_key,
        current_user.supabase_user_id,
    )
    
    processed_url = None
    if photo.processed_key:
        processed_url = storage_service.generate_presigned_download_url(
            photo.processed_key,
            current_user.supabase_user_id,
        )
    
    thumbnail_url = None
    if photo.thumbnail_key:
        thumbnail_url = storage_service.generate_presigned_download_url(
            photo.thumbnail_key,
            current_user.supabase_user_id,
        )
    
    return PhotoResponse(
        id=photo.id,
        owner_id=photo.owner_id,
        original_key=photo.original_key,
        processed_key=photo.processed_key,
        thumbnail_key=photo.thumbnail_key,
        storage_bucket=photo.storage_bucket,
        status=photo.status,
        size_bytes=photo.size_bytes,
        mime_type=photo.mime_type,
        checksum_sha256=photo.checksum_sha256,
        metadata=photo.metadata_json,
        created_at=photo.created_at,
        updated_at=photo.updated_at,
        original_url=original_url,
        processed_url=processed_url,
        thumbnail_url=thumbnail_url,
    )


@router.get(
    "/{photo_id}/download-url",
    response_model=PhotoPresignedUrlResponse,
    responses={
        200: {"description": "Download URL generated successfully"},
        400: {"description": "Invalid key type"},
        401: {"description": "Unauthorized - authentication required"},
        404: {"description": "Photo not found"},
        429: {"description": "Too many requests - rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
@limiter.limit("100/minute")
async def get_photo_download_url(
    request: Request,
    photo_id: UUID,
    key_type: str = Query("original", description="Key type: 'original', 'processed', or 'thumbnail'"),
    expiration: int = Query(3600, ge=60, le=86400, description="URL expiration in seconds"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a presigned download URL for a photo.
    
    Validates ownership before generating the URL.
    """
    photo = photo_service.get_photo(
        db=db,
        owner_id=current_user.supabase_user_id,
        photo_id=photo_id,
    )
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )
    
    # Determine which key to use
    s3_key = None
    if key_type == "original":
        s3_key = photo.original_key
    elif key_type == "processed":
        s3_key = photo.processed_key
    elif key_type == "thumbnail":
        s3_key = photo.thumbnail_key
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid key_type: {key_type}. Must be 'original', 'processed', or 'thumbnail'",
        )
    
    if not s3_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{key_type} key not available for this photo",
        )
    
    try:
        url = storage_service.generate_presigned_download_url(
            s3_key,
            current_user.supabase_user_id,
            expiration=expiration,
        )
        
        return PhotoPresignedUrlResponse(
            url=url,
            expires_in=expiration,
        )
        
    except ValueError as e:
        # Ownership validation failed
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )


@router.put("/{photo_id}", response_model=PhotoResponse)
async def update_photo(
    photo_id: UUID,
    photo_update: PhotoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update photo metadata.
    
    Only metadata can be updated. Ownership is validated.
    """
    photo = photo_service.get_photo(
        db=db,
        owner_id=current_user.supabase_user_id,
        photo_id=photo_id,
    )
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )
    
    # Update metadata if provided
    if photo_update.metadata is not None:
        photo.metadata_json = photo_update.metadata
        db.commit()
        db.refresh(photo)
    
    # Generate presigned URLs
    original_url = storage_service.generate_presigned_download_url(
        photo.original_key,
        current_user.supabase_user_id,
    )
    
    return PhotoResponse(
        id=photo.id,
        owner_id=photo.owner_id,
        original_key=photo.original_key,
        processed_key=photo.processed_key,
        thumbnail_key=photo.thumbnail_key,
        storage_bucket=photo.storage_bucket,
        status=photo.status,
        size_bytes=photo.size_bytes,
        mime_type=photo.mime_type,
        checksum_sha256=photo.checksum_sha256,
        metadata=photo.metadata_json,
        created_at=photo.created_at,
        updated_at=photo.updated_at,
        original_url=original_url,
    )


@router.delete(
    "/{photo_id}",
    responses={
        200: {"description": "Photo deleted successfully"},
        401: {"description": "Unauthorized - authentication required"},
        404: {"description": "Photo not found"},
        429: {"description": "Too many requests - rate limit exceeded"},
        500: {"description": "Internal server error"},
    },
)
async def delete_photo(
    request: Request,
    photo_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a photo (soft delete).
    
    Marks the photo as 'deleted' status. S3 objects are not deleted immediately
    (can be cleaned up by background job after retention period).
    
    **Rate Limited:** 10 deletions per hour per user.
    """
    # User-specific rate limiting for deletions
    if not check_user_rate_limit(str(current_user.id), "delete_photo", limit=10, window_seconds=3600):
        ip_address = request.client.host if request.client else None
        logger.warning(
            "Rate limit exceeded for photo deletion",
            extra={
                "event_type": "rate_limit_exceeded",
                "user_id": str(current_user.id),
                "endpoint": "delete_photo",
                "ip_address": ip_address,
                "limit": "10/hour",
            }
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many deletion requests. Please wait before deleting again."
        )
    
    photo = photo_service.get_photo(
        db=db,
        owner_id=current_user.supabase_user_id,
        photo_id=photo_id,
    )
    
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo not found",
        )
    
    # Soft delete
    success = photo_service.delete_photo(
        db=db,
        owner_id=current_user.supabase_user_id,
        photo_id=photo_id,
        commit=True,
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete photo",
        )
    
    logger.info(
        "Photo deleted",
        user_id=current_user.supabase_user_id,
        photo_id=str(photo_id),
    )
    
    return {"message": "Photo deleted successfully"}

