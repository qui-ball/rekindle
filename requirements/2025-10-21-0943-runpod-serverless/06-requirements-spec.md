# Requirements Specification: RunPod Serverless Integration

**Date:** 2025-10-21
**ID:** runpod-serverless
**Status:** Ready for Implementation

---

## Problem Statement

The backend currently assumes a single RunPod pod to run the ComfyUI restoration workflow. This approach:
- Requires manually launching and managing pods
- Incurs costs even during idle periods
- Doesn't auto-scale with demand
- Requires waiting for pod startup before processing

The user wants to support RunPod's serverless offering alongside the existing pod-based approach, providing flexibility to choose the execution mode based on deployment needs.

## Solution Overview

Implement RunPod serverless integration that:
1. **Supports both execution modes** - Pod-based (existing) and serverless (new)
2. **Uses webhook notifications** - RunPod calls backend when jobs complete
3. **Leverages network volume S3 API** - For uploading inputs and downloading outputs
4. **Defaults to serverless** - Cost-effective auto-scaling with pay-per-second billing
5. **Maintains existing architecture** - Minimal changes to database and API structure

### High-Level Architecture

```
┌─────────────────┐
│   Frontend      │
│   Upload Photo  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│               Backend API                            │
│   POST /api/v1/jobs → Creates job, queues Celery   │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│            Celery Worker                             │
│  1. Download image from AWS S3                      │
│  2. Upload to RunPod network volume (S3 API)        │
│  3. Load & modify workflow JSON                     │
│  4. Submit to RunPod serverless with webhook        │
│  5. Store RunPod job ID                             │
│  6. EXIT (don't wait)                               │
└─────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  RunPod Serverless   │
                    │  Worker executes     │
                    │  ComfyUI workflow    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Network Volume      │
                    │  /workspace/outputs/ │
                    └──────────────────────┘
                               │
                               ▼ (Webhook)
┌─────────────────────────────────────────────────────┐
│          Backend Webhook Handler                     │
│  POST /api/v1/webhooks/runpod-completion           │
│  1. Receive job completion notification             │
│  2. Download output from network volume (S3 API)    │
│  3. Upload to AWS S3                                │
│  4. Update Job & RestoreAttempt in database         │
│  5. Return 200 OK                                   │
└─────────────────────────────────────────────────────┘
```

---

## Functional Requirements

### FR1: Dual Mode Support
The system must support both pod-based and serverless execution modes:
- **Pod mode**: Existing behavior using direct ComfyUI HTTP API
- **Serverless mode**: New behavior using RunPod serverless endpoints
- Mode selection via environment variable `COMFYUI_MODE`
- Default to `serverless`

### FR2: Serverless Job Submission
When in serverless mode, the Celery task must:
1. Download the uploaded image from AWS S3
2. Upload image to RunPod network volume at `s3://366etpkt4g/inputs/job_{job_id}.jpg`
3. Load workflow from `backend/app/workflows/restore.json`
4. Update workflow parameters: filename, denoise, megapixels, seed
5. Submit job to RunPod serverless endpoint with webhook URL
6. Store RunPod job ID in database
7. Exit without waiting for completion

### FR3: Webhook Handler
The backend must provide a webhook endpoint that:
- Receives POST requests from RunPod at `/api/v1/webhooks/runpod-completion`
- Validates the webhook payload (contains job ID, status, output)
- Downloads output files from network volume via S3 API
- Uploads output to AWS S3 bucket
- Updates Job and RestoreAttempt records in database
- Returns 200 status code to acknowledge receipt

### FR4: Network Volume Access
The system must access the RunPod network volume via S3-compatible API:
- **Endpoint**: `https://s3api-eu-cz-1.runpod.io/`
- **Volume ID**: `366etpkt4g`
- **Operations**: Upload inputs, download outputs
- **Credentials**: Use existing `RUNPOD_S3_ACCESS_KEY` and `RUNPOD_S3_SECRET_KEY`

