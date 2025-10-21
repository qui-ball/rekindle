# Implementation Plan

## Overview
This implementation plan covers the complete photo management system including gallery display, detail drawer, processing options, credit management, and mobile optimization. Tasks are organized by priority and dependencies to ensure efficient development.

## Phase 1: Core Infrastructure (High Priority)

- [ ] 1. Set up photo management data models and services
  - [ ] 1.1 Create Photo and PhotoResult database models **[BACKEND]**
    - Define Photo entity with metadata, status, and relationships
    - Create PhotoResult entity for processed outputs (restored, colourized, animated)
    - Add database migrations for photo management tables
    - Implement proper indexing for user queries and performance
    - _Requirements: Data models, Database schema_

  - [ ] 1.2 Implement PhotoManagementService **[BACKEND]**
    - Create service interface for photo CRUD operations
    - Implement getPhotos with pagination and filtering
    - Add getPhotoDetails with associated results
    - Create deletePhoto and deletePhotoResult methods
    - Add downloadPhoto functionality with signed URLs
    - _Requirements: Service layer, API endpoints_

  - [ ] 1.3 Build CreditManagementService **[BACKEND]**
    - Implement getCreditBalance with unified credit tracking
    - Create calculateProcessingCost with discount logic
    - Add checkCreditAvailability and deductCredits methods
    - Implement getCreditUsageBreakdown for UI display
    - Add credit transaction history tracking
    - Add subscription cancellation logic (credits lost on cancellation)
    - _Requirements: Credit system, Unified credit logic_

- [x] 2. Create core React components foundation
  - [x] 2.1 Build PhotoManagementContainer **[FRONTEND]**
    - Create main orchestration component with state management
    - Implement photo loading with pagination and infinite scroll
    - Add error handling and loading states
    - Integrate with PhotoManagementService (API calls)
    - _Requirements: Main container, State management_

  - [x] 2.2 Implement PhotoGallery component **[FRONTEND]**
    - Create responsive grid layout (2-4 columns based on screen size)
    - Add touch-optimized photo thumbnails with status overlays
    - Implement infinite scroll with pull-to-refresh on mobile
    - Add smooth loading animations and skeleton states
    - _Requirements: Gallery display, Mobile optimization_

  - [x] 2.3 Create PhotoStatusIndicator component **[FRONTEND]**
    - Implement animated overlays for different states
    - Add progress indicators for active processing
    - Create retry functionality for failed jobs
    - Add tooltip information on hover
    - _Requirements: Status indicators, User feedback_

## Phase 2: Detail Drawer Implementation (High Priority)

- [x] 3. Build PhotoDetailDrawer component
  - [x] 3.1 Create drawer component with platform-specific behavior **[FRONTEND]**
    - Implement full-screen overlay for mobile (covers entire screen)
    - Create side panel for desktop (60% width, gallery remains visible)
    - Add smooth slide-in animations from right
    - Implement proper backdrop handling (mobile: dark backdrop, desktop: none)
    - _Requirements: Drawer behavior, Platform optimization_

  - [x] 3.2 Implement drawer navigation and controls **[FRONTEND]**
    - Add "Back to Gallery" button for mobile (since gallery is hidden)
    - Create "Close" button for desktop (gallery remains visible)
    - Implement swipe-to-close gesture on mobile
    - Add click-outside-to-close functionality on desktop
    - _Requirements: Navigation, User interaction_

  - [x] 3.3 Build results display and file management **[FRONTEND]**
    - Display original photo (already implemented - fetches presigned URL)
    - Display all processed result images (restored, animated, colorized) below original
    - Fetch presigned URLs for each processed result from backend (via S3 keys)
    - Show actual result images with proper loading states and error handling
    - Add individual download/delete buttons for each result
    - Implement file action handlers (download, delete) - API calls
    - Add status indicators for each result type (processing, completed, failed)
    - Support different result types with appropriate display (images, videos for animated)
    - _Requirements: File management, Results display, S3 presigned URLs_

- [x] 4. Integrate drawer with photo gallery
  - [x] 4.1 Connect drawer to gallery selection **[FRONTEND]**
    - Implement photo selection from gallery
    - Add smooth transition from gallery to drawer
    - Handle photo data passing between components
    - _Requirements: Component integration, Data flow_

  - [x] 4.2 Add drawer state management **[FRONTEND]**
    - Implement open/close state handling
    - Add selected photo state management
    - Create drawer animation state tracking
    - _Requirements: State management, Animation control_

