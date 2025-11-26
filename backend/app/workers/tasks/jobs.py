"""
Celery tasks for job processing - new architecture
"""

from celery import current_task
from sqlalchemy.orm import Session
from uuid import UUID
from loguru import logger
from typing import Dict, Any, Optional
from pathlib import Path
import json
import random

from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.jobs import Job, RestoreAttempt, AnimationAttempt
from app.models.photo import Photo
from app.services.s3 import s3_service
from app.services.comfyui import comfyui_service


@celery_app.task(bind=True)
def process_restoration(
    self, job_id: str, model: Optional[str] = None, params: Dict[str, Any] = None
):
    """
    Process image restoration for a job

    Args:
        job_id: UUID string of the job
        model: Optional model name to use
        params: Optional parameters for the restoration
    """
    db = SessionLocal()
    job_uuid = UUID(job_id)

    if params is None:
        params = {}

    try:
        # Get the job from database
        job = db.query(Job).filter(Job.id == job_uuid).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        logger.info(
            f"Starting restoration for job {job_id}, mode: {settings.COMFYUI_MODE}"
        )

        # Check if this is a photo-based restoration (job_id = photo_id)
        # If so, download from the photo's original_key instead of job-based path
        photo = db.query(Photo).filter(Photo.id == job_uuid).first()
        image_data = None
        uploaded_key = None
        
        if photo:
            # This is a photo-based restoration - use photo's original_key
            logger.info(f"Photo-based restoration detected, using original_key: {photo.original_key}")
            try:
                # Use storage_service to download from user-scoped storage
                from app.services.storage_service import storage_service
                image_data = storage_service.download_file(
                    photo.original_key,
                    photo.owner_id
                )
                uploaded_key = photo.original_key
            except Exception as e:
                logger.error(f"Failed to download photo original_key {photo.original_key}: {e}")
                raise ValueError(f"Failed to download photo image: {e}")
        else:
            # Legacy job-based restoration - try job-based paths
            uploaded_key = f"uploaded/{job_id}.jpg"  # Default extension
            # Try common extensions if default fails
            for ext in ["jpg", "png", "webp", "heic"]:
                try:
                    key = f"uploaded/{job_id}.{ext}"
                    image_data = s3_service.download_file(key)
                    uploaded_key = key
                    break
                except Exception:
                    continue

        if not image_data:
            raise ValueError(f"No uploaded image found for job {job_id}")

        # Extract restoration parameters
        denoise = params.get("denoise", 0.7)
        megapixels = params.get("megapixels", 1.0)

        # In development, always use pod mode and just copy the image (no ComfyUI needed)
        # In production, respect COMFYUI_MODE setting
        use_dev_copy = settings.ENVIRONMENT == "development"
        
        # Route based on mode
        if settings.COMFYUI_MODE == "serverless" and not use_dev_copy:
            # Serverless mode - submit and exit
            from app.services.runpod_serverless import runpod_serverless_service

            # Upload image to network volume
            volume_path = runpod_serverless_service.upload_image_to_volume(
                image_data=image_data, job_id=job_id, extension="jpg"
            )

            # ===== FULL RESTORE WORKFLOW (Uncomment this section when ready) =====
            # workflow_path = (
            #     Path(__file__).parent.parent.parent / "workflows" / "restore.json"
            # )
            # with open(workflow_path, "r") as f:
            #     workflow = json.load(f)
            # # Update workflow parameters
            # workflow["78"]["inputs"]["image"] = f"job_{job_id}.jpg"  # Filename only
            # workflow["93"]["inputs"]["megapixels"] = megapixels
            # workflow["3"]["inputs"]["denoise"] = denoise
            # workflow["3"]["inputs"]["seed"] = random.randint(1, 1000000)
            # ===== END FULL RESTORE WORKFLOW =====

            # ===== DUMMY WORKFLOW FOR TESTING (Comment out when using restore) =====
            workflow_path = (
                Path(__file__).parent.parent.parent
                / "workflows"
                / "dummy_workflow.json"
            )
            with open(workflow_path, "r") as f:
                workflow = json.load(f)
            # Update input image path for dummy workflow (node 1 = LoadImage)
            workflow["1"]["inputs"]["image"] = f"job_{job_id}.jpg"
            # ===== END DUMMY WORKFLOW =====

            # Submit job with webhook
            webhook_url = (
                f"{settings.BACKEND_BASE_URL}/api/v1/webhooks/runpod-completion"
            )
            runpod_job_id = runpod_serverless_service.submit_job(
                workflow=workflow, webhook_url=webhook_url, job_id=job_id
            )

            # Create restore attempt record (pending state)
            restore = RestoreAttempt(
                job_id=job_uuid,
                s3_key="pending",  # Will be set by webhook
                model=model or "runpod_serverless",
                params={**params, "runpod_job_id": runpod_job_id},
            )
            db.add(restore)
            db.commit()

            logger.info(f"Submitted serverless job {runpod_job_id} for {job_id}")

            return {
                "status": "submitted",
                "job_id": job_id,
                "runpod_job_id": runpod_job_id,
                "restore_id": str(restore.id),
            }

        else:
            # Pod mode
            if use_dev_copy:
                # Development mode: just copy the image (quick, no ComfyUI needed)
                logger.info(f"Development mode: Copying image as restored version for job {job_id}")
                restored_image_data = image_data  # Simple copy for development
            else:
                # Production pod mode: use ComfyUI to actually restore
                restored_image_data = comfyui_service.restore_image(
                    image_data=image_data,
                    filename=f"job_{job_id}.jpg",
                    denoise=denoise,
                    megapixels=megapixels,
                )

            # Check if a restore attempt already exists (created by endpoint)
            # If so, use it; otherwise create a new one
            restore = db.query(RestoreAttempt).filter(
                RestoreAttempt.job_id == job_uuid,
                RestoreAttempt.s3_key == "",  # Not yet processed
            ).order_by(RestoreAttempt.created_at.desc()).first()
            
            if not restore:
                # Create new restore attempt record
                restore = RestoreAttempt(
                    job_id=job_uuid,
                    s3_key="",  # Will be set below
                    model=model or "comfyui_pod",
                    params=params,
                )
                db.add(restore)
            else:
                # Update existing restore attempt with model/params if provided
                if model:
                    restore.model = model
                if params:
                    restore.params = params
            
            db.flush()  # Get the restore ID

            # Generate timestamp ID for this restore attempt
            restore_timestamp_id = s3_service.generate_timestamp_id()

            # Upload restored image to S3
            # For photo-based restorations, use user-scoped storage
            # For legacy job-based restorations, use job-based storage
            if photo:
                # Photo-based: upload to user-scoped processed storage
                from app.services.storage_service import storage_service
                # Upload to user-scoped location (generates key internally)
                restored_url = storage_service.upload_file(
                    file_content=restored_image_data,
                    user_id=photo.owner_id,
                    photo_id=job_uuid,
                    category="processed",
                    filename=f"restored_{restore_timestamp_id}.jpg",
                    content_type="image/jpeg"
                )
                # Get the generated key
                processed_key = storage_service.generate_user_scoped_key(
                    user_id=photo.owner_id,
                    photo_id=job_uuid,
                    category="processed",
                    filename=f"restored_{restore_timestamp_id}.jpg"
                )
                restore.s3_key = processed_key
                logger.info(f"Uploaded restored image to user-scoped storage: {processed_key}")
            else:
                # Legacy job-based: upload to job-based storage
                restored_url = s3_service.upload_restored_image(
                    image_content=restored_image_data,
                    job_id=job_id,
                    restore_id=restore_timestamp_id,
                    extension="jpg",
                )
                restore.s3_key = f"restored/{job_id}/{restore_timestamp_id}.jpg"

            # Generate and upload thumbnail for restored image
            try:
                thumbnail_url = s3_service.upload_job_thumbnail(
                    image_content=restored_image_data, job_id=job_id, extension="jpg"
                )
                # Update job's thumbnail to the restored image thumbnail
                job.thumbnail_s3_key = f"thumbnails/{job_id}.jpg"
                logger.info(
                    f"Generated thumbnail for restored image {job_id}: {job.thumbnail_s3_key}"
                )
            except Exception as thumb_error:
                logger.error(
                    f"Failed to generate thumbnail for restored image {job_id}: {thumb_error}"
                )
                # Continue without thumbnail - non-critical error

            # Update job's selected restore
            job.selected_restore_id = restore.id

            # Update the associated Photo model if job_id matches a photo_id
            # (When restoration is triggered from a photo, job_id = photo_id)
            # Note: photo variable is already set above if this is a photo-based restoration
            if photo:
                # Update photo's processed_key to point to the restored image
                # For photo-based restorations, this is already in user-scoped storage
                photo.processed_key = restore.s3_key
                photo.status = "ready"
                logger.info(f"Updated photo {photo.id} with processed_key: {restore.s3_key}")

            db.commit()

            logger.success(f"Completed restoration {restore.id} for job {job_id}")

            return {
                "status": "success",
                "job_id": job_id,
                "restore_id": str(restore.id),
                "restored_url": restored_url,
            }

    except Exception as e:
        logger.error(f"Error processing restoration for job {job_id}: {e}")
        db.rollback()

        # Create failed restore attempt record
        try:
            restore = RestoreAttempt(
                job_id=job_uuid,
                s3_key="failed",
                model=model or f"comfyui_{settings.COMFYUI_MODE}",
                params={**params, "error": str(e)},
            )
            db.add(restore)
            db.commit()
        except Exception as db_error:
            logger.error(f"Error saving failure state: {db_error}")

        raise e

    finally:
        db.close()


