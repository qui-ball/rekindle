# Quickstart: SiliconFlow Photo Restoration

**Feature Branch**: `001-siliconflow-restoration`
**Date**: 2025-12-06

## Prerequisites

1. **SiliconFlow API Key**: Obtain from [SiliconFlow Console](https://www.siliconflow.com/)
2. **Backend environment**: Python 3.12, existing Rekindle backend setup

## Setup

### 1. Add Environment Variable

Add to `backend/.env`:

```bash
SILICONFLOW_API_KEY=sk-your-api-key-here
```

### 2. Verify Configuration

```bash
cd backend
grep SILICONFLOW .env
# Should show: SILICONFLOW_API_KEY=sk-...
```

## Quick Test

### Test SiliconFlow Service Directly

```python
# backend/scripts/test_siliconflow.py
import asyncio
from app.services.siliconflow import SiliconFlowService

async def test():
    service = SiliconFlowService()

    # Test with a sample image URL (must be accessible to SiliconFlow)
    image_url = "https://your-s3-bucket.s3.amazonaws.com/sample-old-photo.jpg"

    image_bytes, metadata = await service.restore_image(image_url)
    print(f"Restored image size: {len(image_bytes)} bytes")
    print(f"Inference time: {metadata['inference_time_seconds']}s")
    print(f"Model: {metadata['model']}")

if __name__ == "__main__":
    asyncio.run(test())
```

Run:
```bash
cd backend
uv run python scripts/test_siliconflow.py
```

### Test via API Endpoint

```bash
# 1. Upload a photo first (get photo_id)
# 2. Request restoration
curl -X POST "http://localhost:8000/api/v1/photos/{photo_id}/restore" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Response:
# {"id": "uuid", "status": "pending", ...}
```

## Development Workflow

### Run Tests

```bash
cd backend

# Unit tests only
uv run pytest tests/services/test_siliconflow.py -v

# With integration tests (requires API key)
SILICONFLOW_API_KEY=sk-xxx uv run pytest tests/services/test_siliconflow.py -v -m integration
```

### Start Development Server

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

### Start Celery Worker

```bash
cd backend
uv run celery -A app.workers.celery_app worker --loglevel=info
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/services/siliconflow.py` | SiliconFlow API client |
| `backend/app/services/image_processor.py` | Image resize/convert |
| `backend/app/workers/tasks/jobs.py` | Celery restoration task |
| `backend/app/core/config.py` | Configuration settings |
| `backend/tests/services/test_siliconflow.py` | Service tests |

## Common Issues

### "SILICONFLOW_API_KEY is required"

Add the API key to `backend/.env`:
```bash
echo "SILICONFLOW_API_KEY=sk-your-key" >> backend/.env
```

### "Image URL not accessible"

Ensure S3 presigned URLs are generated with sufficient expiration time (default 1 hour).

### "Rate limited"

SiliconFlow has rate limits. Wait and retry, or contact SiliconFlow for higher limits.

## Architecture Overview

```
User Request
    │
    ▼
POST /photos/{id}/restore
    │
    ▼
Celery Task Queue
    │
    ▼
┌─────────────────────────┐
│   process_restoration   │
│   (Celery Worker)       │
│                         │
│ 1. Download from S3     │
│ 2. Preprocess image     │
│ 3. Upload preprocessed  │
│ 4. Call SiliconFlow API │
│ 5. Download result      │
│ 6. Upload to S3         │
│ 7. Update database      │
└─────────────────────────┘
    │
    ▼
Photo.status = "ready"
```

## Next Steps

1. Review [spec.md](./spec.md) for full requirements
2. Review [research.md](./research.md) for API details
3. Review [data-model.md](./data-model.md) for data structures
4. Run `/speckit.tasks` to generate implementation tasks
