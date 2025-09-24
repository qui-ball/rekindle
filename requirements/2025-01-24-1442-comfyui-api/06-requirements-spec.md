# Requirements Specification: ComfyUI API Integration

## Problem Statement
Integrate the existing ComfyUI restoration script into the backend API to enable asynchronous image restoration processing with S3 storage and job tracking.

## Solution Overview
Create a REST API endpoint that accepts image uploads, queues them for asynchronous processing via Celery/Redis, processes them through the local ComfyUI server, and stores results in S3 with CloudFront CDN delivery.

## Functional Requirements

### 1. API Endpoint
- **POST /api/v1/restoration/restore**
  - Accept image upload (JPEG, PNG, HEIC, WebP)
  - Accept denoise parameter (0.0-1.0)
  - Validate file size (max 50MB)
  - Return job ID for tracking

### 2. Job Processing
- Queue restoration jobs using Celery with Redis broker
- Process images asynchronously through ComfyUI server (localhost:8188)
- Support multiple concurrent jobs (no per-user limits)
- No automatic retry on failure (fail fast)

### 3. Storage
- Upload original images to S3 before processing
- Store processed images in S3 after completion
- Keep both original and processed images permanently
- Serve images via CloudFront CDN

### 4. Job Tracking
- **GET /api/v1/restoration/jobs/{job_id}**
  - Return job status (pending, processing, completed, failed)
  - Include S3 URLs for completed jobs
  - Store job history in PostgreSQL database

### 5. Authentication
- Require Auth0 JWT authentication for all endpoints
- Track user ID with each job

## Technical Requirements

### File Structure
```
backend/app/
├── api/
│   ├── __init__.py
│   ├── routes.py
│   ├── deps.py (dependencies/auth)
│   └── v1/
│       ├── __init__.py
│       └── restoration.py
├── workers/
│   ├── __init__.py
│   ├── celery_app.py
│   └── tasks/
│       ├── __init__.py
│       └── restoration.py
├── services/
│   ├── __init__.py
│   ├── comfyui.py
│   └── s3.py
├── models/
│   ├── __init__.py
│   └── restoration.py
├── schemas/
│   ├── __init__.py
│   └── restoration.py
└── workflows/
    └── restore.json
```

### Implementation Details

1. **Move existing files:**
   - `app/run_restore.py` → refactor into `app/services/comfyui.py`
   - `app/restore.json` → `app/workflows/restore.json`

2. **Database Schema:**
   ```python
   RestorationJob:
   - id: UUID
   - user_id: str
   - status: Enum(pending, processing, completed, failed)
   - original_image_url: str
   - processed_image_url: str (nullable)
   - denoise: float
   - error_message: str (nullable)
   - created_at: datetime
   - updated_at: datetime
   ```

3. **Fixed Parameters (not exposed):**
   - megapixels: 1.0
   - seed: random
   - prompt: default restoration prompt from workflow

4. **Celery Configuration:**
   - Broker: Redis (existing config)
   - Result backend: Redis
   - Task timeout: 5 minutes
   - Concurrency: Based on available resources

## Implementation Hints

1. **Use existing patterns from config.py:**
   - Settings class for configuration
   - Environment variables from .env
   - AWS credentials already configured

2. **FastAPI patterns:**
   - Use dependency injection for auth
   - Pydantic schemas for validation
   - async/await for I/O operations

3. **Error Handling:**
   - Graceful handling of ComfyUI server unavailability
   - S3 upload failures should fail the job
   - Clear error messages in job status

## Acceptance Criteria

1. ✅ API endpoint accepts image upload with denoise parameter
2. ✅ Job is queued and processed asynchronously
3. ✅ Original and processed images stored in S3
4. ✅ Job status trackable via API
5. ✅ Authentication required for all endpoints
6. ✅ Database persists job history
7. ✅ Frontend can poll for job completion
8. ✅ Processed images accessible via CloudFront URL

## Assumptions

- ComfyUI server is running and accessible at localhost:8188
- PostgreSQL database migrations will be created separately
- Frontend will implement polling mechanism for job status
- No rate limiting needed initially
- No user notification system needed (no webhooks)
- Single Celery worker initially (can scale later)