@celery_app.task(bind=True)
def process_animation(
    self,
    job_id: str,
    restore_id: str,
    model: Optional[str] = None,
    params: Dict[str, Any] = None,
):
    """
    Process animation for a restored image

    Args:
        job_id: UUID string of the job
        restore_id: UUID string of the restore attempt
        model: Optional model name to use
        params: Optional parameters for the animation
    """
    db = SessionLocal()
    job_uuid = UUID(job_id)
    restore_uuid = UUID(restore_id)

    if params is None:
        params = {}

    try:
        # Get the job and restore attempt from database
        job = db.query(Job).filter(Job.id == job_uuid).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        restore = (
            db.query(RestoreAttempt).filter(RestoreAttempt.id == restore_uuid).first()
        )
        if not restore:
            raise ValueError(f"Restore attempt {restore_id} not found")

        logger.info(f"Starting animation for job {job_id}, restore {restore_id}")

        # Download restored image from S3
        restored_image_data = s3_service.download_file(restore.s3_key)

        # TODO: Implement actual animation processing
        # For now, we'll create placeholder data
        # In production, this would call your animation service

        # Create animation attempt record
        animation = AnimationAttempt(
            job_id=job_uuid,
            restore_id=restore_uuid,
            preview_s3_key="",  # Will be set below
            model=model or "animation_default",
            params=params,
        )
        db.add(animation)
        db.flush()  # Get the animation ID

        # Generate timestamp ID for this animation attempt
        animation_timestamp_id = s3_service.generate_timestamp_id()

        # For now, just copy the restored image as a "preview"
        # In production, this would be the actual animated video
        preview_url = s3_service.upload_animation(
            video_content=restored_image_data,  # Placeholder
            job_id=job_id,
            animation_id=animation_timestamp_id,
            is_preview=True,
        )

        # Create thumbnail (for now, same as restored image)
        thumb_url = s3_service.upload_thumbnail(
            image_content=restored_image_data,
            job_id=job_id,
            animation_id=animation_timestamp_id,
        )

        # Update animation attempt with S3 keys using timestamp
        animation.preview_s3_key = (
            f"animated/{job_id}/{animation_timestamp_id}_preview.mp4"
        )
        animation.thumb_s3_key = f"thumbnails/{job_id}/{animation_timestamp_id}.jpg"

        # Update job's latest animation
        job.latest_animation_id = animation.id

        db.commit()

        logger.success(f"Completed animation {animation.id} for job {job_id}")

        return {
            "status": "success",
            "job_id": job_id,
            "animation_id": str(animation.id),
            "preview_url": preview_url,
            "thumb_url": thumb_url,
        }

    except Exception as e:
        logger.error(f"Error processing animation for job {job_id}: {e}")
        db.rollback()

        # Create failed animation attempt record
        try:
            animation = AnimationAttempt(
                job_id=job_uuid,
                restore_id=restore_uuid,
                preview_s3_key="failed",
                model=model or "animation_default",
                params={**params, "error": str(e)},
            )
            db.add(animation)
            db.commit()
        except Exception as db_error:
            logger.error(f"Error saving failure state: {db_error}")

        raise e

    finally:
        db.close()


