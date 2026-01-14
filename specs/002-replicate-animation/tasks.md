# Tasks: Replicate Animation (Image-to-Video)

**Input**: Design documents from `/specs/002-replicate-animation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/app/` for source, `backend/tests/` for tests
- **Frontend**: `frontend/src/` for source

---

## Phase 1: Setup

**Purpose**: Environment configuration for Replicate animation integration

- [x] T001 Verify Replicate API token is configured in backend/app/core/config.py (REPLICATE_API_TOKEN already exists)
- [x] T002 Add animation model constant to backend/app/core/config.py (REPLICATE_ANIMATION_MODEL = "wan-video/wan-2.5-i2v")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Add `create_animation_prediction_with_webhook()` method to backend/app/services/replicate_service.py
- [x] T004 Add animation webhook endpoint `/api/v1/webhooks/replicate/animation/{animation_id}` in backend/app/api/v1/webhooks.py
- [x] T005 [P] Add `download_replicate_video()` helper function in backend/app/services/replicate_service.py
- [x] T006 Update `process_animation()` Celery task to use Replicate when model is "replicate_wan" in backend/app/workers/tasks/jobs.py
- [x] T007 [P] Add Celery beat schedule for `cleanup_expired_animations` task in backend/app/workers/celery_app.py
- [x] T008 [P] Implement `cleanup_expired_animations` task in backend/app/workers/tasks/jobs.py

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Generate Animation from Restored Photo (Priority: P1) 🎯 MVP

**Goal**: Users can animate their restored photos by providing a text prompt, generating an animated video that can be viewed and downloaded.

**Independent Test**: Upload image, complete restoration, initiate animation with prompt. Verify video is generated, viewable inline, and downloadable.

### Implementation for User Story 1

- [x] T009 [US1] Update `AnimationAttemptCreate` schema to require `params.prompt` in backend/app/schemas/jobs.py
- [x] T010 [US1] Add prompt validation (1-500 chars) in backend/app/api/v1/jobs.py create_animation_attempt endpoint
- [x] T011 [US1] Update `create_animation_attempt` endpoint to pass prompt to Celery task in backend/app/api/v1/jobs.py
- [x] T012 [US1] Implement S3 upload for animation videos in webhook handler in backend/app/api/v1/webhooks.py
- [x] T013 [US1] Add video presigned URL generation in job response in backend/app/api/v1/jobs.py get_job endpoint
- [x] T014 [P] [US1] Create AnimationControls component with prompt input in frontend/src/components/AnimationControls.tsx
- [x] T015 [P] [US1] Create AnimationProgress component with spinner/status in frontend/src/components/AnimationProgress.tsx
- [x] T016 [P] [US1] Create VideoPlayer component with playback and download in frontend/src/components/VideoPlayer.tsx
- [x] T017 [US1] Add createAnimation API method in frontend/src/services/animationService.ts
- [x] T018 [US1] Integrate animation controls into photo detail view in frontend/src/components/PhotoManagement/PhotoDetailDrawer.tsx
- [x] T019 [US1] Add animation status polling or SSE listener in frontend/src/hooks/useAnimationStatus.ts

**Checkpoint**: User Story 1 complete - users can generate and view/download animations with default resolution (720p)

---

## Phase 4: User Story 2 - Configure Animation Settings (Priority: P2)

**Goal**: Users can select video resolution (480p, 720p, 1080p) before initiating animation.

**Independent Test**: Select different resolution options and verify the output video matches the selected resolution.

### Implementation for User Story 2

- [x] T020 [US2] Add resolution validation to `AnimationAttemptCreate` schema in backend/app/schemas/jobs.py
- [x] T021 [US2] Pass resolution parameter through to Replicate API call in backend/app/services/replicate_service.py
- [x] T022 [US2] Store resolution in animation params JSON in backend/app/workers/tasks/jobs.py
- [x] T023 [P] [US2] Add resolution dropdown to AnimationControls component in frontend/src/components/AnimationControls.tsx
- [x] T024 [US2] Update createAnimation API call to include resolution in frontend/src/services/animationService.ts
- [x] T025 [US2] Add resolution type definitions in frontend/src/types/animation.ts

