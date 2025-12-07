# Research: SiliconFlow Photo Restoration

**Feature Branch**: `001-siliconflow-restoration`
**Date**: 2025-12-06

## 1. SiliconFlow API Integration

### Decision: Use SiliconFlow's Image Generations Endpoint

**Endpoint**: `https://api.siliconflow.com/v1/images/generations`

**Rationale**:
- SiliconFlow provides a simple REST API for Qwen-Image-Edit
- Pay-per-use pricing ($0.04/image) eliminates infrastructure complexity
- No cold-start delays unlike RunPod serverless
- Well-documented OpenAI-compatible API format

**Alternatives Considered**:
- RunPod Serverless (current) - Complex, slow cold starts, high infrastructure overhead
- Replicate API - Similar pricing but less documentation
- Self-hosted - Requires 60GB+ VRAM, not viable for current infrastructure

### API Specification

**Request Format**:
```json
{
  "model": "Qwen/Qwen-Image-Edit",
  "prompt": "Restore this old damaged photo. Enhance clarity, remove scratches and damage, improve colors while preserving original details.",
  "image": "https://s3.amazonaws.com/bucket/photo.jpg",
  "num_inference_steps": 20,
  "guidance_scale": 7.5
}
```

**Response Format**:
```json
{
  "images": [{"url": "https://cdn.siliconflow.com/generated/..."}],
  "timings": {"inference": 12.5},
  "seed": 123456
}
```

**Key Constraints**:
- Image URL must be publicly accessible (presigned S3 URL works)
- Response URL valid for 1 hour only - must download immediately
- Maximum prompt length: 800 characters
- Model supports base64 or URL image input

## 2. Image Preprocessing

### Decision: Use Pillow for Resize and Format Conversion

**Rationale**:
- Already a project dependency (Pillow 10.0.0)
- Well-tested, production-ready library
- Supports all required formats (HEIC, WebP, TIFF → JPEG)

**Alternatives Considered**:
- ImageMagick via subprocess - External dependency, harder to deploy
- OpenCV - Overkill for simple resize/convert operations

### Implementation Approach

```python
from PIL import Image
import io

def preprocess_image(image_bytes: bytes) -> bytes:
    """Resize and convert image for SiliconFlow API"""
    img = Image.open(io.BytesIO(image_bytes))

    # Convert to RGB (handles RGBA, grayscale, etc.)
    if img.mode != 'RGB':
        img = img.convert('RGB')

    # Resize if exceeds max dimensions (3584x3584 per API docs)
    max_dim = 3584
    if img.width > max_dim or img.height > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    # Output as JPEG
    output = io.BytesIO()
    img.save(output, format='JPEG', quality=95)
    return output.getvalue()
```

## 3. Service Architecture

### Decision: Synchronous API Call Pattern

**Rationale**:
- SiliconFlow API is synchronous (returns result directly)
- No webhook complexity needed
- Simpler error handling than async/webhook pattern
- Response time (~10-30s) acceptable for user experience

**Alternatives Considered**:
- Webhook pattern (current RunPod approach) - More complex, unnecessary for synchronous API
- Polling pattern - Adds latency, not needed for synchronous API

### Service Structure

```
SiliconFlowService
├── __init__(api_key)           # Initialize with API key
├── restore_image(image_url, prompt) -> bytes  # Main restoration method
│   ├── Submit request to API
│   ├── Wait for response
│   └── Download and return result
└── _download_result(url) -> bytes  # Download from CDN URL
```

## 4. Integration with Existing System

### Decision: Modify Celery Task, Add New Service

**Rationale**:
- Celery task `process_restoration` already handles async processing
- New `SiliconFlowService` follows same pattern as `RunPodServerlessService`
- Minimal changes to existing API endpoints
- RestoreAttempt model unchanged (just different metadata in params)

**Files to Modify**:
1. `backend/app/services/siliconflow.py` - NEW: API client
2. `backend/app/services/image_processor.py` - NEW: Preprocessing utilities
3. `backend/app/workers/tasks/jobs.py` - MODIFY: Route to SiliconFlow
4. `backend/app/core/config.py` - MODIFY: Add SILICONFLOW_API_KEY

**Files Unchanged**:
- `backend/app/api/v1/photos.py` - Existing endpoints work as-is
- `backend/app/models/` - No model changes needed

## 5. Error Handling

### Decision: Fail Fast, No Retries

**Rationale** (per clarification session):
- User can manually retry if needed
- Simpler implementation
- Avoids credit double-charging issues
- Clear error messages more valuable than silent retries

**Error Categories**:
| Error Type | HTTP Status | User Message |
|------------|-------------|--------------|
| Invalid API key | 401 | "Service configuration error" |
| Rate limited | 429 | "Service busy, please try again" |
| Invalid image | 400 | "Image could not be processed" |
| API timeout | 504 | "Service timeout, please retry" |
| Network error | 503 | "Service unavailable" |

## 6. Configuration

### Decision: Environment Variable Pattern

**New Settings** (add to `.env`):
```
SILICONFLOW_API_KEY=sk-xxx
SILICONFLOW_API_URL=https://api.siliconflow.com/v1/images/generations
SILICONFLOW_MODEL=Qwen/Qwen-Image-Edit
SILICONFLOW_TIMEOUT=120
```

**Defaults**:
- URL: `https://api.siliconflow.com/v1/images/generations`
- Model: `Qwen/Qwen-Image-Edit`
- Timeout: 120 seconds (API typically responds in 10-30s)

## 7. Testing Strategy

### Unit Tests
- `SiliconFlowService` with mocked HTTP responses
- `ImageProcessor` with sample images of various formats
- Error handling for all error categories

### Integration Tests
- End-to-end restoration with real SiliconFlow API (optional, requires API key)
- Marked with `@pytest.mark.integration`

## Sources

- [SiliconFlow Image Generations API](https://docs.siliconflow.com/en/api-reference/images/images-generations)
- [Qwen-Image-Edit Model Info](https://www.siliconflow.com/models/qwen-qwen-image-edit)
- [AI/ML API Qwen-Image-Edit Docs](https://docs.aimlapi.com/api-references/image-models/alibaba-cloud/qwen-image-edit)