## Phase 3: Processing Options and Credit Management (High Priority)

- [ ] 5. Build ProcessingOptionsPanel component
  - [x] 5.1 Complete dynamic processing options interface **[FRONTEND]**
    - ✅ REMOVED top-level Colourize checkbox (now only a parameter within Restore)
    - ✅ Implement checkbox options for Restore, Animate, Bring Together (DONE)
    - ✅ Create real-time credit cost calculation (UI logic) (DONE)
    - ✅ Removed combined processing discount (no longer needed without separate Colourize option)
    - ✅ Fixed dynamic enabling/disabling based on available credits (credit-based logic implemented)
    - _Requirements: Processing options, Credit calculation_
    - _Status: COMPLETED - Colourize is now a parameter within Restore only_

  - [x] 5.2 Build ProcessingParameterDrawer component **[FRONTEND]**
    - ✅ Created new component: ProcessingParameterDrawer.tsx
    - ✅ Implemented collapsible drawer that slides down below each processing option checkbox
    - ✅ Added smooth slide-down/slide-up animations using CSS transitions
    - ✅ Implemented "push content down" behavior when drawer opens
    - ✅ Created separate drawer instance for each processing type (restore, animate, bringTogether)
    - ✅ Handles multiple drawers being open simultaneously (independent state)
    - ✅ Added proper TypeScript props interface
    - _Requirements: Parameter drawers, Animation behavior_
    - _Status: COMPLETED - Component created with full animation support_

  - [x] 5.3 Implement common parameters for each processing type **[FRONTEND]**
    - ✅ **Restore:** Added "Colourize" checkbox parameter in drawer (Colourize is NOT a separate processing option, only available as part of Restore)
    - ✅ **Animate:** Added "Video Duration" slider parameter (3-10 seconds range)
    - ✅ Implemented parameter state management (useState for each parameter)
    - ✅ Created onChange handlers for parameter inputs
    - ✅ Connected parameter changes to credit cost calculation (Restore base cost + additional cost if Colourize is checked)
    - ✅ Integrated drawers into ProcessingOptionsPanel component
    - _Requirements: Processing parameters, User input_
    - _Status: COMPLETED - All common parameters implemented with state management_

  - [x] 5.4 Build advanced options expandable section **[FRONTEND]**
    - ✅ Added "Advanced Options" toggle button/link within each parameter drawer
    - ✅ Implemented expand/collapse animation for advanced section (nested within drawer)
    - ✅ **Restore Advanced:** Added denoise level slider (0-100 range), user prompt text input (textarea)
    - ✅ **Animate Advanced:** Added user prompt text input (textarea)
    - ✅ Handled advanced section state independently for each drawer (separate useState)
    - ✅ Ensured smooth height transitions when expanding/collapsing advanced sections
    - _Requirements: Advanced parameters, Expandable UI_
    - _Status: COMPLETED - All advanced options implemented with smooth animations_

  - [ ] 5.5 Implement parameter data models and backend support **[BACKEND + FRONTEND]**
    - ✅ **Frontend Types:** Defined ProcessingParameters interface in photo-management.ts with typed sub-models:
      - ✅ RestoreParameters: { colourize: boolean; denoiseLevel?: number; userPrompt?: string } (Colourize is a parameter within Restore, not separate)
      - ✅ AnimateParameters: { videoDuration: number; userPrompt?: string }
      - ✅ BringTogetherParameters: {} (placeholder for future)
    - ✅ Updated ProcessingOptions interface to:
      - ✅ Removed colourize: boolean (no longer top-level option)
      - ✅ Replaced customParameters with parameters: ProcessingParameters
    - ❌ **Backend:** Update ProcessingJob model to include parameters field (JSON/JSONB) - NOT DONE
    - ❌ **Backend:** Add parameter validation logic in job creation - NOT DONE
    - ❌ **Backend:** Update job creation API endpoint to accept and store parameters - NOT DONE
    - _Requirements: Data models, Backend integration_
    - _Status: PARTIALLY COMPLETED - Frontend types done, backend updates pending_

  - [x] 5.6 Implement credit usage breakdown display **[FRONTEND]**
    - ✅ Show individual credit costs for each action (DONE - basic implementation exists)
    - ✅ Display total credits required (DONE - works for basic options)
    - ✅ Show remaining credits after processing (DONE)
    - ✅ Show warnings for insufficient credits (DONE)
    - ✅ Update costs in real-time as parameters change (DONE - parameters are now live)
    - _Requirements: Credit display, User guidance_
    - _Status: COMPLETED - Full breakdown with real-time parameter-based cost updates_

  - [ ] 5.7 Add processing confirmation and job creation **[FRONTEND]**
    - ✅ Basic processing confirmation with cost breakdown (DONE - works for restore only)
    - ❌ Include parameters summary in confirmation (NOT DONE - no parameters yet)
    - ✅ Job queue integration via API calls (DONE - createProcessingJob works)
    - ✅ Processing status updates (DONE - photo status updates to 'processing')
    - ✅ Handle processing errors (DONE - error handling in place)
    - ❌ Retry functionality (PARTIALLY DONE - error handling exists but no explicit retry button)
    - _Requirements: Job processing, Status updates_
    - _Status: Partially complete - basic processing works for restore, needs parameters integration_

