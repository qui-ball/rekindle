# Data Model: SiliconFlow Photo Restoration

**Feature Branch**: `001-siliconflow-restoration`
**Date**: 2025-12-06

## Overview

This feature does not require database schema changes. Existing models (Photo, Job, RestoreAttempt) are sufficient. This document describes how existing entities are used and what metadata changes occur.

## Existing Entities (No Changes Required)

### Photo

**Table**: `photos`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| owner_id | String | User ID from Supabase auth |
| original_key | String | S3 key for original uploaded photo |
| processed_key | String (nullable) | S3 key for restored photo |
| thumbnail_key | String (nullable) | S3 key for thumbnail |
| status | String | `uploaded` → `processing` → `ready` |
| size_bytes | BigInteger | File size |
| mime_type | String | e.g., `image/jpeg` |
| checksum_sha256 | String | File hash for deduplication |
| metadata_json | JSON | Additional metadata |
| created_at | DateTime | Creation timestamp |
| updated_at | DateTime | Last update timestamp |

**Status Transitions**:
```
uploaded ──[restore request]──> processing ──[success]──> ready
                                    │
                                    └──[failure]──> uploaded (reverts)
```

### RestoreAttempt

**Table**: `restore_attempts`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| job_id | UUID | Foreign key to jobs table |
| s3_key | String | S3 key for restored image |
| model | String | Model used (e.g., `Qwen/Qwen-Image-Edit`) |
| params | JSON | Parameters and metadata |
| created_at | DateTime | Creation timestamp |

**params JSON Structure (SiliconFlow)**:
```json
{
  "provider": "siliconflow",
  "prompt": "Restore this old damaged photo...",
  "num_inference_steps": 20,
  "guidance_scale": 7.5,
  "inference_time_seconds": 12.5,
  "seed": 123456,
  "preprocessed": {
    "resized": true,
    "original_dimensions": [4000, 3000],
    "submitted_dimensions": [3584, 2688],
    "format_converted": true,
    "original_format": "HEIC"
  }
}
```

### Job

**Table**: `jobs`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key (same as photo_id for new photos) |
| email | String | User email |
| selected_restore_id | UUID | Currently selected restoration |
| latest_animation_id | UUID | Latest animation attempt |
| thumbnail_s3_key | String | Thumbnail S3 key |
| created_at | DateTime | Creation timestamp |

**Note**: Job model is used for backward compatibility. New photo-based restorations set `job.id = photo.id`.

## New Service Entities (In-Memory Only)

### SiliconFlowRequest

Internal data class for API requests:

```python
@dataclass
class SiliconFlowRequest:
    model: str = "Qwen/Qwen-Image-Edit"
    prompt: str = "Restore this old damaged photo..."
    image_url: str  # Presigned S3 URL
    num_inference_steps: int = 20
    guidance_scale: float = 7.5
```

### SiliconFlowResponse

Internal data class for API responses:

```python
@dataclass
class SiliconFlowResponse:
    image_url: str  # CDN URL (valid for 1 hour)
    inference_time: float  # Seconds
    seed: int
```

### ImagePreprocessResult

Internal data class for preprocessing:

```python
@dataclass
class ImagePreprocessResult:
    image_bytes: bytes
    resized: bool
    original_dimensions: Tuple[int, int]
    new_dimensions: Tuple[int, int]
    format_converted: bool
    original_format: str
```

## Validation Rules

### Photo Status Transitions

| Current Status | Valid Next Status | Trigger |
|---------------|-------------------|---------|
| uploaded | processing | Restore request received |
| processing | ready | Restoration successful |
| processing | uploaded | Restoration failed (revert) |
| ready | processing | New restore request |
| ready | archived | User archives |
| archived | deleted | User deletes |

### RestoreAttempt Constraints

- `s3_key` must be a valid S3 path
- `model` should match known model identifiers
- `params.provider` should be `siliconflow` for this feature

### Concurrency Control

- Only one restoration can be in progress per photo at a time
- Check `photo.status == 'processing'` before starting new restoration
- Return HTTP 409 Conflict if restoration already in progress

## Data Flow

```
1. User requests restoration
   └─> Check photo.status != 'processing'
   └─> Set photo.status = 'processing'
   └─> Create RestoreAttempt with s3_key='pending'
   └─> Queue Celery task

2. Celery task executes
   └─> Download original from S3 (photo.original_key)
   └─> Preprocess image (resize/convert)
   └─> Generate presigned URL for preprocessed image
   └─> Call SiliconFlow API with URL
   └─> Download result from SiliconFlow CDN
   └─> Upload to S3 (restored/{job_id}/{timestamp}.jpg)

3. Update database
   └─> RestoreAttempt.s3_key = new S3 key
   └─> RestoreAttempt.params = API metadata
   └─> Photo.processed_key = new S3 key
   └─> Photo.status = 'ready'

4. Error handling
   └─> Photo.status = 'uploaded' (revert)
   └─> RestoreAttempt.params.error = error message
```

## Indexes (Existing - No Changes)

- `photos.owner_id` - Query photos by user
- `photos.status` - Filter by processing status
- `restore_attempts.job_id` - Query attempts by job
- `jobs.email` - Query jobs by user email
