# Requirements Document

## Introduction

The Photo Upload System is the foundational feature that enables users to easily submit their precious family photos for AI restoration and colourization. This system must accommodate our target demographic (30-60 year old families) by providing intuitive, accessible upload methods across multiple platforms and scenarios. The system serves as the entry point for all user interactions and must handle various photo sources including physical photos, mobile device galleries, and desktop files.

The upload system directly supports our core mission of "bringing memories to life" by removing friction from the photo submission process, especially for older family photos that may exist in various formats and locations.

## Requirements

### Requirement 1

**User Story:** As a mobile user with physical family photos, I want to capture them using my phone's camera so that I can easily digitize and restore old printed memories.

#### Acceptance Criteria

1. WHEN a user accesses the upload interface on mobile THEN the system SHALL provide a prominent "Take Photo" option
2. WHEN a user selects "Take Photo" THEN the system SHALL open a full-screen camera interface with back-facing camera as default
3. WHEN the camera is active THEN the system SHALL fill the entire screen without padding or letterboxing in any orientation
4. WHEN the camera is active THEN the system SHALL display real-time lighting and focus quality indicators
5. WHEN the camera is active THEN the system SHALL position UI controls appropriately for both portrait and landscape orientations
6. WHEN a photo is captured THEN the system SHALL display a full-screen preview with accept/reject options
7. WHEN the user accepts the photo THEN the system SHALL provide a full-screen smart cropping interface using react-easy-crop
8. WHEN the user adjusts the crop area THEN the system SHALL provide real-time preview with zoom and pan capabilities
9. IF the photo quality is poor due to lighting or focus THEN the system SHALL provide visual feedback before capture

### Requirement 2

**User Story:** As a mobile user with photos in my device gallery, I want to select and upload existing photos so that I can restore digital copies of family memories.

#### Acceptance Criteria

1. WHEN a user accesses the upload interface on mobile THEN the system SHALL provide a "Choose from Gallery" option
2. WHEN a user selects "Choose from Gallery" THEN the system SHALL open the native photo picker
3. WHEN a user selects a photo from gallery THEN the system SHALL display a full-screen preview with accept/reject options
4. WHEN the user accepts the photo THEN the system SHALL provide the same full-screen smart cropping interface as camera capture
5. WHEN the cropping interface is active THEN the system SHALL maintain full-screen layout with controls positioned consistently
6. WHEN the system detects HEIC format THEN the system SHALL automatically convert to JPEG for processing
7. IF the selected photo exceeds size limits THEN the system SHALL provide clear error messaging and suggest solutions

### Requirement 3

**User Story:** As a desktop user with photos on my computer, I want to drag and drop or browse for files so that I can easily upload photos from my local storage.

#### Acceptance Criteria

1. WHEN a user accesses the upload interface on desktop THEN the system SHALL provide a large drag-and-drop zone
2. WHEN a user drags a file over the drop zone THEN the system SHALL provide visual feedback indicating the drop area is active
3. WHEN a user drops a valid image file THEN the system SHALL accept the file and proceed to preprocessing
4. WHEN a user clicks the drop zone THEN the system SHALL open a file browser dialog
5. WHEN multiple files are dropped THEN the system SHALL process only the first valid image file for MVP
6. IF an invalid file type is dropped THEN the system SHALL display clear error messaging about supported formats

### Requirement 4

**User Story:** As a desktop user who wants to use mobile camera quality, I want to scan a QR code to seamlessly transfer the upload process to my mobile device so that I can capture physical photos with better camera quality.

#### Acceptance Criteria

1. WHEN a user accesses the upload interface on desktop THEN the system SHALL provide a "Use Mobile Camera" option
2. WHEN a user selects "Use Mobile Camera" THEN the system SHALL generate and display a QR code
3. WHEN the QR code is scanned with a mobile device THEN the mobile device SHALL open the camera interface
4. WHEN a photo is captured and processed on mobile THEN the desktop SHALL automatically display the upload progress
5. WHEN processing is complete THEN both desktop and mobile SHALL show the successful upload confirmation
6. IF the QR code expires THEN the system SHALL generate a new code automatically

