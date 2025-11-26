"""
Webhook endpoints for external service notifications
"""

from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel, ConfigDict
from typing import Dict, Any, Optional
from uuid import UUID
from loguru import logger
from sqlalchemy import cast, String, text

from app.core.database import SessionLocal
from app.models.jobs import Job, RestoreAttempt
from app.services.s3 import s3_service
from app.services.runpod_serverless import runpod_serverless_service
from app.api.v1.events import job_events

router = APIRouter()


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
            files_with_data = payload.output.get("files_with_data", []) if payload.output else []

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
                logger.info("Using output data from webhook payload (non-S3 datacenter)")
                first_file = files_with_data[0]

                if "data" not in first_file:
                    logger.error(f"No data in file info for job {job_id}")
                    restore.s3_key = "failed_no_data"
                    restore.params = {**restore.params, "error": "No file data in response"}
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
                    return {"status": "error", "message": "Failed to decode output data"}
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
                    logger.error(f"Failed to download output from volume: {download_error}")
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
                    logger.info(f"Updated photo {photo.id} with processed_key: {restore.s3_key}")

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
