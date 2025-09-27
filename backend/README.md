# Rekindle Backend

Photo restoration and colorization service backend built with FastAPI, PostgreSQL, and Celery.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │───▶│    Backend      │───▶│   ComfyUI      │
│                 │    │   (FastAPI)     │    │  (Processing)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│      S3         │    │   PostgreSQL    │    │     Redis       │
│   (Storage)     │    │   (Database)    │    │  (Queue/Cache)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Project Structure

```
backend/
├── app/
│   ├── api/               # API endpoints
│   │   ├── deps.py        # Dependencies (DB session, etc.)
│   │   ├── routes.py      # Main router
│   │   └── v1/
│   │       └── jobs.py    # Job-related endpoints
│   ├── core/
│   │   ├── config.py      # App settings and configuration
│   │   └── database.py    # DB session management
│   ├── models/
│   │   └── jobs.py        # SQLAlchemy models (Job, RestoreAttempt, AnimationAttempt)
│   ├── schemas/
│   │   └── jobs.py        # Pydantic models for validation
│   ├── services/
│   │   ├── comfyui.py     # ComfyUI integration service
│   │   └── s3.py          # AWS S3 service
│   ├── workers/
│   │   ├── celery_app.py  # Celery configuration
│   │   └── tasks/
│   │       └── jobs.py    # Background task definitions
│   └── main.py            # FastAPI app initialization
├── tests/                 # Test suite
├── Dockerfile             # Production container
├── Dockerfile.dev         # Development container
├── pyproject.toml         # Dependencies and project config
└── main.py                # Entry point
```

## Data Models

### Job
- Represents a user's upload session
- Links to email for tracking
- Contains `selected_restore_id` and `latest_animation_id` references

### RestoreAttempt
- Every image restoration attempt on a job
- Stores model, parameters, and S3 keys
- Linked to parent Job

### AnimationAttempt
- Every animation of a restored image
- Stores preview, result, and thumbnail S3 keys
- Linked to Job and RestoreAttempt

## API Workflow

1. **Upload**: `POST /api/v1/jobs/upload`
   - User uploads image with email
   - Creates Job record
   - Uploads processed image to S3

2. **Restore**: `POST /api/v1/jobs/{job_id}/restore`
   - Queues restoration task in Celery
   - Creates RestoreAttempt record
   - Updates Job's selected_restore_id

3. **Animate**: `POST /api/v1/jobs/{job_id}/animate`
   - Queues animation task in Celery
   - Creates AnimationAttempt record
   - Updates Job's latest_animation_id

4. **Retrieve**: `GET /api/v1/jobs/{job_id}`
   - Returns job with all attempts and S3 URLs

## Background Processing

### Celery Tasks

- `process_restoration`: Downloads image from S3, processes via ComfyUI, uploads result
- `process_animation`: Takes restored image, creates animation (placeholder implementation)
- `generate_hd_result`: Creates HD/paid version of animation
- `cleanup_job_s3_files`: Removes S3 files when job is deleted

### ComfyUI Integration

- Uploads image to ComfyUI instance
- Loads restoration workflow from JSON
- Configures parameters (denoise, megapixels)
- Downloads processed result

## Services

### S3Service (`app/services/s3.py`)
- Handles all file uploads/downloads
- Organized folder structure:
  - `processed/{job_id}.{ext}` - Original uploads
  - `restored/{job_id}/{timestamp_id}.jpg` - Restored images
  - `animated/{job_id}/{timestamp_id}_preview.mp4` - Animation previews
  - `animated/{job_id}/{timestamp_id}_result.mp4` - HD results
  - `thumbnails/{job_id}/{timestamp_id}.jpg` - Animation thumbnails

### ComfyUIService (`app/services/comfyui.py`)
- Communicates with ComfyUI server on port 8188
- Manages workflow execution and polling
- Handles image upload/download with ComfyUI

## Configuration

Required environment variables (see `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis
REDIS_URL=redis://host:port/db

# AWS S3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-2
S3_BUCKET=your-bucket

# Auth & Payment
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# External Services
RUNPOD_API_KEY=your-runpod-key
SECRET_KEY=your-jwt-secret
```

## Development Setup

1. **Install dependencies**:
   ```bash
   uv sync
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Start services**:
   ```bash
   # Start PostgreSQL, Redis, ComfyUI as needed
   ```

4. **Run development server**:
   ```bash
   uv run uvicorn app.main:app --reload
   ```

5. **Start Celery worker**:
   ```bash
   uv run celery -A app.workers.celery_app worker --loglevel=info
   ```

## Testing

Run the test suite:

```bash
# All tests
uv run pytest

# Specific test categories
uv run pytest tests/models/ tests/api/ tests/workers/ -v --tb=short

# S3 integration tests
RUN_INTEGRATION_TESTS=1 uv run pytest tests/services/test_s3.py -v

# ComfyUI tests (requires running ComfyUI instance)
COMFYUI_TEST_URL="http://192.168.0.27:8188" uv run pytest tests/services/test_comfyui.py -v
```

## Deployment

### Docker Production
```bash
docker build -f Dockerfile -t rekindle-backend .
docker run -p 8000:8000 rekindle-backend
```

### Docker Development
```bash
docker build -f Dockerfile.dev -t rekindle-backend-dev .
docker run -p 8000:8000 -v $(pwd):/app rekindle-backend-dev
```

## Key Implementation Notes

- Uses UUID primary keys for all models
- Implements timestamp-based S3 key generation for uniqueness
- Celery tasks handle all heavy processing asynchronously
- S3 URLs are generated on-demand in API responses
- Database relationships use CASCADE deletion for cleanup
- Failed tasks create records with error information for debugging
- CORS and trusted host middleware configured for security

## TODO Items

- Implement actual animation processing (currently placeholder)
- Add S3 batch deletion for cleanup tasks
- Implement Auth0 JWT validation middleware
- Add Stripe webhook handling
- Implement RunPod integration for scaling
- Add comprehensive logging and monitoring
- Implement rate limiting and request validation