- [ ] 6. Build CreditBalanceDisplay component
  - [ ] 6.1 Create unified credit display **[FRONTEND]**
    - Display total credits available
    - Show clear indication that all credits carry over
    - Add visual indicators showing next billing date and credits to be received
    - Implement low credit warnings
    - Add cancellation warning (credits lost on subscription cancellation)
    - _Requirements: Credit display, User awareness_

  - [ ] 6.2 Add credit purchase integration **[FRONTEND]**
    - Create links to subscription and top-up pages
    - Add quick access to credit management
    - Implement real-time balance updates (API calls)
    - Add subscription cancellation confirmation with credit loss warning
    - _Requirements: Credit management, User flow_

## Phase 4: Mobile Optimization and Responsive Design (Medium Priority)

- [ ] 7. Implement mobile-specific optimizations
  - [ ] 7.1 Optimize gallery layout for mobile **[FRONTEND]**
    - Ensure touch-friendly photo thumbnails
    - Add proper touch targets for mobile interaction
    - Implement mobile-specific grid layouts
    - Add pull-to-refresh functionality
    - _Requirements: Mobile optimization, Touch interaction_

  - [ ] 7.2 Enhance mobile drawer experience **[FRONTEND]**
    - Optimize full-screen drawer for mobile screens
    - Add mobile-specific navigation patterns
    - Implement mobile gesture support
    - Add mobile-specific animations
    - _Requirements: Mobile drawer, Gesture support_

  - [ ] 7.3 Add mobile processing options interface **[FRONTEND]**
    - Create large, touch-friendly processing controls
    - Optimize credit display for mobile screens
    - Add mobile-specific confirmation flows
    - _Requirements: Mobile processing, Touch optimization_

- [ ] 8. Implement responsive design patterns
  - [ ] 8.1 Create adaptive layouts **[FRONTEND]**
    - Implement responsive grid system
    - Add breakpoint-specific layouts
    - Create adaptive drawer behavior
    - _Requirements: Responsive design, Layout adaptation_

  - [ ] 8.2 Add cross-platform consistency **[FRONTEND]**
    - Ensure consistent behavior across devices
    - Implement platform-specific optimizations
    - Add device capability detection
    - _Requirements: Cross-platform, Device optimization_

## Phase 5: File Management and Operations (Medium Priority)

- [ ] 9. Implement file download functionality
  - [ ] 9.1 Create download service **[BACKEND]**
    - Implement secure file download with signed URLs
    - Add download progress tracking
    - Create download error handling
    - Add file format validation
    - _Requirements: File download, Security_

  - [ ] 9.2 Add download UI components **[FRONTEND]**
    - Create download buttons for individual results
    - Add download progress indicators
    - Implement download confirmation dialogs
    - _Requirements: Download UI, User feedback_

