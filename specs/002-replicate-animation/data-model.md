# Data Model: Replicate Animation (Image-to-Video)

**Branch**: `002-replicate-animation` | **Date**: 2026-01-14

## Overview

This feature uses the existing `AnimationAttempt` model. No database schema changes are required.

---

## Entities

### AnimationAttempt (Existing - No Changes)

Represents an animation generation request and its result.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `job_id` | UUID | FK → jobs.id, NOT NULL | Parent job reference |
| `restore_id` | UUID | FK → restore_attempts.id, NULLABLE | Source restored image (optional) |
| `preview_s3_key` | String | NOT NULL | "pending", "failed", or S3 path to video |
| `result_s3_key` | String | NULLABLE | HD result video path (if applicable) |
| `thumb_s3_key` | String | NULLABLE | Video thumbnail image path |
| `model` | String | NULLABLE | Model identifier (e.g., "replicate_wan") |
| `params` | JSON | NULLABLE | Animation parameters |
| `created_at` | DateTime | auto, with TZ | Creation timestamp |

### params JSON Structure

For Replicate wan-2.5-i2v animations:

```json
{
  "prompt": "A gentle breeze moves through the scene",
  "resolution": "720p",
  "duration": 5,
  "provider": "replicate",
  "replicate_prediction_id": "abc123..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | User-provided animation prompt |
| `resolution` | string | Yes | "480p", "720p", or "1080p" |
| `duration` | integer | Yes | Video duration in seconds (always 5) |
| `provider` | string | Yes | "replicate" for this implementation |
| `replicate_prediction_id` | string | Yes | Replicate API prediction ID |

---

## State Transitions

### AnimationAttempt.preview_s3_key States

```
"" (empty) → "pending" → "animations/{job_id}/{animation_id}.mp4"
                     ↘
                      "failed"
```

| State | Meaning | Next States |
|-------|---------|-------------|
| `""` or `"pending"` | Generation in progress | S3 path, "failed" |
| `"failed"` | Generation failed | (terminal) |
| `animations/...` | Video ready | (terminal, until 30-day cleanup) |

---

## Relationships

```
Job (1) ──────< (N) AnimationAttempt
                         │
                         └── (0..1) RestoreAttempt
```

- A `Job` can have multiple `AnimationAttempt` records
- Each `AnimationAttempt` optionally references one `RestoreAttempt` as its source image
- If `restore_id` is NULL, the original uploaded image is used

---

## S3 Storage Structure

### Animation Videos

```
animations/
└── {job_id}/
    └── {animation_id}.mp4
```

### Example Paths

```
animations/550e8400-e29b-41d4-a716-446655440000/
├── 6ba7b810-9dad-11d1-80b4-00c04fd430c8.mp4  # First animation
└── 6ba7b811-9dad-11d1-80b4-00c04fd430c8.mp4  # Second animation
```

---

## Validation Rules

### Animation Creation

| Field | Rule | Error Message |
|-------|------|---------------|
| `prompt` | Required, 1-500 characters | "Prompt is required (max 500 characters)" |
| `resolution` | Must be "480p", "720p", or "1080p" | "Invalid resolution. Choose 480p, 720p, or 1080p" |
| `restore_id` | If provided, must exist and belong to job | "Restore attempt not found" |
| `job_id` | Must exist and belong to current user | "Job not found" |

### Video Retention

| Rule | Implementation |
|------|----------------|
| 30-day retention | `created_at + 30 days = expiration` |
| Cleanup trigger | Daily scheduled task at 3 AM UTC |
| Cleanup scope | Both S3 object and database record |

---

## Indexes (Existing)

| Table | Column(s) | Type | Purpose |
|-------|-----------|------|---------|
| animation_attempts | job_id | B-tree | Job lookup |
| animation_attempts | restore_id | B-tree | Source image lookup |
| animation_attempts | created_at | B-tree | Retention cleanup queries |

---

## Migration Status

**No migration required** - The `AnimationAttempt` model already exists with all necessary fields.

If the `created_at` index doesn't exist, add it for retention cleanup performance:

```sql
-- Only if index doesn't exist
CREATE INDEX IF NOT EXISTS ix_animation_attempts_created_at
ON animation_attempts (created_at);
```
