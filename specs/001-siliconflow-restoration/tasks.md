# Tasks: SiliconFlow Photo Restoration

**Input**: Design documents from `/specs/001-siliconflow-restoration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests included for new services (following existing project patterns).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/app/` for source, `backend/tests/` for tests
- Based on existing project structure from plan.md

---

## Phase 1: Setup (Configuration)

**Purpose**: Add SiliconFlow configuration to existing project

- [x] T001 Add SILICONFLOW_API_KEY, SILICONFLOW_API_URL, SILICONFLOW_MODEL, SILICONFLOW_TIMEOUT settings to backend/app/core/config.py
- [x] T002 Add SILICONFLOW_API_KEY to backend/.env.example with placeholder value

---

## Phase 2: Foundational (Image Preprocessing Service)

**Purpose**: Create image preprocessing utilities needed by all restoration workflows

**⚠️ CRITICAL**: Image preprocessing must be complete before restoration implementation

- [x] T003 Create ImagePreprocessResult dataclass in backend/app/services/image_processor.py
- [x] T004 Implement preprocess_image() function for resize and format conversion in backend/app/services/image_processor.py
- [x] T005 Implement get_image_dimensions() helper function in backend/app/services/image_processor.py
- [x] T006 Implement needs_preprocessing() check function in backend/app/services/image_processor.py
- [x] T007 [P] Create unit tests for image_processor in backend/tests/services/test_image_processor.py

**Checkpoint**: Image preprocessing ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Photo Restoration via SiliconFlow (Priority: P1) 🎯 MVP

**Goal**: Users can restore photos using SiliconFlow API instead of RunPod/ComfyUI

**Independent Test**: Upload a damaged photo, trigger restoration, verify restored image is returned within 60 seconds with quality improvement

### Tests for User Story 1

- [x] T008 [P] [US1] Create test fixtures and mocks for SiliconFlow API responses in backend/tests/services/test_siliconflow.py
- [x] T009 [P] [US1] Write unit test for SiliconFlowService.restore_image() success case in backend/tests/services/test_siliconflow.py
- [x] T010 [P] [US1] Write unit test for SiliconFlowService._download_result() in backend/tests/services/test_siliconflow.py

### Implementation for User Story 1

- [x] T011 [US1] Create SiliconFlowRequest and SiliconFlowResponse dataclasses in backend/app/services/siliconflow.py
- [x] T012 [US1] Implement SiliconFlowService.__init__() with API key validation in backend/app/services/siliconflow.py
- [x] T013 [US1] Implement SiliconFlowService._download_result() to download from CDN URL in backend/app/services/siliconflow.py
- [x] T014 [US1] Implement SiliconFlowService.restore_image() main method in backend/app/services/siliconflow.py
- [x] T015 [US1] Add get_siliconflow_service() singleton pattern in backend/app/services/siliconflow.py
- [x] T016 [US1] Modify process_restoration() Celery task to use SiliconFlowService for restoration in backend/app/workers/tasks/jobs.py
- [x] T017 [US1] Add image preprocessing step (resize/convert) before API submission in backend/app/workers/tasks/jobs.py
- [x] T018 [US1] Update RestoreAttempt params to store SiliconFlow metadata (provider, inference_time, seed) in backend/app/workers/tasks/jobs.py

**Checkpoint**: At this point, basic photo restoration via SiliconFlow should be fully functional

---

## Phase 4: User Story 2 - Restoration Parameter Customization (Priority: P2)

**Goal**: Users can customize restoration parameters (prompt, inference steps, guidance scale)

**Independent Test**: Submit restoration with custom prompt, verify output reflects customization

### Tests for User Story 2

- [x] T019 [P] [US2] Write unit test for custom prompt handling in backend/tests/services/test_siliconflow.py
- [x] T020 [P] [US2] Write unit test for inference_steps and guidance_scale parameters in backend/tests/services/test_siliconflow.py

### Implementation for User Story 2

- [x] T021 [US2] Add optional num_inference_steps and guidance_scale parameters to SiliconFlowService.restore_image() in backend/app/services/siliconflow.py
- [x] T022 [US2] Update process_restoration() to pass custom params from RestoreAttemptCreate to SiliconFlowService in backend/app/workers/tasks/jobs.py
- [x] T023 [US2] Define DEFAULT_RESTORATION_PROMPT constant in backend/app/services/siliconflow.py
- [x] T024 [US2] Store custom params in RestoreAttempt.params JSON in backend/app/workers/tasks/jobs.py

**Checkpoint**: Users can now customize restoration parameters

---