- [ ] 10. Implement file deletion functionality
  - [ ] 10.1 Create deletion service **[BACKEND]**
    - Implement secure file deletion from S3
    - Add deletion confirmation workflows
    - Create undo functionality for accidental deletions
    - Add deletion audit logging
    - _Requirements: File deletion, Data management_

  - [ ] 10.2 Add deletion UI components **[FRONTEND]**
    - Create delete buttons for individual results
    - Add deletion confirmation dialogs
    - Implement undo notifications
    - _Requirements: Deletion UI, User safety_

## Phase 6: Advanced Features and Optimization (Lower Priority)

- [ ] 11. Implement reprocessing functionality
  - [ ] 11.1 Add reprocessing options **[FRONTEND]**
    - Allow reprocessing of original photos
    - Enable processing of result photos as input
    - Create reprocessing cost calculation (UI logic)
    - Add reprocessing history tracking (API calls)
    - _Requirements: Reprocessing, Flexibility_

  - [ ] 11.2 Create reprocessing UI **[FRONTEND]**
    - Add reprocessing options to detail drawer
    - Create reprocessing confirmation flows
    - Implement reprocessing status tracking
    - _Requirements: Reprocessing UI, User experience_

- [ ] 12. Add performance optimizations
  - [ ] 12.1 Implement photo loading optimization **[FRONTEND]**
    - Add lazy loading for photo thumbnails
    - Implement progressive image loading
    - Create image caching strategies
    - Add memory management for large galleries
    - _Requirements: Performance, Memory optimization_

  - [ ] 12.2 Add caching and state management **[FRONTEND]**
    - Implement photo metadata caching
    - Create efficient state updates
    - Add background sync capabilities
    - _Requirements: Caching, State management_

## Phase 7: Testing and Quality Assurance (Ongoing)

- [ ] 13. Create comprehensive test suite
  - [ ] 13.1 Unit tests for components **[FRONTEND]**
    - Test PhotoGallery component functionality
    - Test PhotoDetailDrawer behavior
    - Test ProcessingOptionsPanel logic
    - Test ProcessingParameterDrawer animations and state
    - Test parameter input components (sliders, text inputs)
    - Test advanced options toggle behavior
    - Test CreditBalanceDisplay calculations
    - _Requirements: Component testing, Quality assurance_

  - [ ] 13.2 Integration tests for services **[BACKEND]**
    - Test PhotoManagementService operations
    - Test CreditManagementService calculations
    - Test file download/deletion workflows
    - Test processing job creation with parameters
    - Test parameter validation logic
    - Test parameter storage and retrieval
    - _Requirements: Service testing, Integration testing_

  - [ ] 13.3 Mobile and responsive testing **[FRONTEND]**
    - Test mobile drawer behavior
    - Test parameter drawer animations on mobile
    - Test slider controls on touch devices
    - Test text input on mobile keyboards
    - Test responsive layouts across devices
    - Test touch interactions and gestures
    - Test mobile-specific features
    - Test parameter drawers pushing content smoothly on different screen sizes
    - _Requirements: Mobile testing, Cross-device testing_

## Phase 8: Error Handling and User Experience (Ongoing)

- [ ] 14. Implement comprehensive error handling
  - [ ] 14.1 Create error handling system **[FRONTEND]**
    - Add error classification and handling
    - Create user-friendly error messages
    - Implement error recovery workflows
    - Add error logging and monitoring
    - _Requirements: Error handling, User experience_

  - [ ] 14.2 Add user guidance and help **[FRONTEND]**
    - Create contextual help system
    - Add onboarding for new users
    - Implement feature discovery
    - Add troubleshooting guides
    - _Requirements: User guidance, Help system_

## Implementation Notes

### Key Dependencies
- Photo upload system must be completed first
- Credit system integration required
- Processing job system integration needed
- S3 storage configuration required

### Critical Success Factors
- Mobile-first responsive design
- Smooth drawer animations
- Accurate credit calculations
- Reliable file management
- Cross-platform consistency

### Performance Considerations
- Lazy loading for large photo galleries
- Efficient image caching
- Memory management for mobile devices
- Optimized API calls and data fetching

### Security Requirements
- Secure file download with signed URLs
- Proper file deletion with confirmation
- Credit balance validation
- User permission checks

This implementation plan provides a comprehensive roadmap for building the photo management system with clear priorities, dependencies, and success criteria.
