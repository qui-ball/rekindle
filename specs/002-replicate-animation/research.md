# Research: Replicate Animation (Image-to-Video)

**Branch**: `002-replicate-animation` | **Date**: 2026-01-14

## Summary

Research findings for implementing image-to-video animation using Replicate's wan-video/wan-2.5-i2v model, building on the existing restoration architecture.

---

## 1. Replicate wan-2.5-i2v API

### Decision
Use Replicate's `wan-video/wan-2.5-i2v` model via the same webhook-based async pattern as restoration.

### API Parameters

| Parameter | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| `image` | URI | Yes | - | Input image URL (presigned S3) |
| `prompt` | String | Yes | - | Text description for video generation |
| `duration` | Integer | No | 5 | 5 or 10 seconds (use 5 per spec) |
| `resolution` | String | No | "720p" | "480p", "720p", or "1080p" |
| `negative_prompt` | String | No | "" | Elements to avoid (use empty per spec) |
| `enable_prompt_expansion` | Boolean | No | true | Set to FALSE per spec |
| `seed` | Integer | No | - | For reproducible generation |

### Pricing

| Resolution | Cost/Second | 5s Video Cost |
|-----------|-------------|---------------|
| 480p | $0.05 | $0.25 |
| 720p | $0.10 | $0.50 |
| 1080p | $0.15 | $0.75 |

### Output Format
- MP4 video file delivered via URI
- Access via `output.url` property from prediction result

### Rationale
- Same provider as restoration (Replicate) - no new vendor integration needed
- Webhook pattern already established for async processing
- Pricing is reasonable for feature tier

### Alternatives Considered
1. **RunPod Serverless (existing)**: Currently implemented with ComfyUI WAN-2.2. More complex setup, requires maintaining workflow JSON. Replicate is simpler for this use case.
2. **Synchronous API call**: Would block workers too long (1-3 min generation time). Webhook pattern is better for long-running tasks.

---

## 2. Integration Architecture

### Decision
Extend `ReplicateService` with new method `create_animation_prediction_with_webhook()`, following the existing `create_prediction_with_webhook()` pattern.

### Implementation Pattern

```python
# New method in replicate_service.py
def create_animation_prediction_with_webhook(
    self,
    image_url: str,
    webhook_url: str,
    animation_id: str,
    prompt: str,
    resolution: str = "720p",
    duration: int = 5,
) -> str:
    """Create async animation prediction with webhook notification."""
    input_params = {
        "image": image_url,
        "prompt": prompt,
        "duration": duration,
        "resolution": resolution,
        "negative_prompt": "",
        "enable_prompt_expansion": False,
    }

    prediction = self._client.predictions.create(
        model="wan-video/wan-2.5-i2v",
        input=input_params,
        webhook=webhook_url,
        webhook_events_filter=["completed"],
    )
    return prediction.id
```

### Rationale
- Consistent with existing restoration flow
- Reuses authentication, error handling, logging infrastructure
- Single service class for all Replicate interactions

### Alternatives Considered
1. **Separate AnimationService class**: Would duplicate auth/error handling. Single service is cleaner.
2. **Direct replicate.run() in task**: Would block Celery worker. Webhook approach scales better.

---

## 3. Celery Task Implementation

### Decision
Create new Celery task `process_animation_replicate()` or update existing `process_animation()` to use Replicate when model is "replicate_wan".

### Task Flow

1. Receive `job_id`, `restore_id`, `params` (prompt, resolution)
2. Look up source image (restored image S3 key)
3. Generate presigned URL for source image
4. Create animation attempt record with status "pending"
5. Submit to Replicate with webhook URL
6. Return immediately (webhook handles completion)

### Timeout Handling (per spec: 10 min timeout, 1 auto-retry)

```python
@celery_app.task(
    bind=True,
    autoretry_for=(ReplicateError,),
    retry_kwargs={'max_retries': 1},
    default_retry_delay=5,
    time_limit=600,  # 10 minute hard limit
    soft_time_limit=540,  # 9 minute soft limit for graceful handling
)
def process_animation_replicate(self, job_id, restore_id, params):
    ...
```

### Rationale
- Celery handles retry logic automatically
- Time limits prevent runaway tasks
- Matches spec requirements exactly

---

## 4. Webhook Handler

### Decision
Add new webhook endpoint `/api/v1/webhooks/replicate/animation/{animation_id}` for animation completion callbacks.

