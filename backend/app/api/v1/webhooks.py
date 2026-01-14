"""
Webhook endpoints for external service notifications
"""

from fastapi import APIRouter, HTTPException, status, Request, Path
from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, Optional, List
from uuid import UUID
from loguru import logger
from sqlalchemy import cast, String, text

from app.core.database import SessionLocal
from app.models.jobs import Job, RestoreAttempt, AnimationAttempt
from app.models.photo import Photo
from app.services.s3 import s3_service
from app.services.runpod_serverless import runpod_serverless_service
from app.services.storage_service import storage_service
from app.services.replicate_service import download_replicate_result, download_replicate_video, get_user_friendly_error_message
from app.api.v1.events import job_events

router = APIRouter()


class ReplicateWebhookPayload(BaseModel):
    """Replicate webhook payload structure (prediction object)"""

    model_config = ConfigDict(extra="allow")

    id: str  # Prediction ID
    status: str  # starting, processing, succeeded, failed, canceled
    output: Optional[Any] = None  # URL or list of URLs for image models
    error: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None


@router.post("/replicate/{photo_id}", status_code=200)
async def handle_replicate_completion(
    request: Request,
    photo_id: str = Path(..., description="Photo ID for this restoration"),
):
    """
    Handle Replicate prediction completion webhook.

    When a prediction completes, Replicate POSTs the full prediction object.
    The photo_id is passed in the URL path so we know which photo to update.
    """
    # Parse JSON payload
    try:
        payload_dict = await request.json()
        logger.info(f"📥 Replicate webhook for photo {photo_id}: status={payload_dict.get('status')}")
        logger.debug(f"Full payload: {payload_dict}")
    except Exception as e:
        logger.error(f"❌ Failed to parse Replicate webhook JSON: {e}")
        return {"status": "error", "message": "Invalid JSON"}

    # Validate with Pydantic
    try:
        payload = ReplicateWebhookPayload.model_validate(payload_dict)
    except Exception as e:
        logger.error(f"❌ Pydantic validation failed: {e}")
        return {"status": "error", "message": f"Validation failed: {str(e)}"}

    db = SessionLocal()
    try:
        # Get the photo
        photo_uuid = UUID(photo_id)
        photo = db.query(Photo).filter(Photo.id == photo_uuid).first()

        if not photo:
            logger.warning(f"Photo {photo_id} not found for Replicate webhook")
            return {"status": "not_found", "message": "Photo not found"}

        # Get associated job
        job = db.query(Job).filter(Job.id == photo_uuid).first()
        if not job:
            logger.error(f"Job not found for photo {photo_id}")
            return {"status": "error", "message": "Job not found"}

        # Find pending restore attempt for this photo
        restore = (
            db.query(RestoreAttempt)
            .filter(
                RestoreAttempt.job_id == photo_uuid,
                RestoreAttempt.s3_key == "pending",
            )
            .order_by(RestoreAttempt.created_at.desc())
            .first()
        )

        if not restore:
            logger.warning(f"No pending RestoreAttempt found for photo {photo_id}")
            return {"status": "not_found", "message": "No pending restore attempt"}

        if payload.status == "succeeded":
            # Extract output URL(s)
            output = payload.output
            if output is None:
                logger.error(f"No output in successful prediction for photo {photo_id}")
                restore.s3_key = "failed_no_output"
                restore.params = {**restore.params, "error": "No output in response"}
                photo.status = "uploaded"
                db.commit()
                return {"status": "error", "message": "No output in response"}

            # Handle different output formats
            if isinstance(output, str):
                result_url = output
            elif isinstance(output, list) and len(output) > 0:
                result_url = output[0] if isinstance(output[0], str) else str(output[0])
            else:
                result_url = str(output)

            logger.info(f"Downloading result from: {result_url[:100]}...")

            # Download the restored image
            try:
                restored_image_data = await download_replicate_result(result_url)
            except Exception as download_error:
                logger.error(f"Failed to download Replicate result: {download_error}")
                restore.s3_key = "failed_download"
                restore.params = {**restore.params, "error": str(download_error)}
                photo.status = "uploaded"
                db.commit()
                return {"status": "error", "message": "Failed to download result"}

            # Generate timestamp ID for this restore
            restore_timestamp_id = s3_service.generate_timestamp_id()

            # Upload to user-scoped S3 storage
            try:
                restored_url = storage_service.upload_file(
                    file_content=restored_image_data,
                    user_id=photo.owner_id,
                    photo_id=photo.id,
                    category="processed",
                    filename=f"restored_{restore_timestamp_id}.jpg",
                    content_type="image/jpeg",
                )
                processed_key = storage_service.generate_user_scoped_key(
                    user_id=photo.owner_id,
                    photo_id=photo.id,
                    category="processed",
                    filename=f"restored_{restore_timestamp_id}.jpg",
                )

                # Update restore attempt
                restore.s3_key = processed_key
                restore.params = {
                    **restore.params,
                    "prediction_id": payload.id,
                    "metrics": payload.metrics,
                }

                # Generate thumbnail
                try:
                    s3_service.upload_job_thumbnail(
                        image_content=restored_image_data,
                        job_id=photo_id,
                        extension="jpg",
                    )
                    job.thumbnail_s3_key = f"thumbnails/{photo_id}.jpg"
                    logger.info(f"Generated thumbnail for photo {photo_id}")
                except Exception as thumb_error:
                    logger.error(f"Failed to generate thumbnail: {thumb_error}")

                # Update job and photo
                job.selected_restore_id = restore.id
                photo.processed_key = processed_key
                photo.status = "ready"

                db.commit()

                logger.success(f"✅ Replicate restoration completed for photo {photo_id}")

                # Send SSE notification
                await job_events.notify(
                    job_id=photo_id,
                    event_type="completed",
                    data={
                        "job_id": photo_id,
                        "restore_id": str(restore.id),
                        "status": "completed",
                    },
                )

                return {
                    "status": "success",
                    "photo_id": photo_id,
                    "restore_id": str(restore.id),
                    "restored_url": restored_url,
                }

            except Exception as upload_error:
                logger.error(f"Failed to upload to S3: {upload_error}")
                restore.s3_key = "failed_upload"
                restore.params = {**restore.params, "error": str(upload_error)}
                photo.status = "uploaded"
                db.commit()
                return {"status": "error", "message": "Failed to upload to S3"}

        elif payload.status == "failed":
            logger.error(f"Replicate prediction failed for photo {photo_id}: {payload.error}")
            restore.s3_key = "failed"
            restore.params = {
                **restore.params,
                "prediction_id": payload.id,
                "error": payload.error,
            }
            photo.status = "uploaded"
            db.commit()

            return {
                "status": "failed",
                "photo_id": photo_id,
                "error": payload.error,
            }

        elif payload.status == "canceled":
            logger.warning(f"Replicate prediction canceled for photo {photo_id}")
            restore.s3_key = "canceled"
            restore.params = {**restore.params, "prediction_id": payload.id}
            photo.status = "uploaded"
            db.commit()

            return {"status": "canceled", "photo_id": photo_id}

        else:
            # In-progress status (starting, processing) - just acknowledge
            logger.info(f"Replicate prediction {payload.status} for photo {photo_id}")
            return {"status": "acknowledged", "prediction_status": payload.status}

    except Exception as e:
        logger.error(f"Error processing Replicate webhook: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}",
        )

    finally:
        db.close()


