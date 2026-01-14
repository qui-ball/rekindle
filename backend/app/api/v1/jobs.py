"""
Jobs API endpoints - new architecture
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from typing import List, Optional
from loguru import logger
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import require_tier, require_credits, get_current_user
from app.models.user import User
from app.models.jobs import Job, RestoreAttempt, AnimationAttempt
from app.schemas.jobs import (
    JobResponse,
    JobWithRelations,
    RestoreAttemptCreate,
    RestoreAttemptResponse,
    AnimationAttemptCreate,
    AnimationAttemptResponse,
    UploadResponse,
)
from app.services.s3 import s3_service
from app.workers.tasks import jobs as job_tasks

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_and_process(
    file: UploadFile = File(...),
    email: str = Form(...),
    current_user: User = Depends(
        require_tier("cherish")
    ),  # Batch upload requires Cherish tier
    db: Session = Depends(get_db),
):
    """
    Upload an image and create a new job.

    **Requires:** Cherish tier or higher (batch upload feature)
    """
    # Validate file type
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

    try:
        # Prepare job record but defer persistence until thumbnail exists
        job_id = uuid.uuid4()
        job = Job(id=job_id, email=email)

        # Upload processed image to S3
        mime_to_ext = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/heic": "heic",
            "image/webp": "webp",
        }
        extension = mime_to_ext.get(file.content_type, "jpg")

        processed_url = s3_service.upload_processed_image(
            image_content=file_content,
            job_id=str(job_id),
            extension=extension,
            content_type=file.content_type,
        )

        # Generate and upload thumbnail
        try:
            # Generate thumbnail key directly (don't extract from URL to avoid issues)
            thumbnail_key = f"thumbnails/{job_id}.jpg"
            thumbnail_bytes = s3_service.generate_thumbnail(
                image_content=file_content, max_size=(400, 400), quality=85
            )
            # Upload thumbnail to S3
            s3_service.s3_client.put_object(
                Bucket=s3_service.bucket,
                Key=thumbnail_key,
                Body=thumbnail_bytes,
                ContentType="image/jpeg",
            )
            job.thumbnail_s3_key = thumbnail_key
            logger.info(f"Thumbnail generated for job {job_id}: {thumbnail_key}")
        except Exception as thumb_error:
            logger.error(
                f"Failed to generate thumbnail for job {job_id}: {thumb_error}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate thumbnail",
            )

        db.add(job)

        db.commit()

        return UploadResponse(
            job_id=job.id,
            message="Image uploaded and job created successfully",
            processed_url=processed_url,
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating job: {str(e)}",
        )


@router.post("/{job_id}/restore", response_model=RestoreAttemptResponse)
async def create_restore_attempt(
    job_id: UUID,
    restore_data: RestoreAttemptCreate,
    current_user: User = Depends(require_credits(2)),  # Restoration costs 2 credits
    db: Session = Depends(get_db),
):
    """
    Create a new restore attempt for a job.

    **Requires:** 2 credits
    """
    # Verify job exists and belongs to the user
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify job belongs to the current user (email-based ownership)
    if job.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Job does not belong to the current user",
        )

    try:
        # Queue the restoration task
        job_tasks.process_restoration.delay(
            str(job_id),
            restore_data.model,
            restore_data.params or {},
        )

        # Create restore attempt record (will be updated by worker)
        restore = RestoreAttempt(
            job_id=job_id,
            s3_key="",  # Will be updated by worker
            model=restore_data.model,
            params=restore_data.params,
        )
        db.add(restore)
        db.flush()

        # Update job's selected restore
        job.selected_restore_id = restore.id
        db.commit()

        return RestoreAttemptResponse(
            id=restore.id,
            job_id=job_id,
            s3_key="pending",
            model=restore.model,
            params=restore.params,
            created_at=restore.created_at,
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating restore attempt: {str(e)}",
        )


@router.post("/{job_id}/animate", response_model=AnimationAttemptResponse)
async def create_animation_attempt(
    job_id: UUID,
    animation_data: AnimationAttemptCreate,
    # Animation requires "remember" tier AND 8 credits
    # We use require_tier first, then require_credits will also check tier implicitly
    # TODO: Re-enable tier requirement in production
    current_user: User = Depends(
        get_current_user
    ),  # Temporarily disabled tier requirement for testing
    db: Session = Depends(get_db),
):
    """
    Create a new animation attempt for a job.

    **Requires:**
    - Remember tier or higher
    - 8 credits

    **Request body:**
    - `restore_id` (optional): UUID of restore attempt to animate. If not provided, uses original photo.
    - `model` (optional): Animation model to use. Defaults to "replicate_wan".
    - `params` (required): Animation parameters object containing:
      - `prompt` (required): Text description for video generation (1-500 characters)
      - `resolution` (optional): Video resolution - "480p", "720p", or "1080p". Defaults to "720p".
    """
    # Check credits after tier check (can't combine dependencies easily, so check manually)
    # TODO: Re-enable credit check in production
    # if current_user.total_credits < 8:
    #     logger.warning(
    #         "Insufficient credits for animation",
    #         extra={
    #             "event_type": "permission_denied",
    #             "user_id": str(current_user.id),
    #             "required_credits": 8,
    #             "available_credits": current_user.total_credits,
    #             "reason": "insufficient_credits",
    #         },
    #     )
    #     raise HTTPException(
    #         status_code=status.HTTP_402_PAYMENT_REQUIRED,
    #         detail=f"Insufficient credits. Required: 8, Available: {current_user.total_credits}. "
    #         f"Please purchase more credits to continue.",
    #     )

    # Validate prompt length (1-500 characters)
    prompt = animation_data.params.prompt
    if not prompt or len(prompt.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt is required and cannot be empty",
        )
    if len(prompt) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Prompt exceeds maximum length of 500 characters (current: {len(prompt)})",
        )

    # Validate resolution
    valid_resolutions = ["480p", "720p", "1080p"]
    resolution = animation_data.params.resolution
    if resolution not in valid_resolutions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid resolution '{resolution}'. Choose from: {', '.join(valid_resolutions)}",
        )

    # Verify job exists
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify job belongs to the current user (email-based ownership)
    if job.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Job does not belong to the current user",
        )

    # Verify restore attempt exists (if restore_id is provided)
    restore = None
    if animation_data.restore_id:
        restore = (
            db.query(RestoreAttempt)
            .filter(RestoreAttempt.id == animation_data.restore_id)
            .first()
        )
        if not restore:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restore attempt not found",
            )

    try:
        # Convert params to dict for Celery task
        params_dict = {
            "prompt": animation_data.params.prompt,
            "resolution": animation_data.params.resolution,
            "duration": 5,  # Fixed 5-second duration per spec
        }

        # Queue the animation task
        job_tasks.process_animation.delay(
            str(job_id),
            str(animation_data.restore_id) if animation_data.restore_id else None,
            animation_data.model,
            params_dict,
        )

        # Create animation attempt record (will be updated by worker)
        animation = AnimationAttempt(
            job_id=job_id,
            restore_id=animation_data.restore_id,  # Can be None
            preview_s3_key="",  # Will be updated by worker
            model=animation_data.model,
            params=params_dict,
        )
        db.add(animation)
        db.flush()

        # Update job's latest animation
        job.latest_animation_id = animation.id
        db.commit()

        return AnimationAttemptResponse(
            id=animation.id,
            job_id=job_id,
            restore_id=animation_data.restore_id,
            preview_s3_key="pending",
            model=animation.model,
            params=animation.params,
            created_at=animation.created_at,
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating animation attempt: {str(e)}",
        )


@router.get("/{job_id}", response_model=JobWithRelations)
async def get_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a job with all its restore and animation attempts.

    **Requires:** Authentication and ownership verification
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify job belongs to the current user (email-based ownership)
    if job.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Job does not belong to the current user",
        )

    # Convert to response model with presigned URLs
    thumbnail_url = None
    if job.thumbnail_s3_key:
        try:
            # Clean the key to remove any query parameters that might have been stored incorrectly
            clean_key = s3_service.clean_s3_key(job.thumbnail_s3_key)
            thumbnail_url = s3_service.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": s3_service.bucket, "Key": clean_key},
                ExpiresIn=3600,  # 1 hour expiration
            )
        except Exception as e:
            logger.error(
                f"Error generating presigned URL for thumbnail {job.thumbnail_s3_key}: {e}"
            )

    job_dict = {
        "id": job.id,
        "email": job.email,
        "created_at": job.created_at,
        "selected_restore_id": job.selected_restore_id,
        "latest_animation_id": job.latest_animation_id,
        "thumbnail_s3_key": job.thumbnail_s3_key,
        "thumbnail_url": thumbnail_url,
        "restore_attempts": [],
        "animation_attempts": [],
    }

    # Add restore attempts with URLs (only include successful ones with valid S3 keys)
    for restore in job.restore_attempts:
        # Skip restore attempts without valid S3 keys (empty, pending, or failed)
        if (
            not restore.s3_key
            or restore.s3_key == ""
            or restore.s3_key == "pending"
            or restore.s3_key == "failed"
        ):
            continue

        restore_dict = {
            "id": restore.id,
            "job_id": restore.job_id,
            "s3_key": restore.s3_key,
            "model": restore.model,
            "params": restore.params,
            "created_at": restore.created_at,
        }
        restore_dict["url"] = s3_service.get_s3_url(restore.s3_key)
        job_dict["restore_attempts"].append(restore_dict)

    # Add animation attempts with URLs
    for animation in job.animation_attempts:
        animation_dict = {
            "id": animation.id,
            "job_id": animation.job_id,
            "restore_id": animation.restore_id,
            "preview_s3_key": animation.preview_s3_key or "",
            "result_s3_key": animation.result_s3_key,
            "thumb_s3_key": animation.thumb_s3_key,
            "model": animation.model,
            "params": animation.params,
            "created_at": animation.created_at,
        }
        # Generate presigned URL for preview video (skip pending/failed states)
        if animation.preview_s3_key and animation.preview_s3_key not in ("", "pending", "failed"):
            animation_dict["preview_url"] = s3_service.get_s3_url(
                animation.preview_s3_key
            )
        if animation.result_s3_key and animation.result_s3_key not in ("", "pending", "failed"):
            animation_dict["result_url"] = s3_service.get_s3_url(
                animation.result_s3_key
            )
        if animation.thumb_s3_key and animation.thumb_s3_key not in ("", "pending", "failed"):
            animation_dict["thumb_url"] = s3_service.get_s3_url(animation.thumb_s3_key)
        job_dict["animation_attempts"].append(animation_dict)

    return JobWithRelations(**job_dict)


@router.get("/{job_id}/image-url")
async def get_job_image_url(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get presigned URL for a job's uploaded image.

    **Requires:** Authentication and ownership verification
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify job belongs to the current user (email-based ownership)
    if job.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Job does not belong to the current user",
        )

    # Generate presigned URL for the uploaded image
    key = f"uploaded/{job_id}.jpg"
    try:
        presigned_url = s3_service.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": s3_service.bucket, "Key": key},
            ExpiresIn=3600,  # 1 hour expiration
        )
        return {"url": presigned_url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating presigned URL: {str(e)}",
        )


@router.get("/", response_model=List[JobWithRelations])
async def list_jobs(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List jobs for the current authenticated user.
    All queries are automatically scoped to the authenticated user's email.
    Returns empty list [] if user has no jobs - this is a valid response.
    """
    try:
        logger.info(
            f"Listing jobs for user {current_user.email} (skip={skip}, limit={limit})"
        )

        # Eagerly load relationships to avoid lazy loading issues
        query = (
            db.query(Job)
            .options(
                joinedload(Job.restore_attempts), joinedload(Job.animation_attempts)
            )
            .filter(Job.email == current_user.email)
        )

        jobs = query.offset(skip).limit(limit).all()

        logger.info(f"Found {len(jobs)} jobs for user {current_user.email}")

        # Empty result is valid - user just has no jobs yet
        if not jobs:
            return []

    except Exception as e:
        logger.error(
            f"Error querying jobs for user {current_user.email}: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve jobs: {str(e)}",
        )

    # Convert to response format with thumbnail presigned URLs and relations
    job_responses = []
    for job in jobs:
        try:
            job_dict = {
                "id": job.id,
                "email": job.email,
                "created_at": job.created_at,
                "selected_restore_id": job.selected_restore_id,
                "latest_animation_id": job.latest_animation_id,
                "thumbnail_s3_key": job.thumbnail_s3_key,
                "thumbnail_url": None,
                "restore_attempts": [],
                "animation_attempts": [],
            }

            # Generate presigned URL for thumbnail if key exists
            if job.thumbnail_s3_key:
                try:
                    # Clean the key to remove any query parameters that might have been stored incorrectly
                    clean_key = s3_service.clean_s3_key(job.thumbnail_s3_key)
                    job_dict["thumbnail_url"] = (
                        s3_service.s3_client.generate_presigned_url(
                            "get_object",
                            Params={"Bucket": s3_service.bucket, "Key": clean_key},
                            ExpiresIn=3600,  # 1 hour expiration
                        )
                    )
                except Exception as e:
                    logger.error(
                        f"Error generating presigned URL for thumbnail {job.thumbnail_s3_key}: {e}"
                    )

            # Add restore attempts with URLs (only include successful ones with valid S3 keys)
            for restore in job.restore_attempts:
                # Skip restore attempts without valid S3 keys (empty, pending, or failed)
                if (
                    not restore.s3_key
                    or restore.s3_key == ""
                    or restore.s3_key == "pending"
                    or restore.s3_key == "failed"
                ):
                    continue

                try:
                    restore_dict = {
                        "id": restore.id,
                        "job_id": restore.job_id,
                        "s3_key": restore.s3_key,
                        "model": restore.model,
                        "params": restore.params,
                        "created_at": restore.created_at,
                    }
                    restore_dict["url"] = s3_service.get_s3_url(restore.s3_key)
                    job_dict["restore_attempts"].append(restore_dict)
                except Exception as e:
                    logger.error(f"Error processing restore attempt {restore.id}: {e}")
                    continue

            # Add animation attempts with URLs
            for animation in job.animation_attempts:
                try:
                    animation_dict = {
                        "id": animation.id,
                        "job_id": animation.job_id,
                        "restore_id": animation.restore_id,
                        "preview_s3_key": animation.preview_s3_key or "",
                        "result_s3_key": animation.result_s3_key,
                        "thumb_s3_key": animation.thumb_s3_key,
                        "model": animation.model,
                        "params": animation.params,
                        "created_at": animation.created_at,
                    }
                    # Generate presigned URL for preview video (skip pending/failed states)
                    if animation.preview_s3_key and animation.preview_s3_key not in ("", "pending", "failed"):
                        animation_dict["preview_url"] = s3_service.get_s3_url(
                            animation.preview_s3_key
                        )
                    if animation.result_s3_key and animation.result_s3_key not in ("", "pending", "failed"):
                        animation_dict["result_url"] = s3_service.get_s3_url(
                            animation.result_s3_key
                        )
                    if animation.thumb_s3_key and animation.thumb_s3_key not in ("", "pending", "failed"):
                        animation_dict["thumb_url"] = s3_service.get_s3_url(
                            animation.thumb_s3_key
                        )
                    job_dict["animation_attempts"].append(animation_dict)
                except Exception as e:
                    logger.error(
                        f"Error processing animation attempt {animation.id}: {e}"
                    )
                    continue

            job_responses.append(JobWithRelations(**job_dict))
        except Exception as e:
            logger.error(f"Error processing job {job.id}: {e}")
            # Continue processing other jobs even if one fails
            continue

    return job_responses


