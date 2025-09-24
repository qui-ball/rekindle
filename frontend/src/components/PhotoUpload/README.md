# Photo Upload System

This directory contains the core photo upload system components for the Rekindle application.

## Structure

```
PhotoUpload/
├── PhotoUploadContainer.tsx    # Main orchestration component
├── types.ts                   # Component-specific type exports
└── README.md                  # This file
```

## Components

### PhotoUploadContainer
Main orchestration component that manages upload state and coordinates all upload methods.

**Props:**
- `onUploadComplete`: Callback when upload succeeds
- `onError`: Callback when upload fails
- `maxFileSize`: Maximum file size (default: 50MB)
- `allowedFormats`: Supported file formats

**Features:**
- Upload method selection (camera, gallery, desktop)
- Progress tracking with visual feedback
- Error handling with retry options
- State management for upload flow

## Implementation Status

✅ **Task 1 Complete**: Project structure and core interfaces
- Directory structure created
- TypeScript interfaces defined
- Basic component structure implemented

🔄 **Next Tasks**:
- Task 2: File validation and processing utilities
- Task 3: Drag-and-drop upload interface
- Task 4: Mobile camera capture functionality
- Task 5: Smart cropping interface

## Usage

```tsx
import { PhotoUploadContainer } from './components/PhotoUpload/PhotoUploadContainer';

function App() {
  const handleUploadComplete = (result: UploadResult) => {
    console.log('Upload complete:', result);
  };

  const handleUploadError = (error: UploadError) => {
    console.error('Upload error:', error);
  };

  return (
    <PhotoUploadContainer
      onUploadComplete={handleUploadComplete}
      onError={handleUploadError}
    />
  );
}
```