class RunPodWebhookPayload(BaseModel):
    """RunPod webhook payload structure"""

    model_config = ConfigDict(
        extra="allow"
    )  # Pydantic v2: Allow extra fields like 'input', 'webhook', etc.

    id: str  # RunPod job ID
    status: str  # COMPLETED, FAILED, etc.
    delayTime: Optional[int] = None
    executionTime: Optional[int] = None
    output: Optional[Dict[str, Any]] = None


@router.post("/runpod-completion", status_code=200)
async def handle_runpod_completion(request: Request):
    """
    Handle RunPod serverless job completion webhook

    Expected payload from RunPod:
    {
        "id": "runpod-job-id",
        "status": "COMPLETED",
        "delayTime": 824,
        "executionTime": 3391,
        "output": {
            "prompt_id": "...",
            "files": ["/workspace/outputs/restored.jpg"],
            "file_count": 1
        }
    }
    """
    # Parse JSON and log
    try:
        payload_dict = await request.json()
        logger.info(f"📥 Raw webhook payload: {payload_dict}")
    except Exception as e:
        logger.error(f"❌ Failed to parse webhook JSON: {e}")
        return {"status": "error", "message": "Invalid JSON"}

    # Validate with Pydantic
    try:
        payload = RunPodWebhookPayload.model_validate(payload_dict)
        logger.info(
            f"✅ Validated webhook: job_id={payload.id}, status={payload.status}"
        )
    except Exception as e:
        logger.error(f"❌ Pydantic validation failed: {e}")
        logger.error(f"Payload keys received: {list(payload_dict.keys())}")
        logger.error(f"Payload values: {payload_dict}")
        return {"status": "error", "message": f"Validation failed: {str(e)}"}

    db = SessionLocal()
    try:
        # Find RestoreAttempt by RunPod job ID
        # Use PostgreSQL's ->> operator to extract JSON field as text
        restore = (
            db.query(RestoreAttempt)
            .filter(text("params->>'runpod_job_id' = :job_id"))
            .params(job_id=payload.id)
            .first()
        )

        if not restore:
            logger.warning(f"No RestoreAttempt found for RunPod job {payload.id}")
            return {"status": "not_found", "message": "Job not found in database"}

        job = db.query(Job).filter(Job.id == restore.job_id).first()
        if not job:
            logger.error(f"Job {restore.job_id} not found for restore {restore.id}")
            return {"status": "error", "message": "Associated job not found"}

        job_id = str(job.id)
        job_uuid = job.id

        if payload.status == "COMPLETED":
            # Extract output from handler response
            output_files = payload.output.get("files", []) if payload.output else []
            files_with_data = (
                payload.output.get("files_with_data", []) if payload.output else []
            )

            if not output_files:
                logger.error(f"No output files in webhook for job {job_id}")
                restore.s3_key = "failed_no_output"
                restore.params = {**restore.params, "error": "No output files"}
                db.commit()
                return {"status": "error", "message": "No output files"}

            # Get restored image data
            # If files_with_data is present, use base64 data from payload (for CA-MTL-3, etc.)
            # Otherwise download from network volume via S3 API
            if files_with_data and len(files_with_data) > 0:
                logger.info(
                    "Using output data from webhook payload (non-S3 datacenter)"
                )
                first_file = files_with_data[0]

                if "data" not in first_file:
                    logger.error(f"No data in file info for job {job_id}")
                    restore.s3_key = "failed_no_data"
                    restore.params = {
                        **restore.params,
                        "error": "No file data in response",
                    }
                    db.commit()
                    return {"status": "error", "message": "No file data in response"}

                try:
                    import base64

                    restored_image_data = base64.b64decode(first_file["data"])
                    output_path = first_file.get("path", "unknown")
                except Exception as decode_error:
                    logger.error(f"Failed to decode output data: {decode_error}")
                    restore.s3_key = "failed_decode"
                    restore.params = {**restore.params, "error": str(decode_error)}
                    db.commit()
                    return {
                        "status": "error",
                        "message": "Failed to decode output data",
                    }
            else:
                # Download from network volume via S3 API (for supported datacenters)
                logger.info("Downloading output from network volume via S3 API")
                # Path format: /workspace/outputs/filename.jpg → outputs/filename.jpg
                # Or: /runpod-volume/outputs/filename.jpg → outputs/filename.jpg
                output_path = (
                    output_files[0]
                    .replace("/workspace/", "")
                    .replace("/runpod-volume/", "")
                )

                try:
                    restored_image_data = (
                        runpod_serverless_service.download_output_from_volume(
                            output_path=output_path
                        )
                    )
                except Exception as download_error:
                    logger.error(
                        f"Failed to download output from volume: {download_error}"
                    )
                    restore.s3_key = "failed_download"
                    restore.params = {**restore.params, "error": str(download_error)}
                    db.commit()
                    return {"status": "error", "message": "Failed to download output"}

            # Generate timestamp ID for this restore
            restore_timestamp_id = s3_service.generate_timestamp_id()

            # Upload to AWS S3
            try:
                restored_url = s3_service.upload_restored_image(
                    image_content=restored_image_data,
                    job_id=job_id,
                    restore_id=restore_timestamp_id,
                    extension="jpg",
                )

                # Update restore attempt with S3 key
                restore.s3_key = f"restored/{job_id}/{restore_timestamp_id}.jpg"

                # Generate thumbnail
                try:
                    thumbnail_url = s3_service.upload_job_thumbnail(
                        image_content=restored_image_data,
                        job_id=job_id,
                        extension="jpg",
                    )
                    job.thumbnail_s3_key = f"thumbnails/{job_id}.jpg"
                    logger.info(f"Generated thumbnail for job {job_id}")
                except Exception as thumb_error:
                    logger.error(f"Failed to generate thumbnail: {thumb_error}")

                # Update job's selected restore
                job.selected_restore_id = restore.id

                # Update the associated Photo model if job_id matches a photo_id
                # (When restoration is triggered from a photo, job_id = photo_id)
                from app.models.photo import Photo

                photo = db.query(Photo).filter(Photo.id == job_uuid).first()
                if photo:
                    # Update photo's processed_key to point to the restored image
                    photo.processed_key = restore.s3_key
                    photo.status = "ready"
                    logger.info(
                        f"Updated photo {photo.id} with processed_key: {restore.s3_key}"
                    )

                # Add execution metrics to params
                restore.params = {
                    **restore.params,
                    "delayTime": payload.delayTime,
                    "executionTime": payload.executionTime,
                    "output_path": output_path,
                }

                db.commit()

                logger.success(f"Completed serverless restoration for job {job_id}")

                # Notify SSE listeners
                await job_events.notify(
                    job_id=job_id,
                    event_type="completed",
                    data={
                        "job_id": job_id,
                        "restore_id": str(restore.id),
                        "status": "completed",
                    },
                )

                return {
                    "status": "success",
                    "job_id": job_id,
                    "restore_id": str(restore.id),
                    "restored_url": restored_url,
                }

            except Exception as upload_error:
                logger.error(f"Failed to upload to S3: {upload_error}")
                restore.s3_key = "failed_upload"
                restore.params = {**restore.params, "error": str(upload_error)}
                db.commit()
                return {"status": "error", "message": "Failed to upload to S3"}

        elif payload.status == "FAILED":
            # Job failed on RunPod
            logger.error(f"RunPod job {payload.id} failed for job {job_id}")
            restore.s3_key = "failed_runpod"
            restore.params = {
                **restore.params,
                "error": "RunPod job failed",
                "output": payload.output,
            }
            db.commit()

            return {
                "status": "failed",
                "job_id": job_id,
                "message": "RunPod job failed",
            }

        else:
            # Unknown status
            logger.warning(f"Unknown RunPod status: {payload.status} for job {job_id}")
            return {"status": "unknown", "message": f"Unknown status: {payload.status}"}

    except Exception as e:
        logger.error(f"Error processing RunPod webhook: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing webhook: {str(e)}",
        )

    finally:
        db.close()