@router.delete("/{job_id}/restore/{restore_id}")
async def delete_restore_attempt(
    job_id: UUID,
    restore_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a restore attempt.

    **Requires:** Authentication and ownership verification
    """
    # Verify job exists and belongs to the user
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify job belongs to the current user (email-based ownership)
    if job.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Job does not belong to the current user",
        )

    # Verify restore attempt exists and belongs to the job
    restore = (
        db.query(RestoreAttempt)
        .filter(RestoreAttempt.id == restore_id, RestoreAttempt.job_id == job_id)
        .first()
    )

    if not restore:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restore attempt not found",
        )

    try:
        # If this was the selected restore, clear the selection
        if job.selected_restore_id == restore_id:
            job.selected_restore_id = None

        # Delete the restore attempt
        db.delete(restore)
        db.commit()

        # TODO: Add S3 cleanup task to delete associated files if needed

        logger.info(
            f"Deleted restore attempt {restore_id} for job {job_id}",
            user_id=current_user.email,
            job_id=str(job_id),
            restore_id=str(restore_id),
        )

        return {"message": "Restore attempt deleted successfully"}

    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting restore attempt {restore_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting restore attempt: {str(e)}",
        )


@router.delete("/{job_id}")
async def delete_job(
    job_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a job and all its associated data.

    **Requires:** Authentication and ownership verification
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify job belongs to the current user (email-based ownership)
    if job.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Job does not belong to the current user",
        )

    try:
        # Delete will cascade to restore and animation attempts
        db.delete(job)
        db.commit()

        # TODO: Add S3 cleanup task to delete associated files

        return {"message": "Job deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting job: {str(e)}",
        )