**Checkpoint**: User Story 2 complete - users can select 480p/720p/1080p resolution

---

## Phase 5: User Story 3 - Handle Animation Generation Errors (Priority: P3)

**Goal**: System gracefully handles failures with clear error messaging and retry capability.

**Independent Test**: Simulate generation failures and verify error messages appear with retry functionality.

### Implementation for User Story 3

- [x] T026 [US3] Add error status handling in animation webhook (status="failed") in backend/app/api/v1/webhooks.py
- [x] T027 [US3] Update AnimationAttempt preview_s3_key to "failed" with error in params JSON in backend/app/api/v1/webhooks.py
- [x] T028 [US3] Add user-friendly error messages mapping in backend/app/services/replicate_service.py
- [x] T029 [US3] Configure Celery auto-retry (1 retry after timeout) in backend/app/workers/tasks/jobs.py
- [x] T030 [P] [US3] Add error state display to AnimationProgress component in frontend/src/components/AnimationProgress.tsx
- [x] T031 [P] [US3] Add retry button to AnimationControls component in frontend/src/components/AnimationControls.tsx
- [x] T032 [US3] Implement retry logic preserving prompt and settings in frontend/src/components/AnimationPanel.tsx
- [x] T033 [US3] Add error message display with appropriate user messaging in frontend/src/components/AnimationProgress.tsx

**Checkpoint**: User Story 3 complete - users see clear errors and can retry failed animations

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T034 [P] Add logging for animation operations (start, complete, error) in backend/app/workers/tasks/jobs.py
- [x] T035 [P] Add SSE event broadcast on animation completion in backend/app/api/v1/webhooks.py
- [ ] T036 Verify 30-day retention cleanup task works correctly
- [ ] T037 Run quickstart.md validation - test full animation flow end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Core animation generation
- **User Story 2 (P2)**: Can start after Foundational - Resolution selection independent of US1 but enhances it
- **User Story 3 (P3)**: Can start after Foundational - Error handling independent of US1/US2

### Within Each User Story

- Backend changes before frontend integration
- Services before API endpoints
- API endpoints before frontend components
- Core implementation before polish

### Parallel Opportunities

**Foundational Phase (after T003):**
```
T005 (download helper) || T007 (beat schedule) || T008 (cleanup task)
```

**User Story 1 (after T013):**
```
T014 (AnimationControls) || T015 (AnimationProgress) || T016 (VideoPlayer)
```

**User Story 3 (after backend complete):**
```
T030 (error display) || T031 (retry button)
```

---

## Parallel Example: User Story 1 Frontend

```bash
# Launch all frontend components in parallel (after backend is ready):
Task: "Create AnimationControls component in frontend/src/components/AnimationControls.tsx"
Task: "Create AnimationProgress component in frontend/src/components/AnimationProgress.tsx"
Task: "Create VideoPlayer component in frontend/src/components/VideoPlayer.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T008)
3. Complete Phase 3: User Story 1 (T009-T019)
4. **STOP and VALIDATE**: Test animation generation with default 720p resolution
5. Deploy/demo if ready - users can animate photos!

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (Resolution control)
4. Add User Story 3 → Test independently → Deploy/Demo (Error handling)
5. Each story adds value without breaking previous stories

### Single Developer Strategy

Execute phases sequentially:
1. Phase 1: Setup (quick)
2. Phase 2: Foundational (core backend work)
3. Phase 3: User Story 1 (MVP delivery point)
4. Phase 4: User Story 2 (enhancement)
5. Phase 5: User Story 3 (robustness)
6. Phase 6: Polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No database migrations required - existing AnimationAttempt model is sufficient
- Existing `POST /api/v1/jobs/{job_id}/animate` endpoint is reused with enhanced logic
- Webhook endpoint is new: `/api/v1/webhooks/replicate/animation/{animation_id}`
- 30-day video retention handled by Celery beat scheduled task