@router.post("/runpod-animation-completion", status_code=200)
async def handle_runpod_animation_completion(request: Request):
    """
    Handle RunPod serverless animation job completion webhook

    Expected payload from RunPod:
    {
        "id": "runpod-job-id",
        "status": "COMPLETED",
        "delayTime": 824,
        "executionTime": 3391,
        "output": {
            "prompt_id": "...",
            "files": ["/workspace/outputs/video/ComfyUI_00001.mp4"],
            "file_count": 1
        }
    }
    """
    # Parse JSON and log
    try:
        payload_dict = await request.json()
        logger.info(f"📥 Raw animation webhook payload: {payload_dict}")
    except Exception as e:
        logger.error(f"❌ Failed to parse animation webhook JSON: {e}")
        return {"status": "error", "message": "Invalid JSON"}

    # Validate with Pydantic
    try:
        payload = RunPodWebhookPayload.model_validate(payload_dict)
        logger.info(
            f"✅ Validated animation webhook: job_id={payload.id}, status={payload.status}"
        )
    except Exception as e:
        logger.error(f"❌ Pydantic validation failed: {e}")
        logger.error(f"Payload keys received: {list(payload_dict.keys())}")
        logger.error(f"Payload values: {payload_dict}")
        return {"status": "error", "message": f"Validation failed: {str(e)}"}

    db = SessionLocal()
    try:
        # Find AnimationAttempt by RunPod job ID
        animation = (
            db.query(AnimationAttempt)
            .filter(text("params->>'runpod_job_id' = :job_id"))
            .params(job_id=payload.id)
            .first()
        )

        if not animation:
            logger.warning(f"No AnimationAttempt found for RunPod job {payload.id}")
            return {"status": "not_found", "message": "Job not found in database"}

        job = db.query(Job).filter(Job.id == animation.job_id).first()
        if not job:
            logger.error(
                f"Job {animation.job_id} not found for animation {animation.id}"
            )
            return {"status": "error", "message": "Associated job not found"}

        job_id = str(job.id)
        job_uuid = job.id

        if payload.status == "COMPLETED":
            # Extract output from handler response
            output_files = payload.output.get("files", []) if payload.output else []
            files_with_data = (
                payload.output.get("files_with_data", []) if payload.output else []
            )

            if not output_files:
                logger.error(f"No output files in animation webhook for job {job_id}")
                animation.preview_s3_key = "failed_no_output"
                animation.params = {
                    **animation.params,
                    "error": "No output files",
                }
                db.commit()
                return {"status": "error", "message": "No output files"}

            # Get animated video data
            if files_with_data and len(files_with_data) > 0:
                logger.info(
                    "Using animation output data from webhook payload (non-S3 datacenter)"
                )
                first_file = files_with_data[0]

                if "data" not in first_file:
                    logger.error(f"No data in file info for animation {job_id}")
                    animation.preview_s3_key = "failed_no_data"
                    animation.params = {
                        **animation.params,
                        "error": "No file data in response",
                    }
                    db.commit()
                    return {"status": "error", "message": "No file data in response"}

                try:
                    import base64

                    video_data = base64.b64decode(first_file["data"])
                    output_path = first_file.get("path", "unknown")
                except Exception as decode_error:
                    logger.error(
                        f"Failed to decode animation output data: {decode_error}"
                    )
                    animation.preview_s3_key = "failed_decode"
                    animation.params = {
                        **animation.params,
                        "error": str(decode_error),
                    }
                    db.commit()
                    return {
                        "status": "error",
                        "message": "Failed to decode output data",
                    }
            else:
                # Download from network volume via S3 API
                logger.info(
                    "Downloading animation output from network volume via S3 API"
                )
                # Path format: /workspace/outputs/video/ComfyUI_00001.mp4 → outputs/video/ComfyUI_00001.mp4
                output_path = (
                    output_files[0]
                    .replace("/workspace/", "")
                    .replace("/runpod-volume/", "")
                )

                try:
                    video_data = runpod_serverless_service.download_output_from_volume(
                        output_path=output_path
                    )
                except Exception as download_error:
                    logger.error(
                        f"Failed to download animation output from volume: {download_error}"
                    )
                    animation.preview_s3_key = "failed_download"
                    animation.params = {
                        **animation.params,
                        "error": str(download_error),
                    }
                    db.commit()
                    return {"status": "error", "message": "Failed to download output"}

            # Generate timestamp ID for this animation
            animation_timestamp_id = s3_service.generate_timestamp_id()

            # Upload to AWS S3
            try:
                video_url = s3_service.upload_animation(
                    video_content=video_data,
                    job_id=job_id,
                    animation_id=animation_timestamp_id,
                    is_preview=True,
                )

                # Update animation attempt with S3 key
                animation.preview_s3_key = (
                    f"animated/{job_id}/{animation_timestamp_id}_preview.mp4"
                )

                # Generate thumbnail from first frame (optional - can be implemented later)
                # For now, we'll skip thumbnail generation for videos

                # Update job's latest animation
                job.latest_animation_id = animation.id

                # Commit all changes
                db.commit()

                logger.success(
                    f"✅ Animation webhook processed successfully for job {job_id}"
                )

                # Send SSE event
                await job_events.send_job_update(
                    job_id=job_id,
                    event_data={
                        "status": "animation_completed",
                        "job_id": job_id,
                        "animation_id": str(animation.id),
                        "video_url": video_url,
                    },
                )

                return {
                    "status": "success",
                    "job_id": job_id,
                    "animation_id": str(animation.id),
                    "video_url": video_url,
                }

            except Exception as upload_error:
                logger.error(f"Failed to upload animation to S3: {upload_error}")
                animation.preview_s3_key = "failed_upload"
                animation.params = {
                    **animation.params,
                    "error": str(upload_error),
                }
                db.commit()
                return {"status": "error", "message": "Failed to upload to S3"}

        elif payload.status == "FAILED":
            # Mark animation as failed
            logger.error(f"RunPod animation job failed for job {job_id}")
            animation.preview_s3_key = "failed"
            animation.params = {
                **animation.params,
                "status": "FAILED",
                "output": payload.output,
            }
            db.commit()

            return {
                "status": "failed",
                "job_id": job_id,
                "message": "RunPod animation job failed",
            }

        else:
            # Unknown status
            logger.warning(
                f"Unknown RunPod animation status: {payload.status} for job {job_id}"
            )
            return {
                "status": "unknown",
                "message": f"Unknown status: {payload.status}",
            }

    except Exception as e:
        logger.error(f"Error processing RunPod animation webhook: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing animation webhook: {str(e)}",
        )

    finally:
        db.close()


