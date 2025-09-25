"""
Restoration API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List
import uuid

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.restoration import RestorationJob, JobStatus
from app.schemas.restoration import RestorationResponse, JobStatusResponse
from app.services import s3 as s3_module
from app.workers.tasks import restoration as restoration_tasks

router = APIRouter()


@router.post("/restore", response_model=RestorationResponse)
async def create_restoration_job(
    file: UploadFile = File(...),
    denoise: float = Form(default=0.7, ge=0.0, le=1.0),
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new image restoration job
    """
    # Validate file type using settings
    if file.content_type not in settings.ALLOWED_FILE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}",
        )

    # Read file content
    file_content = await file.read()

    # Check file size from settings
    if len(file_content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {settings.MAX_FILE_SIZE // (1024*1024)}MB limit",
        )

    try:
        # Upload original image to S3
        # Preserve extension and content type based on upload
        mime_to_ext = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/heic": "heic",
            "image/webp": "webp",
        }
        extension = mime_to_ext.get(file.content_type, "jpg")

        original_url = s3_module.s3_service.upload_image(
            image_content=file_content,
            user_id=current_user,
            prefix="original",
            extension=extension,
            content_type=file.content_type,
        )

        # Create job record in database
        job = RestorationJob(
            user_id=current_user,
            status=JobStatus.PENDING,
            original_image_url=original_url,
            denoise=denoise,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        # Queue the restoration task
        restoration_tasks.process_restoration.delay(str(job.id))

        return RestorationResponse(
            job_id=job.id,
            status=job.status,
            message="Restoration job created and queued for processing",
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating restoration job: {str(e)}",
        )


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: UUID,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get status of a restoration job
    """
    job = (
        db.query(RestorationJob)
        .filter(RestorationJob.id == job_id, RestorationJob.user_id == current_user)
        .first()
    )

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
        )

    return JobStatusResponse.model_validate(job)


@router.get("/jobs", response_model=List[JobStatusResponse])
async def list_user_jobs(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    """
    List user's restoration jobs
    """
    jobs = (
        db.query(RestorationJob)
        .filter(RestorationJob.user_id == current_user)
        .order_by(RestorationJob.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )

    return [JobStatusResponse.model_validate(job) for job in jobs]