### Handler Flow

1. Receive Replicate webhook POST
2. Validate prediction completed successfully
3. Download video from Replicate CDN
4. Upload to S3 at `animations/{job_id}/{animation_id}.mp4`
5. Update `AnimationAttempt.preview_s3_key` with S3 path
6. Broadcast SSE event for real-time UI update

### Rationale
- Separate endpoint from restoration webhook for clarity
- Same pattern, just different entity updates
- SSE broadcast enables real-time progress in UI

---

## 5. Database Model Updates

### Decision
No schema changes needed - existing `AnimationAttempt` model is sufficient.

### Existing Model (already suitable)

```python
class AnimationAttempt(Base):
    id: GUID
    job_id: GUID (FK)
    restore_id: GUID (FK, nullable)  # Source restored image
    preview_s3_key: str              # "pending" or S3 path to video
    result_s3_key: str (nullable)    # HD result if applicable
    thumb_s3_key: str (nullable)     # Video thumbnail
    model: str                       # "replicate_wan"
    params: JSON                     # {prompt, resolution, duration}
    created_at: DateTime
```

### Rationale
- Model already captures all needed fields
- `params` JSON can store prompt, resolution, any future options
- No migration needed

---

## 6. Video Retention (30-day cleanup)

### Decision
Implement scheduled Celery beat task for video cleanup.

### Implementation

```python
# In celery_app.py beat schedule
celery_app.conf.beat_schedule = {
    'cleanup-expired-animations': {
        'task': 'app.workers.tasks.jobs.cleanup_expired_animations',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
    },
}

# In tasks/jobs.py
@celery_app.task
def cleanup_expired_animations():
    """Delete animations older than 30 days."""
    cutoff = datetime.utcnow() - timedelta(days=30)
    expired = db.query(AnimationAttempt).filter(
        AnimationAttempt.created_at < cutoff
    ).all()

    for animation in expired:
        # Delete S3 objects
        if animation.preview_s3_key and animation.preview_s3_key != "pending":
            s3_service.delete_object(animation.preview_s3_key)
        # Delete database record
        db.delete(animation)

    db.commit()
```

### Rationale
- Scheduled task is cleanest approach for retention policy
- Runs during low-traffic hours
- Handles both S3 and database cleanup

### Alternatives Considered
1. **S3 lifecycle rules**: Would only delete S3 objects, not database records. Need both.
2. **On-access check**: Too complex, introduces latency on every request.

---

## 7. Frontend UI Considerations

### Decision
Add resolution selector dropdown, prompt input, and "Animate" button to restored image view.

### UI Components Needed
1. **AnimationControls**: Resolution dropdown (480p/720p/1080p), prompt textarea
2. **AnimationProgress**: Shows generation status with spinner/progress indicator
3. **VideoPlayer**: Plays completed animation with download button

### Integration Points
- Add to existing photo detail view
- Trigger animation via existing `POST /api/v1/jobs/{job_id}/animate` endpoint
- Poll job status or use SSE for real-time updates

### Rationale
- Minimal UI changes - reuse existing job detail patterns
- Resolution selector is explicit per spec requirements

---

## 8. Error Handling

### Decision
Follow existing error patterns with user-friendly messages.

### Error Scenarios

| Error | User Message | Recovery |
|-------|--------------|----------|
| Replicate API error | "Animation service temporarily unavailable. Please try again." | Auto-retry once |
| Timeout (10 min) | "Animation took too long. Please try again with a simpler prompt." | Manual retry |
| Invalid image | "Source image could not be processed. Please try a different photo." | No retry |
| Rate limit | "Too many requests. Please wait a moment and try again." | Respect retry-after |

### Rationale
- Consistent with existing restoration error handling
- Clear, actionable messages for users
- Automatic retry for transient errors

---

## Summary of Decisions

| Area | Decision |
|------|----------|
| Model | Replicate `wan-video/wan-2.5-i2v` |
| Integration | Extend `ReplicateService` with animation method |
| Processing | Async webhook pattern (non-blocking) |
| Timeout | 10 min with 1 auto-retry (Celery config) |
| Retention | 30-day cleanup via scheduled Celery beat task |
| Database | Use existing `AnimationAttempt` model (no changes) |
| API | Existing `POST /jobs/{id}/animate` endpoint works |
| Webhook | New `/webhooks/replicate/animation/{id}` endpoint |
