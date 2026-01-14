# Quickstart: Replicate Animation (Image-to-Video)

**Branch**: `002-replicate-animation` | **Date**: 2026-01-14

## Prerequisites

- Python 3.12+
- Redis running (for Celery)
- PostgreSQL database configured
- AWS S3 bucket configured
- Replicate API token

## Environment Variables

Add to `.env`:

```bash
# Already configured for restoration, reused for animation
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# New: Animation-specific (optional, uses defaults)
REPLICATE_ANIMATION_MODEL=wan-video/wan-2.5-i2v
REPLICATE_ANIMATION_TIMEOUT=600  # 10 minutes
```

## Quick Test

### 1. Start Backend Services

```bash
# Terminal 1: Start API server
cd backend
uvicorn app.main:app --reload

# Terminal 2: Start Celery worker
cd backend
celery -A app.workers.celery_app worker --loglevel=info

# Terminal 3: Start Celery beat (for cleanup task)
cd backend
celery -A app.workers.celery_app beat --loglevel=info
```

### 2. Create Animation via API

```bash
# Assuming you have a job with a restored image
JOB_ID="your-job-uuid"
RESTORE_ID="your-restore-uuid"
TOKEN="your-jwt-token"

curl -X POST "http://localhost:8000/api/v1/jobs/${JOB_ID}/animate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "restore_id": "'${RESTORE_ID}'",
    "params": {
      "prompt": "A gentle breeze moves through the scene",
      "resolution": "720p"
    }
  }'
```

### 3. Expected Response

```json
{
  "id": "animation-uuid",
  "job_id": "job-uuid",
  "restore_id": "restore-uuid",
  "preview_s3_key": "pending",
  "model": "replicate_wan",
  "params": {
    "prompt": "A gentle breeze moves through the scene",
    "resolution": "720p"
  },
  "created_at": "2026-01-14T12:00:00Z",
  "preview_url": null
}
```

### 4. Check Animation Status

```bash
curl "http://localhost:8000/api/v1/jobs/${JOB_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
```

When complete, `animation_attempts[].preview_url` will contain a presigned S3 URL.

## Running Tests

```bash
cd backend

# Run all tests
pytest

# Run animation-specific tests
pytest tests/services/test_replicate_animation.py
pytest tests/api/test_animation_endpoint.py
pytest tests/workers/test_animation_task.py

# With coverage
pytest --cov=app tests/
```

## Frontend Development

### Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### Animation Flow

1. User views a restored photo
2. User enters animation prompt and selects resolution
3. User clicks "Animate"
4. Frontend calls `POST /api/v1/jobs/{id}/animate`
5. Shows progress spinner
6. Polls job status or listens for SSE events
7. When complete, displays video player with download button

## Key Files

### Backend

| File | Purpose |
|------|---------|
| `app/services/replicate_service.py` | Add `create_animation_prediction_with_webhook()` |
| `app/workers/tasks/jobs.py` | Update `process_animation()` for Replicate |
| `app/api/v1/webhooks.py` | Add animation webhook handler |
| `app/api/v1/jobs.py` | Existing endpoint, no changes needed |

### Frontend

| File | Purpose |
|------|---------|
| `src/components/AnimationControls.tsx` | Resolution picker, prompt input |
| `src/components/VideoPlayer.tsx` | Video playback with download |
| `src/services/api.ts` | Add `createAnimation()` method |

## Troubleshooting

### Animation stuck on "pending"

1. Check Celery worker logs for errors
2. Verify Replicate API token is valid
3. Check webhook URL is accessible (use ngrok for local dev)

### Webhook not received

1. Ensure `BACKEND_URL` is publicly accessible
2. Check Replicate dashboard for webhook delivery logs
3. Verify webhook endpoint returns 200

### Video not playing

1. Check S3 permissions allow public read
2. Verify video was uploaded successfully
3. Check browser console for CORS errors

## Webhook Testing (Local Development)

For local development, use ngrok to expose your webhook:

```bash
# Terminal: Start ngrok
ngrok http 8000

# Use the ngrok URL in your webhook configuration
# e.g., https://abc123.ngrok.io/api/v1/webhooks/replicate/animation/{id}
```

Set in `.env`:

```bash
BACKEND_URL=https://abc123.ngrok.io
```
