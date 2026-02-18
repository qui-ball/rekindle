# Feature Specification: SiliconFlow Photo Restoration

**Feature Branch**: `001-siliconflow-restoration`
**Created**: 2025-12-06
**Status**: Draft
**Input**: User description: "Replace RunPod/ComfyUI with SiliconFlow API for photo restoration using Qwen Image Edit"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Photo Restoration via SiliconFlow (Priority: P1)

A user uploads an old, damaged, or low-quality photo and requests restoration. The system processes the photo through SiliconFlow's Qwen-Image-Edit API instead of the current RunPod/ComfyUI pipeline, returning a restored image with improved quality, clarity, and detail preservation.

**Why this priority**: This is the core functionality being migrated. Without this working, the feature provides no value. The current RunPod/ComfyUI approach has long cold-start times and complex infrastructure; SiliconFlow API provides a simpler, faster alternative.

**Independent Test**: Can be fully tested by uploading a damaged photo, triggering restoration, and verifying the restored image is returned within acceptable time limits with visible quality improvement.

**Acceptance Scenarios**:

1. **Given** a user has uploaded a photo, **When** they request restoration, **Then** the system submits the photo to SiliconFlow API and returns a restored version
2. **Given** a restoration is in progress, **When** the SiliconFlow API completes processing, **Then** the restored image is saved to storage and the photo status is updated to "ready"
3. **Given** a user has a restored photo, **When** they view their photo details, **Then** they can see and download both the original and restored versions

---

### User Story 2 - Restoration Parameter Customization (Priority: P2)

A user can optionally customize restoration parameters such as the restoration prompt to guide how the image should be enhanced.

**Why this priority**: Provides flexibility for users who want control over the restoration process, but the default settings should work well for most cases.

**Independent Test**: Can be tested by submitting restoration requests with different prompt values and verifying the output reflects those customizations.

**Acceptance Scenarios**:

1. **Given** a user requests restoration with custom parameters, **When** the restoration completes, **Then** the result reflects the specified customization
2. **Given** a user requests restoration without custom parameters, **When** the restoration completes, **Then** sensible defaults are applied (standard photo restoration prompt)

---

### User Story 3 - Error Handling and Recovery (Priority: P2)

When the SiliconFlow API is unavailable or returns an error, the system handles the failure gracefully and informs the user.

**Why this priority**: Essential for production reliability, but secondary to core functionality working correctly.

**Independent Test**: Can be tested by simulating API failures and verifying appropriate error responses and user notifications.

**Acceptance Scenarios**:

1. **Given** a restoration request is made, **When** the SiliconFlow API returns an error, **Then** the system marks the restoration as failed and provides a meaningful error message
2. **Given** a restoration request is made, **When** the SiliconFlow API is unreachable, **Then** the system marks the restoration as failed immediately and the user can manually retry
3. **Given** a restoration has failed, **When** the user views their photo, **Then** they see the failure status and can retry the restoration

---

### Edge Cases

- Unsupported image formats (HEIC, WebP, TIFF, etc.): System auto-converts to JPEG before submission
- Large images exceeding API size limits: System auto-resizes to maximum allowed dimensions before submission
- SiliconFlow response URL expiration: System downloads immediately after API response; URLs valid for 1 hour (low risk)
- Concurrent restoration requests for same photo: System rejects with error if restoration already in progress

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST submit photo restoration requests to SiliconFlow's Qwen-Image-Edit API endpoint
- **FR-002**: System MUST authenticate with SiliconFlow using the configured API key (SILICONFLOW_API_KEY)
- **FR-003**: System MUST send the source image to SiliconFlow API via presigned S3 URL
- **FR-004**: System MUST include a restoration-focused prompt with each request (default: photo restoration instructions)
- **FR-005**: System MUST download the restored image from SiliconFlow's response URL
- **FR-006**: System MUST upload the restored image to the existing S3 storage
- **FR-007**: System MUST update the Photo record with the restored image key and status
- **FR-008**: System MUST support optional custom restoration prompts provided by the user
- **FR-009**: System MUST handle API errors gracefully by failing immediately and allowing user to manually retry
- **FR-010**: System MUST maintain compatibility with the existing RestoreAttempt tracking model
- **FR-011**: System MUST work with the existing credit system (restoration costs 2 credits)
- **FR-012**: System MUST auto-resize images exceeding API size limits to maximum allowed dimensions before submission
- **FR-013**: System MUST auto-convert unsupported image formats (HEIC, WebP, TIFF, etc.) to JPEG before submission
- **FR-014**: System MUST reject restoration requests for photos that already have a restoration in progress

### Key Entities

- **SiliconFlowService**: New service to handle API communication with SiliconFlow (replaces RunPodServerlessService for restoration)
- **Photo**: Existing entity - no changes needed, continues to track original_key and processed_key
- **RestoreAttempt**: Existing entity - continues to track restoration history, params will store SiliconFlow-specific metadata instead of RunPod metadata

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Photo restoration requests complete within 60 seconds on average (significant improvement over RunPod cold-start times)
- **SC-002**: Restored photos maintain or improve visual quality compared to the current ComfyUI-based restoration
- **SC-003**: System achieves 95% or higher restoration success rate under normal operating conditions
- **SC-004**: Users can restore photos without experiencing the previous cold-start delays of serverless infrastructure
- **SC-005**: The existing photo upload, viewing, and download workflows continue to function unchanged

## Clarifications

### Session 2025-12-06

- Q: Image transfer method to SiliconFlow API? → A: URL only (presigned S3 URL)
- Q: How to handle images exceeding API size limits? → A: Auto-resize before submission
- Q: API retry strategy on failure? → A: No retries (fail immediately, user manually retries)
- Q: Unsupported image format handling? → A: Auto-convert to JPEG before submission
- Q: Concurrent restoration requests for same photo? → A: Reject with error if already in progress

## Assumptions

- SiliconFlow API endpoint is `https://api.siliconflow.com/v1/images/generations`
- Model identifier for Qwen-Image-Edit is `Qwen/Qwen-Image-Edit`
- SiliconFlow API uses Bearer token authentication
- The API accepts images via presigned S3 URL
- Response includes a URL to download the processed image
- The SILICONFLOW_API_KEY environment variable is already configured
- Existing S3 storage and Photo/RestoreAttempt models remain unchanged
- Credit deduction logic remains unchanged (2 credits per restoration)

## Out of Scope

- Animation functionality (will remain on RunPod/ComfyUI or be addressed in a separate feature)
- Changes to the frontend photo upload or viewing experience
- Changes to the credit system or pricing
- Migration of existing RunPod infrastructure (can be deprecated separately)
- Batch restoration functionality