## Phase 5: User Story 3 - Error Handling and Recovery (Priority: P2)

**Goal**: System handles API failures gracefully with clear error messages

**Independent Test**: Simulate API failures, verify appropriate error responses and photo status reversion

### Tests for User Story 3

- [x] T025 [P] [US3] Write unit test for API authentication error (401) handling in backend/tests/services/test_siliconflow.py
- [x] T026 [P] [US3] Write unit test for rate limit error (429) handling in backend/tests/services/test_siliconflow.py
- [x] T027 [P] [US3] Write unit test for invalid image error (400) handling in backend/tests/services/test_siliconflow.py
- [x] T028 [P] [US3] Write unit test for timeout error handling in backend/tests/services/test_siliconflow.py
- [x] T029 [P] [US3] Write unit test for network error handling in backend/tests/services/test_siliconflow.py

### Implementation for User Story 3

- [x] T030 [US3] Create SiliconFlowError exception class with error_type enum in backend/app/services/siliconflow.py
- [x] T031 [US3] Implement error response parsing in SiliconFlowService.restore_image() in backend/app/services/siliconflow.py
- [x] T032 [US3] Add try/except handling in process_restoration() for SiliconFlowError in backend/app/workers/tasks/jobs.py
- [x] T033 [US3] Implement Photo.status reversion to 'uploaded' on failure in backend/app/workers/tasks/jobs.py
- [x] T034 [US3] Store error details in RestoreAttempt.params.error on failure in backend/app/workers/tasks/jobs.py
- [x] T035 [US3] Add concurrency check (reject if photo.status == 'processing') in backend/app/workers/tasks/jobs.py

**Checkpoint**: System now handles all error cases gracefully

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation

- [x] T036 [P] Add integration test with real SiliconFlow API (marked @pytest.mark.integration) in backend/tests/services/test_siliconflow.py
- [x] T037 [P] Add logging statements for restoration workflow in backend/app/services/siliconflow.py
- [x] T038 Run all tests and verify pass: `uv run pytest backend/tests/services/test_siliconflow.py backend/tests/services/test_image_processor.py -v`
- [ ] T039 Test end-to-end restoration via API endpoint manually (requires running backend/Celery/Redis)
- [x] T040 Validate quickstart.md steps work correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - US1 (P1): Core restoration - must complete first
  - US2 (P2): Parameter customization - can start after US1
  - US3 (P2): Error handling - can start after US1, in parallel with US2
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 completion (extends SiliconFlowService.restore_image)
- **User Story 3 (P2)**: Depends on US1 completion (adds error handling to existing flow)

### Within Each User Story

- Tests can run in parallel [P] within each story
- Service implementation before Celery task integration
- Core implementation before error handling
- Story complete before moving to next priority

### Parallel Opportunities

Within Phase 2 (Foundational):
- T007 test file can be written in parallel with T003-T006 implementation

Within Phase 3 (US1):
- T008, T009, T010 test tasks can run in parallel
- After tests: T011-T015 are sequential (service building)
- T016-T018 are sequential (Celery task integration)

Within Phase 4 (US2):
- T019, T020 test tasks can run in parallel
- T021-T024 are sequential

Within Phase 5 (US3):
- T025-T029 test tasks can run in parallel
- T030-T035 are mostly sequential

Within Phase 6 (Polish):
- T036, T037 can run in parallel

---

## Parallel Example: User Story 3 Tests

```bash
# Launch all error handling tests together:
Task: "Write unit test for API authentication error (401) handling"
Task: "Write unit test for rate limit error (429) handling"
Task: "Write unit test for invalid image error (400) handling"
Task: "Write unit test for timeout error handling"
Task: "Write unit test for network error handling"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T007)
3. Complete Phase 3: User Story 1 (T008-T018)
4. **STOP and VALIDATE**: Test restoration end-to-end
5. Deploy if ready - basic SiliconFlow restoration works

### Incremental Delivery

1. Setup + Foundational → Image preprocessing ready
2. Add User Story 1 → Basic restoration works (MVP!)
3. Add User Story 2 → Custom parameters supported
4. Add User Story 3 → Error handling complete
5. Polish → Production ready

### Task Count Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1: Setup | 2 | Configuration |
| Phase 2: Foundational | 5 | Image preprocessing |
| Phase 3: US1 (P1) | 11 | Core restoration |
| Phase 4: US2 (P2) | 6 | Parameter customization |
| Phase 5: US3 (P2) | 11 | Error handling |
| Phase 6: Polish | 5 | Final validation |
| **Total** | **40** | |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests pass after each phase
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing code patterns followed (similar to RunPodServerlessService)
