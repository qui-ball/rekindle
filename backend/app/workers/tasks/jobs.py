"""
Celery tasks for job processing - new architecture
"""

import asyncio
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
from app.core.config import settings, BASE_DIR
from app.models.jobs import Job, RestoreAttempt, AnimationAttempt
from app.models.photo import Photo
from app.services.s3 import s3_service
from app.services.comfyui import comfyui_service
from app.services.replicate_service import (
    get_replicate_service,
    ReplicateError,
)
from app.services.image_processor import preprocess_image


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
            logger.info(
                f"Photo-based restoration detected, using original_key: {photo.original_key}"
            )

            # Check for concurrent restoration (reject if already processing)
            if photo.status == "processing":
                raise ValueError(
                    f"Photo {photo.id} is already being processed. "
                    "Please wait for the current restoration to complete."
                )

            # Mark photo as processing
            photo.status = "processing"
            db.commit()

            try:
                # Use storage_service to download from user-scoped storage
                from app.services.storage_service import storage_service

                image_data = storage_service.download_file(
                    photo.original_key, photo.owner_id
                )
                uploaded_key = photo.original_key
            except Exception as e:
                logger.error(
                    f"Failed to download photo original_key {photo.original_key}: {e}"
                )
                # Revert photo status on failure
                photo.status = "uploaded"
                db.commit()
                raise ValueError(f"Failed to download photo image: {e}")

            # ===== REPLICATE RESTORATION FOR PHOTO-BASED RESTORATIONS (WEBHOOK MODE) =====
            try:
                logger.info(f"Using Replicate API (webhook mode) for photo {photo.id} restoration")

                # Preprocess image (resize if needed, convert format)
                preprocess_result = preprocess_image(image_data)
                logger.info(
                    f"Image preprocessed: resized={preprocess_result.resized}, "
                    f"format_converted={preprocess_result.format_converted}, "
                    f"original={preprocess_result.original_dimensions}, "
                    f"new={preprocess_result.new_dimensions}"
                )

                # Upload preprocessed image to S3 and get presigned URL
                preprocessed_key = storage_service.generate_user_scoped_key(
                    user_id=photo.owner_id,
                    photo_id=photo.id,
                    category="raw",
                    filename="preprocessed.jpg",
                )
                storage_service.upload_file(
                    file_content=preprocess_result.image_bytes,
                    user_id=photo.owner_id,
                    photo_id=photo.id,
                    category="raw",
                    filename="preprocessed.jpg",
                    content_type="image/jpeg",
                )

                # Generate presigned URL for Replicate API
                presigned_url = s3_service.generate_presigned_download_url(preprocessed_key)
                logger.debug(f"Generated presigned URL for Replicate: {presigned_url[:100]}...")

                # Get custom prompt from params or use default
                custom_prompt = params.get("prompt")
                seed = params.get("seed")
                output_format = params.get("output_format", "jpg")
                output_quality = params.get("output_quality", 95)

                # Create pending restore attempt BEFORE calling Replicate
                restore = RestoreAttempt(
                    job_id=job_uuid,
                    s3_key="pending",  # Will be updated by webhook
                    model=model or "replicate_qwen",
                    params={
                        **params,
                        "provider": "replicate",
                        "output_format": output_format,
                        "output_quality": output_quality,
                        "preprocessing": {
                            "resized": preprocess_result.resized,
                            "original_dimensions": list(preprocess_result.original_dimensions),
                            "new_dimensions": list(preprocess_result.new_dimensions),
                            "format_converted": preprocess_result.format_converted,
                            "original_format": preprocess_result.original_format,
                        },
                    },
                )
                db.add(restore)
                db.commit()

                # Build webhook URL with photo_id
                webhook_url = f"{settings.BACKEND_BASE_URL}/api/v1/webhooks/replicate/{job_id}"
                logger.info(f"Webhook URL: {webhook_url}")

                # Create async prediction with webhook (non-blocking)
                replicate_service = get_replicate_service()
                prediction_id = replicate_service.create_prediction_with_webhook(
                    image_url=presigned_url,
                    webhook_url=webhook_url,
                    photo_id=job_id,
                    prompt=custom_prompt,
                    seed=seed,
                    output_format=output_format,
                    output_quality=output_quality,
                )

                # Update restore attempt with prediction ID
                restore.params = {**restore.params, "prediction_id": prediction_id}
                db.commit()

                logger.info(f"Replicate prediction {prediction_id} submitted for photo {photo.id}")

                # Return immediately - webhook will handle completion
                # Photo stays in "processing" status until webhook updates it
                return {
                    "status": "submitted",
                    "job_id": job_id,
                    "restore_id": str(restore.id),
                    "prediction_id": prediction_id,
                    "provider": "replicate",
                }

            except ReplicateError as e:
                logger.error(f"Replicate API error for photo {photo.id}: {e}")

                # Revert photo status to uploaded
                photo.status = "uploaded"

                # Update restore attempt to failed (if it was created)
                if 'restore' in locals():
                    restore.s3_key = "failed"
                    restore.params = {**restore.params, "error": e.to_dict()}
                else:
                    # Create failed restore attempt if we didn't get that far
                    restore = RestoreAttempt(
                        job_id=job_uuid,
                        s3_key="failed",
                        model=model or "replicate_qwen",
                        params={
                            **params,
                            "provider": "replicate",
                            "error": e.to_dict(),
                        },
                    )
                    db.add(restore)
                db.commit()

                raise ValueError(f"Replicate restoration failed: {e.message}")

            except Exception as e:
                logger.error(f"Unexpected error during Replicate restoration: {e}")

                # Revert photo status to uploaded
                photo.status = "uploaded"

                # Update restore attempt to failed (if it was created)
                if 'restore' in locals():
                    restore.s3_key = "failed"
                    restore.params = {**restore.params, "error": str(e)}

                db.commit()

                raise
            # ===== END REPLICATE RESTORATION =====
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
        prompt = params.get(
            "prompt",
            "Restore this old photo: remove scratches, dust spots, reflections, and noise; repair tears, folds, and damaged areas; correct fading and color drift; sharpen faces and fabric texture. Fill in any missing or cropped parts of the photo realistically, matching the original style, texture, and lighting. Preserve original faces, pose, clothing, and background without changing composition. Do not add new objects or distortions. Please also colourize the photo.",
        )

        # Route based on mode
        # Note: In serverless mode, we always submit to RunPod regardless of ENVIRONMENT
        # In pod mode, development will copy the image for quick testing
        if settings.COMFYUI_MODE == "serverless":
            # Serverless mode - submit and exit
            from app.services.runpod_serverless import runpod_serverless_service

            # Prepare image filename
            image_filename = f"job_{job_id}.jpg"

            # Upload image to network volume (only if S3 API is available)
            if runpod_serverless_service.s3_available:
                logger.info("Using S3 API to upload image to network volume")
                volume_path = runpod_serverless_service.upload_image_to_volume(
                    image_data=image_data, job_id=job_id, extension="jpg"
                )
            else:
                logger.info("S3 API not available - will send image in job payload")

            # ===== FULL RESTORE WORKFLOW =====
            workflow_path = BASE_DIR / "workflows" / "restore.json"
            with open(workflow_path, "r") as f:
                workflow = json.load(f)
            # Update workflow parameters
            workflow["78"]["inputs"][
                "image"
            ] = image_filename  # LoadImage: input filename
            workflow["93"]["inputs"][
                "megapixels"
            ] = megapixels  # ImageScaleToTotalPixels
            workflow["76"]["inputs"][
                "prompt"
            ] = prompt  # TextEncodeQwenImageEdit (positive prompt)
            workflow["3"]["inputs"]["denoise"] = denoise  # KSampler
            workflow["3"]["inputs"]["seed"] = random.randint(
                1, 1000000
            )  # KSampler: random seed
            # ===== END FULL RESTORE WORKFLOW =====

            # ===== DUMMY WORKFLOW FOR TESTING (Comment out when using restore) =====
            # workflow_path = BASE_DIR / "workflows" / "dummy_workflow.json"
            # with open(workflow_path, "r") as f:
            #     workflow = json.load(f)
            # # Update input image path for dummy workflow (node 1 = LoadImage)
            # workflow["1"]["inputs"]["image"] = image_filename
            # ===== END DUMMY WORKFLOW =====

            # Submit job with webhook
            webhook_url = (
                f"{settings.BACKEND_BASE_URL}/api/v1/webhooks/runpod-completion"
            )

            # Include image data in payload if S3 upload is disabled
            runpod_job_id = runpod_serverless_service.submit_job(
                workflow=workflow,
                webhook_url=webhook_url,
                job_id=job_id,
                image_data=(
                    None if runpod_serverless_service.s3_available else image_data
                ),
                image_filename=(
                    None if runpod_serverless_service.s3_available else image_filename
                ),
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
            if settings.ENVIRONMENT == "development":
                # Development mode: just copy the image (quick, no ComfyUI needed)
                logger.info(
                    f"Development mode: Copying image as restored version for job {job_id}"
                )
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
            restore = (
                db.query(RestoreAttempt)
                .filter(
                    RestoreAttempt.job_id == job_uuid,
                    RestoreAttempt.s3_key == "",  # Not yet processed
                )
                .order_by(RestoreAttempt.created_at.desc())
                .first()
            )

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
                    content_type="image/jpeg",
                )
                # Get the generated key
                processed_key = storage_service.generate_user_scoped_key(
                    user_id=photo.owner_id,
                    photo_id=job_uuid,
                    category="processed",
                    filename=f"restored_{restore_timestamp_id}.jpg",
                )
                restore.s3_key = processed_key
                logger.info(
                    f"Uploaded restored image to user-scoped storage: {processed_key}"
                )
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
                logger.info(
                    f"Updated photo {photo.id} with processed_key: {restore.s3_key}"
                )

            db.commit()

            logger.success(f"Completed restoration {restore.id} for job {job_id}")

            # Note: SSE notifications are handled by webhooks for async providers.
            # For synchronous pod mode, the frontend should poll or refresh.

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
    restore_id: Optional[str] = None,
    model: Optional[str] = None,
    params: Dict[str, Any] = None,
):
    """
    Process animation for an image (restored or original)

    Args:
        job_id: UUID string of the job
        restore_id: Optional UUID string of the restore attempt. If None, uses original photo
        model: Optional model name to use
        params: Optional parameters for the animation
    """
    db = SessionLocal()
    job_uuid = UUID(job_id)
    restore_uuid = UUID(restore_id) if restore_id else None

    if params is None:
        params = {}

    try:
        # Get the job from database
        job = db.query(Job).filter(Job.id == job_uuid).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Get restore attempt if restore_id is provided
        restore = None
        if restore_uuid:
            restore = (
                db.query(RestoreAttempt)
                .filter(RestoreAttempt.id == restore_uuid)
                .first()
            )
            if not restore:
                raise ValueError(f"Restore attempt {restore_id} not found")

        logger.info(
            f"Starting animation for job {job_id}, restore {restore_id or 'original'}, mode: {settings.COMFYUI_MODE}"
        )

        # Download image from S3
        if restore:
            # Use restored image
            image_data = s3_service.download_file(restore.s3_key)
        else:
            # Use original photo
            photo = db.query(Photo).filter(Photo.id == job_uuid).first()
            if not photo:
                raise ValueError(f"Photo {job_id} not found")

            from app.services.storage_service import storage_service

            image_data = storage_service.download_file(
                photo.original_key, photo.owner_id
            )

        # Extract animation parameters
        prompt = params.get(
            "prompt",
            "Make this photo come to life with subtle, natural movement. The person should blink, smile slightly, and move their head gently. Keep the background stable with minimal motion.",
        )
        width = params.get("width", 480)
        height = params.get("height", 832)
        length = params.get("length", 81)  # Number of frames
        fps = params.get("fps", 30)

        # Route based on mode
        if settings.COMFYUI_MODE == "serverless":
            # Serverless mode - submit and exit
            from app.services.runpod_serverless import runpod_serverless_service

            # Prepare image filename
            image_filename = f"job_{job_id}_restore_{restore_id}.jpg"

            # Upload image to network volume (only if S3 API is available)
            if runpod_serverless_service.s3_available:
                logger.info("Using S3 API to upload image to network volume")
                runpod_serverless_service.upload_image_to_volume(
                    image_data=restored_image_data, job_id=job_id, extension="jpg"
                )
            else:
                logger.info("S3 API not available - will send image in job payload")

            # ===== ANIMATION WORKFLOW =====
            workflow_path = BASE_DIR / "workflows" / "animate.json"
            with open(workflow_path, "r") as f:
                workflow = json.load(f)
            # Update workflow parameters
            workflow["97"]["inputs"]["image"] = image_filename  # LoadImage
            workflow["93"]["inputs"]["prompt"] = prompt  # Positive prompt
            workflow["98"]["inputs"]["width"] = width  # WanImageToVideo
            workflow["98"]["inputs"]["height"] = height  # WanImageToVideo
            workflow["98"]["inputs"]["length"] = length  # WanImageToVideo (frames)
            workflow["94"]["inputs"]["fps"] = fps  # CreateVideo
            workflow["85"]["inputs"]["noise_seed"] = random.randint(
                1, 1000000
            )  # KSamplerAdvanced HIGH
            workflow["86"]["inputs"]["noise_seed"] = random.randint(
                1, 1000000
            )  # KSamplerAdvanced LOW
            # ===== END ANIMATION WORKFLOW =====

            # Submit job with webhook
            webhook_url = f"{settings.BACKEND_BASE_URL}/api/v1/webhooks/runpod-animation-completion"

            # Include image data in payload if S3 upload is disabled
            runpod_job_id = runpod_serverless_service.submit_job(
                workflow=workflow,
                webhook_url=webhook_url,
                job_id=job_id,
                image_data=(
                    None
                    if runpod_serverless_service.s3_available
                    else restored_image_data
                ),
                image_filename=(
                    None if runpod_serverless_service.s3_available else image_filename
                ),
            )

            # Create animation attempt record (pending state)
            animation = AnimationAttempt(
                job_id=job_uuid,
                restore_id=restore_uuid,
                preview_s3_key="pending",  # Will be set by webhook
                model=model or "runpod_serverless_wan",
                params={**params, "runpod_job_id": runpod_job_id},
            )
            db.add(animation)
            db.commit()

            logger.info(
                f"Submitted serverless animation job {runpod_job_id} for {job_id}"
            )

            return {
                "status": "submitted",
                "job_id": job_id,
                "animation_id": str(animation.id),
                "runpod_job_id": runpod_job_id,
            }

        else:
            # Pod mode - not implemented for animation yet
            raise NotImplementedError(
                "Animation is only supported in serverless mode (COMFYUI_MODE=serverless)"
            )

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
