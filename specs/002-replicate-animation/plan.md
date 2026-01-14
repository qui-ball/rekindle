# Implementation Plan: Replicate Animation (Image-to-Video)

**Branch**: `002-replicate-animation` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-replicate-animation/spec.md`

## Summary

Implement image-to-video animation using Replicate's wan-video/wan-2.5-i2v model. Users can animate their restored photos by providing a text prompt and selecting video resolution (480p/720p/1080p). The system processes animations asynchronously in the background, allowing users to navigate away and return to view completed results. Videos are retained for 30 days with automatic cleanup.

## Technical Context

**Language/Version**: Python 3.12
**Primary Dependencies**: FastAPI 0.117.1, SQLAlchemy 2.0.43, Celery 5.5.3, httpx 0.28.1, Replicate Python SDK
**Storage**: PostgreSQL (AWS RDS) + AWS S3 (user-scoped storage)
**Testing**: pytest 8.4.2 with pytest-asyncio, pytest-cov, pytest-mock
**Target Platform**: Linux server (Docker containers)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Animation generation completes within Replicate's processing time (~1-3 min for 5s video)
**Constraints**: 10-minute timeout with 1 auto-retry, 30-day video retention, 5-second fixed duration
**Scale/Scope**: Existing user base, async processing via Celery workers

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution template is not yet configured with specific principles for this project. Proceeding with standard best practices:

- [x] Follows existing codebase patterns (Celery tasks, webhook handlers, user-scoped storage)
- [x] Maintains test coverage requirements
- [x] Uses established error handling patterns
- [x] Integrates with existing authentication/authorization

## Project Structure

### Documentation (this feature)

```text
specs/002-replicate-animation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── api/v1/
│   │   ├── jobs.py              # Add animation endpoint
│   │   └── webhooks.py          # Add Replicate animation webhook
│   ├── models/
│   │   └── jobs.py              # AnimationAttempt model (exists, may need updates)
│   ├── schemas/
│   │   └── jobs.py              # Animation request/response schemas
│   ├── services/
│   │   └── replicate_service.py # Add animation methods
│   └── workers/tasks/
│       └── jobs.py              # Update process_animation task
└── tests/
    ├── api/                     # Animation endpoint tests
    ├── services/                # Replicate animation service tests
    └── workers/                 # Animation task tests

frontend/
├── src/
│   ├── components/              # Animation UI components
│   ├── services/                # Animation API client
│   └── types/                   # Animation TypeScript types
└── tests/
```

**Structure Decision**: Web application structure (Option 2) - extending existing backend/frontend architecture with new animation capabilities.

## Complexity Tracking

No constitution violations requiring justification. Implementation follows established patterns.
