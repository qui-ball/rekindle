"""
Jobs API endpoints - new architecture
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from loguru import logger

from app.api.deps import get_db
from app.core.config import settings
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
    db: Session = Depends(get_db),
):
    """
    Upload an image and create a new job
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
        # Create job record
        job = Job(email=email)
        db.add(job)
        db.flush()  # Get the job ID

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
            job_id=str(job.id),
            extension=extension,
            content_type=file.content_type,
        )

        # Generate and upload thumbnail
        try:
            thumbnail_url = s3_service.upload_job_thumbnail(
                image_content=file_content,
                job_id=str(job.id),
                extension=extension
            )
            # Extract S3 key from URL
            thumbnail_key = s3_service.extract_key_from_url(thumbnail_url)
            job.thumbnail_s3_key = thumbnail_key
            logger.info(f"Thumbnail generated for job {job.id}: {thumbnail_key}")
        except Exception as thumb_error:
            logger.error(f"Failed to generate thumbnail for job {job.id}: {thumb_error}")
            # Continue without thumbnail - non-critical error

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


@router.post("/jobs/{job_id}/restore", response_model=RestoreAttemptResponse)
async def create_restore_attempt(
    job_id: UUID,
    restore_data: RestoreAttemptCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new restore attempt for a job
    """
    # Verify job exists
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
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


@router.post("/jobs/{job_id}/animate", response_model=AnimationAttemptResponse)
async def create_animation_attempt(
    job_id: UUID,
    animation_data: AnimationAttemptCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new animation attempt for a job
    """
    # Verify job and restore attempt exist
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

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
        # Queue the animation task
        job_tasks.process_animation.delay(
            str(job_id),
            str(animation_data.restore_id),
            animation_data.model,
            animation_data.params or {},
        )

        # Create animation attempt record (will be updated by worker)
        animation = AnimationAttempt(
            job_id=job_id,
            restore_id=animation_data.restore_id,
            preview_s3_key="",  # Will be updated by worker
            model=animation_data.model,
            params=animation_data.params,
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


@router.get("/jobs/{job_id}", response_model=JobWithRelations)
async def get_job(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Get a job with all its restore and animation attempts
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Convert to response model with presigned URLs
    thumbnail_url = None
    if job.thumbnail_s3_key:
        try:
            thumbnail_url = s3_service.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": s3_service.bucket, "Key": job.thumbnail_s3_key},
                ExpiresIn=3600  # 1 hour expiration
            )
        except Exception as e:
            logger.error(f"Error generating presigned URL for thumbnail {job.thumbnail_s3_key}: {e}")
    
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

    # Add restore attempts with URLs
    for restore in job.restore_attempts:
        restore_dict = {
            "id": restore.id,
            "job_id": restore.job_id,
            "s3_key": restore.s3_key,
            "model": restore.model,
            "params": restore.params,
            "created_at": restore.created_at,
        }
        if restore.s3_key and restore.s3_key != "pending":
            restore_dict["url"] = s3_service.get_s3_url(restore.s3_key)
        job_dict["restore_attempts"].append(restore_dict)

    # Add animation attempts with URLs
    for animation in job.animation_attempts:
        animation_dict = {
            "id": animation.id,
            "job_id": animation.job_id,
            "restore_id": animation.restore_id,
            "preview_s3_key": animation.preview_s3_key,
            "result_s3_key": animation.result_s3_key,
            "thumb_s3_key": animation.thumb_s3_key,
            "model": animation.model,
            "params": animation.params,
            "created_at": animation.created_at,
        }
        if animation.preview_s3_key and animation.preview_s3_key != "pending":
            animation_dict["preview_url"] = s3_service.get_s3_url(
                animation.preview_s3_key
            )
        if animation.result_s3_key:
            animation_dict["result_url"] = s3_service.get_s3_url(
                animation.result_s3_key
            )
        if animation.thumb_s3_key:
            animation_dict["thumb_url"] = s3_service.get_s3_url(
                animation.thumb_s3_key
            )
        job_dict["animation_attempts"].append(animation_dict)

    return JobWithRelations(**job_dict)


@router.get("/jobs/{job_id}/image-url")
async def get_job_image_url(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Get presigned URL for a job's uploaded image
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    
    # Generate presigned URL for the uploaded image
    key = f"uploaded/{job_id}.jpg"
    try:
        presigned_url = s3_service.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": s3_service.bucket, "Key": key},
            ExpiresIn=3600  # 1 hour expiration
        )
        return {"url": presigned_url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating presigned URL: {str(e)}"
        )


@router.get("/jobs", response_model=List[JobResponse])
async def list_jobs(
    email: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    List jobs with optional email filter and thumbnail URLs
    """
    query = db.query(Job)
    if email:
        query = query.filter(Job.email == email)
    
    jobs = query.offset(skip).limit(limit).all()
    
    # Convert to response format with thumbnail presigned URLs
    job_responses = []
    for job in jobs:
        job_dict = {
            "id": job.id,
            "email": job.email,
            "created_at": job.created_at,
            "selected_restore_id": job.selected_restore_id,
            "latest_animation_id": job.latest_animation_id,
            "thumbnail_s3_key": job.thumbnail_s3_key,
            "thumbnail_url": None
        }
        
        # Generate presigned URL for thumbnail if key exists
        if job.thumbnail_s3_key:
            try:
                job_dict["thumbnail_url"] = s3_service.s3_client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": s3_service.bucket, "Key": job.thumbnail_s3_key},
                    ExpiresIn=3600  # 1 hour expiration
                )
            except Exception as e:
                logger.error(f"Error generating presigned URL for thumbnail {job.thumbnail_s3_key}: {e}")
        
        job_responses.append(JobResponse(**job_dict))
    
    return job_responses


@router.delete("/jobs/{job_id}")
async def delete_job(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Delete a job and all its associated data
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
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