@celery_app.task(bind=True)
def generate_hd_result(
    self,
    job_id: str,
    animation_id: str,
):
    """
    Generate HD/paid result for an animation

    Args:
        job_id: UUID string of the job
        animation_id: UUID string of the animation attempt
    """
    db = SessionLocal()
    animation_uuid = UUID(animation_id)

    try:
        # Get the animation attempt from database
        animation = (
            db.query(AnimationAttempt)
            .filter(AnimationAttempt.id == animation_uuid)
            .first()
        )
        if not animation:
            raise ValueError(f"Animation attempt {animation_id} not found")

        logger.info(f"Generating HD result for animation {animation_id}")

        # TODO: Implement actual HD generation
        # For now, we'll use the preview as placeholder

        # Download preview
        preview_data = s3_service.download_file(animation.preview_s3_key)

        # Extract timestamp ID from the preview S3 key
        # Format: animated/job_id/timestamp_id_preview.mp4
        preview_key_parts = animation.preview_s3_key.split("/")
        timestamp_id = preview_key_parts[-1].replace("_preview.mp4", "")

        # Upload as "result" (in production, this would be HD version)
        result_url = s3_service.upload_animation(
            video_content=preview_data,
            job_id=job_id,
            animation_id=timestamp_id,
            is_preview=False,
        )

        # Update animation attempt with result S3 key
        animation.result_s3_key = f"animated/{job_id}/{timestamp_id}_result.mp4"
        db.commit()

        logger.success(f"Generated HD result for animation {animation_id}")

        return {
            "status": "success",
            "animation_id": animation_id,
            "result_url": result_url,
        }

    except Exception as e:
        logger.error(f"Error generating HD result for animation {animation_id}: {e}")
        db.rollback()
        raise e

    finally:
        db.close()


@celery_app.task(bind=True)
def cleanup_job_s3_files(self, job_id: str):
    """
    Clean up S3 files for a deleted job

    Args:
        job_id: UUID string of the job
    """
    try:
        logger.info(f"Cleaning up S3 files for job {job_id}")

        # List of S3 prefixes to clean up
        prefixes = [
            f"uploaded/{job_id}",
            f"restored/{job_id}/",
            f"animated/{job_id}/",
            f"thumbnails/{job_id}/",
            f"meta/{job_id}",
        ]

        # TODO: Implement batch S3 deletion
        # For now, log what would be deleted
        for prefix in prefixes:
            logger.info(f"Would delete S3 objects with prefix: {prefix}")

        return {
            "status": "success",
            "job_id": job_id,
            "message": "S3 cleanup completed",
        }

    except Exception as e:
        logger.error(f"Error cleaning up S3 files for job {job_id}: {e}")
        raise e
