"""
Celery tasks for job processing - new architecture
"""

from celery import current_task
from sqlalchemy.orm import Session
from uuid import UUID
from loguru import logger
from typing import Dict, Any, Optional
import json

from app.workers.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.jobs import Job, RestoreAttempt, AnimationAttempt
from app.services.s3 import s3_service
from app.services.comfyui import comfyui_service


@celery_app.task(bind=True)
def process_restoration(
    self, 
    job_id: str, 
    model: Optional[str] = None, 
    params: Dict[str, Any] = None
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
        
        logger.info(f"Starting restoration for job {job_id}")
        
        # Download processed image from S3
        processed_key = f"processed/{job_id}.jpg"  # Default extension
        # Try common extensions if default fails
        image_data = None
        for ext in ["jpg", "png", "webp", "heic"]:
            try:
                key = f"processed/{job_id}.{ext}"
                image_data = s3_service.download_file(key)
                processed_key = key
                break
            except Exception:
                continue
        
        if not image_data:
            raise ValueError(f"No processed image found for job {job_id}")
        
        # Extract restoration parameters
        denoise = params.get("denoise", 0.7)
        megapixels = params.get("megapixels", 1.0)
        
        # Process with ComfyUI
        restored_image_data = comfyui_service.restore_image(
            image_data=image_data,
            filename=f"job_{job_id}.jpg",
            denoise=denoise,
            megapixels=megapixels,
        )
        
        # Create restore attempt record
        restore = RestoreAttempt(
            job_id=job_uuid,
            s3_key="",  # Will be set below
            model=model or "comfyui_default",
            params=params,
        )
        db.add(restore)
        db.flush()  # Get the restore ID
        
        # Upload restored image to S3
        restored_url = s3_service.upload_restored_image(
            image_content=restored_image_data,
            job_id=job_id,
            restore_id=str(restore.id),
            extension="jpg",
        )
        
        # Update restore attempt with S3 key
        restore.s3_key = f"restored/{job_id}/{restore.id}.jpg"
        
        # Update job's selected restore
        job.selected_restore_id = restore.id
        
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
                model=model or "comfyui_default",
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
    params: Dict[str, Any] = None
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
        
        restore = db.query(RestoreAttempt).filter(
            RestoreAttempt.id == restore_uuid
        ).first()
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
        
        # For now, just copy the restored image as a "preview"
        # In production, this would be the actual animated video
        preview_url = s3_service.upload_animation(
            video_content=restored_image_data,  # Placeholder
            job_id=job_id,
            animation_id=str(animation.id),
            is_preview=True,
        )
        
        # Create thumbnail (for now, same as restored image)
        thumb_url = s3_service.upload_thumbnail(
            image_content=restored_image_data,
            job_id=job_id,
            animation_id=str(animation.id),
        )
        
        # Update animation attempt with S3 keys
        animation.preview_s3_key = f"animated/{job_id}/{animation.id}_preview.mp4"
        animation.thumb_s3_key = f"thumbnails/{job_id}/{animation.id}.jpg"
        
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
        animation = db.query(AnimationAttempt).filter(
            AnimationAttempt.id == animation_uuid
        ).first()
        if not animation:
            raise ValueError(f"Animation attempt {animation_id} not found")
        
        logger.info(f"Generating HD result for animation {animation_id}")
        
        # TODO: Implement actual HD generation
        # For now, we'll use the preview as placeholder
        
        # Download preview
        preview_data = s3_service.download_file(animation.preview_s3_key)
        
        # Upload as "result" (in production, this would be HD version)
        result_url = s3_service.upload_animation(
            video_content=preview_data,
            job_id=job_id,
            animation_id=animation_id,
            is_preview=False,
        )
        
        # Update animation attempt with result S3 key
        animation.result_s3_key = f"animated/{job_id}/{animation_id}_result.mp4"
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
            f"processed/{job_id}",
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