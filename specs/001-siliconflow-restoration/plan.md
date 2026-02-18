# Implementation Plan: SiliconFlow Photo Restoration

**Branch**: `001-siliconflow-restoration` | **Date**: 2025-12-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-siliconflow-restoration/spec.md`

## Summary

Replace RunPod/ComfyUI-based photo restoration with SiliconFlow's Qwen-Image-Edit API to eliminate cold-start delays and simplify infrastructure. Create a new `SiliconFlowService` that submits images via presigned S3 URLs, downloads results, and integrates with existing Photo/RestoreAttempt models. Includes image preprocessing (resize, format conversion) and error handling.

## Technical Context

**Language/Version**: Python 3.12
**Primary Dependencies**: FastAPI 0.117.1, SQLAlchemy 2.0.43, Celery 5.5.3, httpx 0.28.1, Pillow 10.0.0, boto3
**Storage**: PostgreSQL (via SQLAlchemy), AWS S3 (file storage)
**Testing**: pytest 8.4.2, pytest-asyncio, pytest-mock
**Target Platform**: Linux server (Docker containers)
**Project Type**: web (backend API + frontend)
**Performance Goals**: Photo restoration completes within 60 seconds average
**Constraints**: No automatic retries; fail immediately on API errors
**Scale/Scope**: Existing production app with user authentication, credits system

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: PASS (No project constitution defined - using default patterns)

The constitution file contains only template placeholders. Proceeding with standard software engineering best practices:
- Service-oriented architecture (new SiliconFlowService)
- Unit and integration tests for new service
- Existing patterns followed (consistent with RunPodServerlessService)

## Project Structure

### Documentation (this feature)

```text
specs/001-siliconflow-restoration/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── services/
│   │   ├── siliconflow.py          # NEW: SiliconFlow API service
│   │   ├── image_processor.py      # NEW: Image resize/convert utilities
│   │   ├── runpod_serverless.py    # EXISTING: Keep for animation
│   │   ├── storage_service.py      # EXISTING: S3 presigned URLs
│   │   └── s3.py                   # EXISTING: S3 operations
│   ├── workers/tasks/
│   │   └── jobs.py                 # MODIFY: Route restoration to SiliconFlow
│   ├── api/v1/
│   │   ├── photos.py               # EXISTING: Photo endpoints
│   │   └── webhooks.py             # EXISTING: May need minor updates
│   └── core/
│       └── config.py               # MODIFY: Add SILICONFLOW_API_KEY
└── tests/
    └── services/
        ├── test_siliconflow.py     # NEW: SiliconFlow service tests
        └── test_image_processor.py # NEW: Image processing tests
```

**Structure Decision**: Web application pattern (backend + frontend). This feature only modifies backend. New service follows existing patterns in `backend/app/services/`.

## Complexity Tracking

> No constitution violations. Feature follows existing patterns.
