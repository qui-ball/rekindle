# Feature Specification: Replicate Animation (Image-to-Video)

**Feature Branch**: `002-replicate-animation`
**Created**: 2026-01-14
**Status**: Draft
**Input**: User description: "Implement animation using Replicate wan-2.5-i2v model. Input is the restored image, resolution controllable in UI, no audio, no negative prompt, prompt expansion FALSE."

## Clarifications

### Session 2026-01-14

- Q: What happens if user navigates away during animation generation? → A: Continue - generation continues in background, user can return to view results later
- Q: How long should generated animation videos be retained? → A: 30 days standard retention period
- Q: What should happen if animation generation times out? → A: Timeout at 10 minutes, auto-retry once, then fail with error if still unsuccessful

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate Animation from Restored Photo (Priority: P1)

A user who has already restored an old photo wants to bring it to life by creating an animated video. After restoration completes, they can initiate animation generation using the restored image as input. They provide a text prompt describing the desired animation, select their preferred video resolution, and submit the request. The system generates an animated video and makes it available for viewing and download.

**Why this priority**: This is the core feature - transforming static restored photos into animated videos. Without this, the feature has no value.

**Independent Test**: Can be fully tested by uploading an image, completing restoration, then initiating animation with a prompt. Delivers animated video output that can be viewed and downloaded.

**Acceptance Scenarios**:

1. **Given** a user has a restored image ready, **When** they select "Animate" and provide a prompt with resolution selection, **Then** the system begins video generation and shows progress status
2. **Given** animation generation is in progress, **When** generation completes successfully, **Then** the user sees the animated video and can play it directly
3. **Given** animation generation has completed, **When** the user clicks download, **Then** the video file is downloaded to their device

---

### User Story 2 - Configure Animation Settings (Priority: P2)

A user wants control over the output video characteristics. They can select the video resolution (480p, 720p, or 1080p) before initiating animation. The selected resolution affects the output video quality and generation time.

**Why this priority**: Resolution control is explicitly required by the user and affects both output quality and processing cost/time.

**Independent Test**: Can be tested by selecting different resolution options and verifying the output video matches the selected resolution.

**Acceptance Scenarios**:

1. **Given** a user is configuring animation settings, **When** they view resolution options, **Then** they see available resolution choices (480p, 720p, 1080p)
2. **Given** a user selects 720p resolution, **When** animation completes, **Then** the output video is in 720p resolution
3. **Given** a user selects 1080p resolution, **When** animation completes, **Then** the output video is in 1080p resolution

---

### User Story 3 - Handle Animation Generation Errors (Priority: P3)

A user experiences an error during animation generation. The system gracefully handles failures, provides clear error messaging, and allows the user to retry without losing their prompt or settings.

**Why this priority**: Error handling ensures a robust user experience but is secondary to core functionality.

**Independent Test**: Can be tested by simulating generation failures and verifying error messages appear with retry capability.

**Acceptance Scenarios**:

1. **Given** animation generation fails due to service unavailability, **When** the error occurs, **Then** the user sees a clear error message explaining the issue
2. **Given** an error has occurred, **When** the user clicks retry, **Then** the system attempts generation again with previously entered prompt and settings preserved

---

### Edge Cases

- What happens when the restored image URL expires before animation starts?
- How does system handle very long prompts exceeding model limits?
- What happens if the user navigates away during generation? → Generation continues in background; results available when user returns
- How does the system behave when the animation service times out? → Timeout at 10 minutes, auto-retry once, then fail with error to user
- What happens when the user has insufficient credits or quota?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a restored image as input for animation generation
- **FR-002**: System MUST allow users to enter a text prompt describing the desired animation
- **FR-003**: System MUST provide resolution selection with options: 480p, 720p, 1080p
- **FR-004**: System MUST set prompt expansion to FALSE for all animation requests (as specified)
- **FR-005**: System MUST NOT include audio in generated videos
- **FR-006**: System MUST NOT use negative prompts (empty string)
- **FR-007**: System MUST display generation progress status to users during processing
- **FR-008**: System MUST allow users to view completed animation videos inline
- **FR-009**: System MUST allow users to download completed animation videos
- **FR-010**: System MUST store generated video references associated with the original restored image
- **FR-011**: System MUST handle generation failures gracefully with user-friendly error messages
- **FR-012**: System MUST allow retry of failed animation generation attempts
- **FR-013**: System MUST use a default video duration of 5 seconds for all animations
- **FR-014**: System MUST continue animation generation in the background if user navigates away
- **FR-015**: System MUST allow users to return and view completed animations after navigating away
- **FR-016**: System MUST retain generated videos for 30 days from creation date
- **FR-017**: System MUST automatically delete videos after the 30-day retention period expires
- **FR-018**: System MUST timeout animation generation requests after 10 minutes of no response
- **FR-019**: System MUST automatically retry once after a timeout before failing
- **FR-020**: System MUST display a clear error message if generation fails after timeout and retry

### Key Entities

- **Animation Job**: Represents an animation generation request - includes reference to source restored image, user prompt, selected resolution, generation status, and resulting video reference
- **Restored Image**: The source image (from prior restoration) used as input for animation - already exists in system
- **Generated Video**: The output animated video - includes video file reference, resolution, duration, creation timestamp, and expiration date (30 days from creation)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can initiate animation generation within 3 clicks from a restored image
- **SC-002**: Users receive clear progress feedback during the entire generation process
- **SC-003**: 95% of animation generation requests complete successfully under normal conditions
- **SC-004**: Generated videos are playable directly in the user interface without requiring download
- **SC-005**: Users can download generated videos in standard video format playable on common devices
- **SC-006**: Animation generation workflow maintains user context (prompt, settings) through errors and retries

## Assumptions

- The existing restoration workflow already stores restored images with accessible URLs
- Users have already completed the restoration step before attempting animation
- The Replicate service is available and the API key is configured
- Video duration is fixed at 5 seconds (based on example script defaults)
- Default resolution is 720p if user doesn't explicitly select one