### Requirement 5

**User Story:** As any user uploading a photo, I want to see clear progress feedback and status updates so that I understand what's happening with my upload and feel confident the process is working.

#### Acceptance Criteria

1. WHEN a file upload begins THEN the system SHALL display a progress bar with percentage completion
2. WHEN upload is in progress THEN the system SHALL show estimated time remaining
3. WHEN upload completes successfully THEN the system SHALL display a clear success message
4. WHEN preprocessing begins THEN the system SHALL indicate "Preparing your photo for processing"
5. WHEN the photo is queued for AI processing THEN the system SHALL confirm "Photo ready for restoration"
6. IF an error occurs during upload THEN the system SHALL provide specific error messages and retry options

### Requirement 6

**User Story:** As a user with various photo formats and sizes, I want the system to handle my files appropriately so that I can upload photos regardless of their original format or size.

#### Acceptance Criteria

1. WHEN a user uploads a file THEN the system SHALL validate it supports JPG, PNG, HEIC, and WebP formats
2. WHEN a file exceeds 50MB THEN the system SHALL reject it with clear messaging about size limits
3. WHEN a file is smaller than 200x200 pixels THEN the system SHALL warn about potential quality issues
4. WHEN a HEIC file is uploaded THEN the system SHALL automatically convert it to JPEG
5. WHEN preprocessing is complete THEN the system SHALL generate a thumbnail for preview
6. IF a file is corrupted or unreadable THEN the system SHALL provide clear error messaging and suggest re-uploading

### Requirement 7

**User Story:** As a user concerned about my photo privacy, I want assurance that my photos are handled securely so that I feel confident sharing my personal family memories.

#### Acceptance Criteria

1. WHEN a photo is uploaded THEN the system SHALL use HTTPS/TLS encryption for all transfers
2. WHEN a photo is stored THEN the system SHALL use secure S3 storage with appropriate access controls
3. WHEN a photo is accessed THEN the system SHALL use signed URLs that expire after a reasonable time
4. WHEN preprocessing is complete THEN the system SHALL delete the original upload file to minimize storage
5. WHEN a user is not authenticated THEN the system SHALL require login before allowing uploads
6. IF a user deletes their account THEN the system SHALL remove all associated photo files

### Requirement 8

**User Story:** As a user adjusting photo crops, I want a full-screen cropping interface with intuitive controls so that I can precisely select the area of my photo to restore.

#### Acceptance Criteria

1. WHEN the cropping interface opens THEN the system SHALL display the photo in full-screen mode without padding
2. WHEN the cropping interface is active THEN the system SHALL use react-easy-crop for touch-optimized cropping
3. WHEN a user interacts with the crop area THEN the system SHALL provide smooth zoom and pan capabilities
4. WHEN a user adjusts the crop THEN the system SHALL show real-time preview of the selected area
5. WHEN the cropping interface is displayed THEN the system SHALL position accept/reject buttons consistently with camera controls
6. WHEN in mobile landscape mode THEN the system SHALL position controls on the right side within screen bounds
7. WHEN in mobile portrait mode THEN the system SHALL position controls at the bottom of the screen
8. WHEN the user completes cropping THEN the system SHALL apply the crop and proceed to upload processing

### Requirement 9

**User Story:** As a user with limited technical skills, I want the upload interface to be simple and intuitive so that I can successfully upload photos without confusion or frustration.

#### Acceptance Criteria

1. WHEN a user first visits the upload page THEN the system SHALL provide clear visual guidance on available upload methods
2. WHEN a user hovers over upload options THEN the system SHALL show helpful tooltips explaining each method
3. WHEN an error occurs THEN the system SHALL use plain language explanations rather than technical jargon
4. WHEN the upload is successful THEN the system SHALL provide clear next steps for the user
5. WHEN a user needs help THEN the system SHALL provide easily accessible support options
6. IF a user appears stuck THEN the system SHALL offer contextual help suggestions