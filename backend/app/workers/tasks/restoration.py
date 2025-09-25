"""
Celery task for image restoration
"""

from celery import current_task
from sqlalchemy.orm import Session
from uuid import UUID
from loguru import logger
from urllib.parse import urlparse

from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.restoration import RestorationJob, JobStatus
from app.services.s3 import s3_service
from app.services.comfyui import comfyui_service


@celery_app.task(bind=True)
def process_restoration(self, job_id: str):
    """
    Process image restoration job

    Args:
        job_id: UUID string of the restoration job
    """
    db = SessionLocal()
    job_uuid = UUID(job_id)

    try:
        # Get the job from database
        job = db.query(RestorationJob).filter(RestorationJob.id == job_uuid).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Update job status to processing
        job.status = JobStatus.PROCESSING
        db.commit()

        logger.info(f"Starting restoration for job {job_id}")

        # Download original image from S3
        # Extract S3 key from CloudFront URL robustly
        parsed = urlparse(job.original_image_url)
        original_key = parsed.path.lstrip("/")
        if not original_key:
            raise ValueError(
                f"Could not extract S3 key from URL: {job.original_image_url}"
            )
        original_image_data = s3_service.download_file(original_key)

        # Process with ComfyUI
        processed_image_data = comfyui_service.restore_image(
            image_data=original_image_data,
            filename=f"job_{job_id}.jpg",
            denoise=job.denoise,
            megapixels=1.0,
        )

        # Upload processed image to S3
        processed_url = s3_service.upload_image(
            image_content=processed_image_data,
            user_id=job.user_id,
            prefix="processed",
            extension="jpg",
        )

        # Update job with success
        job.status = JobStatus.COMPLETED
        job.processed_image_url = processed_url
        db.commit()

        logger.success(f"Completed restoration for job {job_id}")

        return {"status": "success", "job_id": job_id, "processed_url": processed_url}

    except Exception as e:
        logger.error(f"Error processing restoration job {job_id}: {e}")

        # Update job with failure
        try:
            job = db.query(RestorationJob).filter(RestorationJob.id == job_uuid).first()
            if job:
                job.status = JobStatus.FAILED
                job.error_message = str(e)
                db.commit()
        except Exception as db_error:
            logger.error(f"Error updating job status: {db_error}")

        # Re-raise the exception for Celery
        raise e

    finally:
        db.close()