### FR5: Error Handling
The system must handle common error scenarios:
- Invalid RunPod API key
- S3 upload/download failures
- Webhook delivery failures (rely on RunPod's retry mechanism)
- Invalid webhook payloads
- Jobs remain in pending state if webhook never arrives (manual intervention)

---

## Technical Requirements

### TR1: New Service - RunPod Serverless

**File**: `backend/app/services/runpod_serverless.py`

Create a new service class for RunPod serverless operations:

```python
class RunPodServerlessService:
    def __init__(
        self,
        api_key: str = None,
        endpoint_id: str = None,
        network_volume_id: str = None,
        s3_endpoint: str = None,
        s3_access_key: str = None,
        s3_secret_key: str = None,
        s3_region: str = None
    ):
        """Initialize RunPod serverless service"""

    def upload_image_to_volume(
        self,
        image_data: bytes,
        job_id: str,
        extension: str = "jpg"
    ) -> str:
        """Upload image to network volume via S3 API
        Returns: S3 path (e.g., 'inputs/job_123.jpg')
        """

    def submit_job(
        self,
        workflow: Dict[str, Any],
        webhook_url: str,
        job_id: str
    ) -> str:
        """Submit job to RunPod serverless
        Returns: RunPod job ID
        """

    def download_output_from_volume(
        self,
        output_path: str
    ) -> bytes:
        """Download output file from network volume via S3 API
        Args: output_path like 'outputs/restored.jpg'
        Returns: File bytes
        """
```

**Key methods**:
- `upload_image_to_volume()`: Upload to `s3://366etpkt4g/inputs/`
- `submit_job()`: Call `endpoint.run()` with workflow and webhook
- `download_output_from_volume()`: Download from `s3://366etpkt4g/outputs/`

**Dependencies**:
- `runpod` Python SDK
- `boto3` for S3 operations

### TR2: Configuration Updates

**File**: `backend/app/core/config.py`

Add new configuration settings:

```python
class Settings(BaseSettings):
    # ... existing settings ...

    # ComfyUI Mode Selection
    COMFYUI_MODE: str = Field(
        default="serverless",
        description="ComfyUI execution mode: 'serverless' or 'pod'"
    )

    # RunPod Serverless
    RUNPOD_ENDPOINT_ID: str = Field(
        ...,
        description="RunPod serverless endpoint ID"
    )
    RUNPOD_NETWORK_VOLUME_ID: str = Field(
        default="366etpkt4g",
        description="RunPod network volume ID"
    )
    RUNPOD_S3_ENDPOINT: str = Field(
        default="https://s3api-eu-cz-1.runpod.io/",
        description="RunPod S3 API endpoint URL"
    )
    RUNPOD_S3_REGION: str = Field(
        default="eu-cz-1",
        description="RunPod network volume region"
    )

    # Webhook
    BACKEND_BASE_URL: str = Field(
        ...,
        description="Backend base URL for webhooks (e.g., https://api.example.com)"
    )
```

### TR3: Update Celery Task

**File**: `backend/app/workers/tasks/jobs.py`

Modify `process_restoration` task to support both modes:

```python
@celery_app.task(bind=True)
def process_restoration(
    self,
    job_id: str,
    model: Optional[str] = None,
    params: Dict[str, Any] = None
):
    """Process image restoration for a job"""
    db = SessionLocal()
    job_uuid = UUID(job_id)

    if params is None:
        params = {}

    try:
        job = db.query(Job).filter(Job.id == job_uuid).first()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        logger.info(f"Starting restoration for job {job_id}, mode: {settings.COMFYUI_MODE}")

        # Download uploaded image from S3
        uploaded_key = f"uploaded/{job_id}.jpg"
        image_data = None
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

        # Extract parameters
        denoise = params.get("denoise", 0.7)
        megapixels = params.get("megapixels", 1.0)

        # Route based on mode
        if settings.COMFYUI_MODE == "serverless":
            # Serverless mode - submit and exit
            from app.services.runpod_serverless import runpod_serverless_service

            # Upload image to network volume
            volume_path = runpod_serverless_service.upload_image_to_volume(
                image_data=image_data,
                job_id=job_id,
                extension="jpg"
            )

            # Load and modify workflow
            workflow_path = Path(__file__).parent.parent / "workflows" / "restore.json"
            with open(workflow_path, "r") as f:
                workflow = json.load(f)

            # Update workflow parameters
            workflow["78"]["inputs"]["image"] = f"job_{job_id}.jpg"  # Filename only
            workflow["93"]["inputs"]["megapixels"] = megapixels
            workflow["3"]["inputs"]["denoise"] = denoise
            workflow["3"]["inputs"]["seed"] = random.randint(1, 1000000)

            # Submit job with webhook
            webhook_url = f"{settings.BACKEND_BASE_URL}/api/v1/webhooks/runpod-completion"
            runpod_job_id = runpod_serverless_service.submit_job(
                workflow=workflow,
                webhook_url=webhook_url,
                job_id=job_id
            )

            # Create restore attempt record (pending state)
            restore = RestoreAttempt(
                job_id=job_uuid,
                s3_key="",  # Will be set by webhook
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
            }

        else:
            # Pod mode - existing synchronous behavior
            restored_image_data = comfyui_service.restore_image(
                image_data=image_data,
                filename=f"job_{job_id}.jpg",
                denoise=denoise,
                megapixels=megapixels,
            )

            # Create restore attempt record
            restore = RestoreAttempt(
                job_id=job_uuid,
                s3_key="",
                model=model or "comfyui_pod",
                params=params,
            )
            db.add(restore)
            db.flush()

            # Generate timestamp ID
            restore_timestamp_id = s3_service.generate_timestamp_id()

            # Upload restored image to S3
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
                    extension="jpg"
                )
                job.thumbnail_s3_key = f"thumbnails/{job_id}.jpg"
            except Exception as thumb_error:
                logger.error(f"Failed to generate thumbnail: {thumb_error}")

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
```

### TR4: New Webhook Endpoint

**File**: `backend/app/api/v1/webhooks.py` (NEW)

Create webhook handler:

```python
"""
Webhook endpoints for external service notifications
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from uuid import UUID
from loguru import logger
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.jobs import Job, RestoreAttempt
from app.services.s3 import s3_service
from app.services.runpod_serverless import runpod_serverless_service

router = APIRouter()


class RunPodWebhookPayload(BaseModel):
    """RunPod webhook payload structure"""
    id: str  # RunPod job ID
    status: str  # COMPLETED, FAILED, etc.
    delayTime: Optional[int] = None
    executionTime: Optional[int] = None
    output: Optional[Dict[str, Any]] = None


@router.post("/runpod-completion")
async def handle_runpod_completion(payload: RunPodWebhookPayload):
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
    logger.info(f"Received RunPod webhook: job_id={payload.id}, status={payload.status}")

    db = SessionLocal()
    try:
        # Find RestoreAttempt by RunPod job ID
        restore = db.query(RestoreAttempt).filter(
            RestoreAttempt.params.contains({"runpod_job_id": payload.id})
        ).first()

        if not restore:
            logger.warning(f"No RestoreAttempt found for RunPod job {payload.id}")
            return {"status": "not_found", "message": "Job not found in database"}

        job = db.query(Job).filter(Job.id == restore.job_id).first()
        if not job:
            logger.error(f"Job {restore.job_id} not found for restore {restore.id}")
            return {"status": "error", "message": "Associated job not found"}

        job_id = str(job.id)

        if payload.status == "COMPLETED":
            # Extract output file paths from handler response
            output_files = payload.output.get("files", []) if payload.output else []

            if not output_files:
                logger.error(f"No output files in webhook for job {job_id}")
                restore.s3_key = "failed_no_output"
                restore.params = {**restore.params, "error": "No output files"}
                db.commit()
                return {"status": "error", "message": "No output files"}

            # Download first output file from network volume
            # Path format: /workspace/outputs/filename.jpg → outputs/filename.jpg
            output_path = output_files[0].replace("/workspace/", "")

            try:
                restored_image_data = runpod_serverless_service.download_output_from_volume(
                    output_path=output_path
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
                        extension="jpg"
                    )
                    job.thumbnail_s3_key = f"thumbnails/{job_id}.jpg"
                    logger.info(f"Generated thumbnail for job {job_id}")
                except Exception as thumb_error:
                    logger.error(f"Failed to generate thumbnail: {thumb_error}")

                # Update job's selected restore
                job.selected_restore_id = restore.id

                # Add execution metrics to params
                restore.params = {
                    **restore.params,
                    "delayTime": payload.delayTime,
                    "executionTime": payload.executionTime,
                    "output_path": output_path,
                }

                db.commit()

                logger.success(f"Completed serverless restoration for job {job_id}")

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
            detail=f"Error processing webhook: {str(e)}"
        )

    finally:
        db.close()
```

**Register webhook router**:

**File**: `backend/app/api/routes.py` or `backend/app/main.py`

```python
from app.api.v1 import webhooks

app.include_router(
    webhooks.router,
    prefix="/api/v1/webhooks",
    tags=["webhooks"]
)
```

### TR5: Dependencies

**File**: `backend/pyproject.toml`

Ensure these dependencies exist:
```toml
[project.dependencies]
runpod = "^1.7.0"  # For serverless API
boto3 = "^1.34.0"  # For S3 operations (likely already present)
```

---

## Implementation Hints and Patterns

### Pattern 1: S3 Client for Network Volume

```python
import boto3

# Create S3 client for RunPod network volume
s3_client = boto3.client(
    's3',
    endpoint_url='https://s3api-eu-cz-1.runpod.io/',
    aws_access_key_id=settings.RUNPOD_S3_ACCESS_KEY,
    aws_secret_access_key=settings.RUNPOD_S3_SECRET_KEY,
    region_name='eu-cz-1'
)

# Upload to network volume
s3_client.put_object(
    Bucket='366etpkt4g',
    Key='inputs/job_123.jpg',
    Body=image_bytes
)

# Download from network volume
response = s3_client.get_object(
    Bucket='366etpkt4g',
    Key='outputs/restored.jpg'
)
output_bytes = response['Body'].read()
```

### Pattern 2: RunPod Serverless Job Submission

```python
import runpod

# Initialize endpoint
runpod.api_key = settings.RUNPOD_API_KEY
endpoint = runpod.Endpoint(settings.RUNPOD_ENDPOINT_ID)

# Submit async job with webhook
run_request = endpoint.run({
    "input": {
        "workflow_api": workflow_dict
    },
    "webhook": "https://your-backend.com/api/v1/webhooks/runpod-completion"
})

# Get job ID
runpod_job_id = run_request.job_id
```

### Pattern 3: Webhook Security (Optional Enhancement)

Consider adding webhook signature verification:

```python
import hmac
import hashlib

def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify webhook came from RunPod"""
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

### Pattern 4: Database Query for RunPod Job ID

Since the job ID is stored in JSONB params field:

```python
# Find RestoreAttempt by RunPod job ID
restore = db.query(RestoreAttempt).filter(
    RestoreAttempt.params.contains({"runpod_job_id": payload.id})
).first()
```

---

## Reference Files

### Files to Study
1. **`backend/app/services/comfyui.py`** - Service pattern, API integration
2. **`backend/app/workers/tasks/jobs.py`** - Current Celery task structure
3. **`backend/app/services/s3.py`** - S3 service patterns (boto3 usage)
4. **`backend/scripts/launch_runpod_pod.py`** - RunPod API usage examples
5. **`backend/app/workflows/restore.json`** - Workflow structure and parameters
6. **Remote: `~/Git/ComfyUI-Rekindle/rp_handler.py`** - Handler contract and behavior

### Files to Create
1. **`backend/app/services/runpod_serverless.py`** - New serverless service
2. **`backend/app/api/v1/webhooks.py`** - New webhook endpoint

### Files to Modify
1. **`backend/app/core/config.py`** - Add serverless configuration
2. **`backend/app/workers/tasks/jobs.py`** - Add mode switching logic
3. **`backend/app/api/routes.py` or `backend/app/main.py`** - Register webhook router
4. **`backend/.env.example`** - Document new environment variables

---

## Acceptance Criteria

### AC1: Configuration
- [ ] `COMFYUI_MODE` setting added to config (default: "serverless")
- [ ] `RUNPOD_ENDPOINT_ID` setting added to config
- [ ] `RUNPOD_NETWORK_VOLUME_ID` setting added (default: "366etpkt4g")
- [ ] `RUNPOD_S3_ENDPOINT` setting added (default: EU-CZ-1 endpoint)
- [ ] `BACKEND_BASE_URL` setting added for webhook URL construction
- [ ] All settings documented in `.env.example`

### AC2: Serverless Service
- [ ] `RunPodServerlessService` class created in `backend/app/services/runpod_serverless.py`
- [ ] Method `upload_image_to_volume()` uploads to network volume via S3 API
- [ ] Method `submit_job()` submits job to RunPod serverless with webhook
- [ ] Method `download_output_from_volume()` downloads from network volume via S3 API
- [ ] Global service instance `runpod_serverless_service` created
- [ ] Uses loguru for logging
- [ ] Includes docstrings for all public methods

### AC3: Celery Task Updates
- [ ] `process_restoration` task checks `COMFYUI_MODE` setting
- [ ] Serverless path: Uploads image to network volume
- [ ] Serverless path: Loads and modifies workflow JSON
- [ ] Serverless path: Submits job with webhook URL
- [ ] Serverless path: Stores RunPod job ID in RestoreAttempt params
- [ ] Serverless path: Exits without waiting for completion
- [ ] Pod path: Existing behavior preserved
- [ ] Clear logging distinguishes between modes

### AC4: Webhook Endpoint
- [ ] Webhook router created at `backend/app/api/v1/webhooks.py`
- [ ] Endpoint `POST /api/v1/webhooks/runpod-completion` receives webhooks
- [ ] Validates webhook payload structure
- [ ] Finds corresponding RestoreAttempt by RunPod job ID
- [ ] Downloads output from network volume on COMPLETED status
- [ ] Uploads output to AWS S3
- [ ] Updates RestoreAttempt and Job records
- [ ] Generates thumbnail for restored image
- [ ] Returns 200 status code to RunPod
- [ ] Handles FAILED status appropriately
- [ ] Error handling for all failure scenarios

### AC5: Integration Testing
- [ ] Can submit job in serverless mode
- [ ] Webhook endpoint receives RunPod notifications
- [ ] Output files downloaded from network volume successfully
- [ ] Restored images appear in frontend
- [ ] Can switch to pod mode via environment variable
- [ ] Both modes work correctly

### AC6: Code Quality
- [ ] Follows existing code patterns from codebase
- [ ] Uses loguru for all logging
- [ ] Includes docstrings for new classes/methods
- [ ] Type hints where appropriate
- [ ] No breaking changes to existing pod-based workflow

---

## Assumptions

1. User has a RunPod serverless endpoint already deployed with `rp_handler.py`
2. User knows the RunPod endpoint ID
3. Network volume `366etpkt4g` exists in EU-CZ-1 datacenter
4. S3 API credentials are already configured in `.env`
5. Backend is publicly accessible for webhook delivery (or uses ngrok for development)
6. RunPod Python SDK version 1.7.0+ is available
7. Webhook delivery is reliable (no fallback polling implemented)
8. Handler returns output file paths in format `/workspace/outputs/filename.jpg`

---

## Future Enhancements (Out of Scope)

1. **Webhook signature verification** - Add HMAC signature validation for security
2. **Fallback polling** - Check job status if webhook doesn't arrive within timeout
3. **Per-job mode selection** - Allow API requests to specify mode
4. **Automatic cleanup** - Delete input files from network volume after processing
5. **Status tracking UI** - Show RunPod job status in frontend
6. **Retry mechanism** - Automatic retry for failed jobs
7. **Cost tracking** - Log and display RunPod execution costs
8. **Batch processing** - Submit multiple jobs to serverless in parallel
9. **Worker auto-scaling** - Configure min/max workers based on queue depth
10. **Multi-region support** - Support multiple network volumes in different datacenters

---

## Testing Strategy

### Unit Tests
- Test `RunPodServerlessService` methods with mocked boto3 and runpod clients
- Test webhook handler with mock payloads
- Test Celery task mode switching logic

### Integration Tests
1. **Serverless submission**: Submit real job to RunPod serverless (requires endpoint)
2. **Webhook delivery**: Trigger webhook endpoint with test payload
3. **S3 operations**: Test upload/download to network volume
4. **End-to-end**: Submit job → Receive webhook → Verify output in AWS S3

### Manual Testing
1. Set `COMFYUI_MODE=serverless` in `.env`
2. Submit job via frontend
3. Verify image uploaded to network volume
4. Check RunPod dashboard for job execution
5. Verify webhook received by backend
6. Confirm restored image appears in frontend
7. Switch to `COMFYUI_MODE=pod` and verify existing flow still works

---

## Deployment Checklist

- [ ] Set `COMFYUI_MODE=serverless` in production `.env`
- [ ] Set `RUNPOD_ENDPOINT_ID` to deployed endpoint ID
- [ ] Set `BACKEND_BASE_URL` to production backend URL (for webhook)
- [ ] Verify `RUNPOD_S3_ACCESS_KEY` and `RUNPOD_S3_SECRET_KEY` are correct
- [ ] Ensure backend is publicly accessible for webhooks
- [ ] Deploy code changes to backend server
- [ ] Restart Celery workers
- [ ] Test with single job submission
- [ ] Monitor logs for webhook delivery
- [ ] Verify RunPod billing dashboard shows usage

---

## Notes

### Network Volume Path Mapping
- **Pod mount**: `/workspace/`
- **Serverless mount**: May also be `/workspace/` or `/runpod-volume/` (verify with handler)
- **S3 API**: `s3://366etpkt4g/`

### Webhook Reliability
RunPod's webhook implementation:
- Retries up to 2 times on failure
- 10-second delay between retries
- Requires 200 status code for success

### Cost Comparison
- **Pod**: Charged per second while running (even if idle)
- **Serverless**: Charged per second of execution only (cold start + execution)
- **Network Volume**: Charged for storage regardless of mode

### Handler Contract
Your deployed handler expects:
- Input: `{"input": {"workflow_api": {...}}}`
- Output: `{"prompt_id": "...", "files": [...], "file_count": N}`
- Files are absolute paths on network volume

### Development Workflow
1. For local development, use ngrok to expose webhook endpoint:
   ```bash
   ngrok http 8000
   # Use ngrok URL as BACKEND_BASE_URL
   ```
2. Monitor webhook deliveries in ngrok dashboard
3. Check Celery logs for job submission
4. Check backend logs for webhook processing