@router.post("/replicate/animation/{animation_id}", status_code=200)
async def handle_replicate_animation_completion(
    request: Request,
    animation_id: str = Path(..., description="Animation attempt ID"),
):
    """
    Handle Replicate animation prediction completion webhook.

    When an animation prediction completes, Replicate POSTs the full prediction object.
    The animation_id is passed in the URL path so we know which animation to update.
    """
    # Parse JSON payload
    try:
        payload_dict = await request.json()
        logger.info(f"📥 Replicate animation webhook for {animation_id}: status={payload_dict.get('status')}")
        logger.debug(f"Full payload: {payload_dict}")
    except Exception as e:
        logger.error(f"❌ Failed to parse Replicate animation webhook JSON: {e}")
        return {"status": "error", "message": "Invalid JSON"}

    # Validate with Pydantic
    try:
        payload = ReplicateWebhookPayload.model_validate(payload_dict)
    except Exception as e:
        logger.error(f"❌ Pydantic validation failed for animation webhook: {e}")
        return {"status": "error", "message": f"Validation failed: {str(e)}"}

    db = SessionLocal()
    try:
        # Get the animation attempt
        animation_uuid = UUID(animation_id)
        animation = db.query(AnimationAttempt).filter(AnimationAttempt.id == animation_uuid).first()

        if not animation:
            logger.warning(f"AnimationAttempt {animation_id} not found for Replicate webhook")
            return {"status": "not_found", "message": "Animation attempt not found"}

        # Get associated job
        job = db.query(Job).filter(Job.id == animation.job_id).first()
        if not job:
            logger.error(f"Job not found for animation {animation_id}")
            return {"status": "error", "message": "Job not found"}

        job_id = str(job.id)

        if payload.status == "succeeded":
            # Extract output URL
            output = payload.output
            if output is None:
                logger.error(f"No output in successful animation prediction for {animation_id}")
                animation.preview_s3_key = "failed"
                animation.params = {
                    **(animation.params or {}),
                    "error": "No output in response",
                    "error_type": "no_output",
                }
                db.commit()
                return {"status": "error", "message": "No output in response"}

            # Handle output format (should be a URL string for video models)
            if isinstance(output, str):
                result_url = output
            elif hasattr(output, "url"):
                result_url = output.url
            else:
                result_url = str(output)

            logger.info(f"Downloading animation video from: {result_url[:100]}...")

            # Download the video
            try:
                video_data = await download_replicate_video(result_url)
            except Exception as download_error:
                logger.error(f"Failed to download Replicate animation video: {download_error}")
                animation.preview_s3_key = "failed"
                animation.params = {
                    **(animation.params or {}),
                    "error": str(download_error),
                    "error_type": "download_failed",
                }
                db.commit()
                return {"status": "error", "message": "Failed to download video"}

            # Generate timestamp ID for this animation
            animation_timestamp_id = s3_service.generate_timestamp_id()

            # Upload to S3
            try:
                video_url = s3_service.upload_animation(
                    video_content=video_data,
                    job_id=job_id,
                    animation_id=animation_timestamp_id,
                    is_preview=True,
                )

                # Update animation attempt (must match the key used by upload_animation)
                animation.preview_s3_key = f"animated/{job_id}/{animation_timestamp_id}_preview.mp4"
                animation.params = {
                    **(animation.params or {}),
                    "prediction_id": payload.id,
                    "metrics": payload.metrics,
                    "status": "completed",
                }

                # Update job's latest animation
                job.latest_animation_id = animation.id

                db.commit()

                logger.success(f"✅ Replicate animation completed for {animation_id}")

                # Send SSE notification
                await job_events.notify(
                    job_id=job_id,
                    event_type="animation_completed",
                    data={
                        "job_id": job_id,
                        "animation_id": str(animation.id),
                        "status": "completed",
                        "video_url": video_url,
                    },
                )

                return {
                    "status": "success",
                    "animation_id": animation_id,
                    "job_id": job_id,
                    "video_url": video_url,
                }

            except Exception as upload_error:
                logger.error(f"Failed to upload animation video to S3: {upload_error}")
                animation.preview_s3_key = "failed"
                animation.params = {
                    **(animation.params or {}),
                    "error": str(upload_error),
                    "error_type": "upload_failed",
                }
                db.commit()
                return {"status": "error", "message": "Failed to upload to S3"}

        elif payload.status == "failed":
            logger.error(f"Replicate animation prediction failed for {animation_id}: {payload.error}")
            animation.preview_s3_key = "failed"
            animation.params = {
                **(animation.params or {}),
                "prediction_id": payload.id,
                "error": payload.error,
                "error_type": "prediction_failed",
                "status": "failed",
            }
            db.commit()

            # Send SSE notification for failure
            await job_events.notify(
                job_id=job_id,
                event_type="animation_failed",
                data={
                    "job_id": job_id,
                    "animation_id": str(animation.id),
                    "status": "failed",
                    "error": payload.error,
                },
            )

            return {
                "status": "failed",
                "animation_id": animation_id,
                "error": payload.error,
            }

        elif payload.status == "canceled":
            logger.warning(f"Replicate animation prediction canceled for {animation_id}")
            animation.preview_s3_key = "failed"
            animation.params = {
                **(animation.params or {}),
                "prediction_id": payload.id,
                "status": "canceled",
            }
            db.commit()

            return {"status": "canceled", "animation_id": animation_id}

        else:
            # In-progress status (starting, processing) - just acknowledge
            logger.info(f"Replicate animation prediction {payload.status} for {animation_id}")
            return {"status": "acknowledged", "prediction_status": payload.status}

    except Exception as e:
        logger.error(f"Error processing Replicate animation webhook: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing animation webhook: {str(e)}",
        )

    finally:
        db.close()