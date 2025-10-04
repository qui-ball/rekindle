# Design Document

## Overview

The Photo Management System provides users with a comprehensive interface to view, organize, and manage their processed photos while offering intuitive controls for selecting processing actions. The system serves as the central hub for photo collection management, credit usage tracking, and processing job initiation.

The design follows a modern, emotionally engaging approach that prioritizes user experience for our target demographic (30-60 year old families) while maintaining technical excellence and scalability. The system integrates seamlessly with existing upload and processing infrastructure while providing a cohesive, cross-platform experience.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PHOTO MANAGEMENT SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  📱 Mobile Interface                    💻 Desktop Interface                   │
│  ┌─────────────────────────────────────┐ ┌─────────────────────────────────────┐ │
│  │ • Touch-Optimized Gallery          │ │ • Responsive Grid Layout            │ │
│  │ • Swipe Navigation                 │ │ • Hover Interactions                │ │
│  │ • Drawer Detail View               │ │ • Drawer Detail View               │ │
│  │ • Processing Options Panel         │ │ • Processing Options Panel         │ │
│  └─────────────────────────────────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PHOTO MANAGEMENT LAYER                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Photo Gallery   │  │ Detail Drawer   │  │ Processing     │                │
│  │ Manager         │  │ Controller      │  │ Options        │                │
│  │ • Grid Layout   │  │ • Slide Anim.   │  │ Manager        │                │
│  │ • Status Icons  │  │ • Result Display│  │ • Credit Calc.  │                │
│  │ • Infinite Scroll│  │ • File Actions  │  │ • Job Queue    │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA & API LAYER                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Photo Service   │  │ Credit Service  │  │ Processing     │                │
│  │ • CRUD Ops      │  │ • Balance Check │  │ Service        │                │
│  │ • Metadata Mgmt │  │ • Cost Calc.    │  │ • Job Creation │                │
│  │ • File Relations│  │ • Purchase Links│  │ • Status Track │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              STORAGE & QUEUE LAYER                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ AWS S3 Storage  │  │ Database        │  │ Redis Queue     │                │
│  │ • Photo Files   │  │ • Photo Metadata│  │ • Processing    │                │
│  │ • Result Files  │  │ • User Credits │  │ • Job Status    │                │
│  │ • Thumbnails    │  │ • Relationships│  │ • Priority Mgmt │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Photo Management Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PHOTO MANAGEMENT FLOW                             │
└─────────────────────────────────────────────────────────────────────────────────┘

📱 Mobile Gallery Flow                    💻 Desktop Gallery Flow
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│                                     │  │                                     │
│ 1. Touch-Optimized Grid Display     │  │ 1. Responsive Grid Layout          │
│    ↓                                │  │    ↓                                │
│ 2. Pull-to-Refresh Loading         │  │ 2. Hover State Interactions         │
│    ↓                                │  │    ↓                                │
│ 3. Tap Photo → Drawer Slide-In      │  │ 3. Click Photo → Drawer Slide-In  │
│    ↓                                │  │    ↓                                │
│ 4. Swipe Through Results            │  │ 4. Keyboard Navigation            │
│    ↓                                │  │    ↓                                │
│ 5. Processing Options Panel         │  │ 5. Processing Options Panel        │
│    ↓                                │  │    ↓                                │
│ 6. Credit Cost Calculation          │  │ 6. Credit Cost Calculation         │
│    ↓                                │  │    ↓                                │
│ 7. Job Queue & Status Updates       │  │ 7. Job Queue & Status Updates       │
│                                     │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
                    │                                  │
                    └──────────────┬───────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              UNIFIED PROCESSING                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  📤 Photo Processing Pipeline                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ File Generation → Metadata Linking → Status Updates → Result Display   │   │
│  │ → Credit Deduction → Queue Management → Real-time Updates             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Core React Components

#### PhotoManagementContainer
**Purpose:** Main orchestration component that manages photo gallery state and coordinates all photo management functionality
**Props:**
```typescript
interface PhotoManagementContainerProps {
  userId: string;
  onPhotoSelect?: (photo: Photo) => void;
  onProcessingComplete?: (result: ProcessingResult) => void;
  onError?: (error: ManagementError) => void;
}
```

#### PhotoGallery
**Purpose:** Grid-based photo display with status indicators and touch-optimized interactions
**Props:**
```typescript
interface PhotoGalleryProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}
```

**Key Features:**
- Responsive grid layout (2-4 columns based on screen size)
- Touch-optimized photo thumbnails with status overlays
- Infinite scroll with pull-to-refresh on mobile
- Smooth loading animations and skeleton states
- Status indicators for processing states (queued, processing, completed, failed)

#### PhotoDetailDrawer
**Purpose:** Contextual drawer component for displaying photo details and associated results
**Props:**
```typescript
interface PhotoDetailDrawerProps {
  isOpen: boolean;
  photo: Photo | null;
  onClose: () => void;
  onPhotoAction: (action: PhotoAction, photo: Photo) => void;
  onProcessingStart: (options: ProcessingOptions) => void;
}
```

**Key Features:**
- **Mobile**: Full-screen overlay drawer that slides in from right, covers entire screen
- **Desktop**: Side panel drawer that slides in from right, covers ~60% of screen width, gallery remains visible on left
- Display original photo and all associated results
- Individual file actions (download, delete) for each result
- Processing options panel integration
- Swipe-to-close gesture on mobile, click-outside-to-close on desktop
- **Mobile**: "Back to Gallery" button in header
- **Desktop**: "Close" button in header, gallery remains partially visible

#### ProcessingOptionsPanel
**Purpose:** Interactive panel for selecting processing options with real-time credit calculation
**Props:**
```typescript
interface ProcessingOptionsPanelProps {
  photo: Photo;
  availableCredits: CreditBalance;
  onOptionsChange: (options: ProcessingOptions) => void;
  onProcess: (options: ProcessingOptions) => void;
  isProcessing: boolean;
}
```

**Key Features:**
- Dynamic checkbox options based on available credits
- Real-time credit cost calculation with discount display
- Disabled state for unaffordable options
- Combined processing discount indicators
- Processing confirmation with cost breakdown

#### CreditBalanceDisplay
**Purpose:** Prominent credit balance display with separate subscription and top-up credit tracking
**Props:**
```typescript
interface CreditBalanceDisplayProps {
  balance: CreditBalance;
  onPurchaseCredits: () => void;
  onViewSubscription: () => void;
  showWarning: boolean;
}
```

**Key Features:**
- Separate display for subscription credits (used first, monthly reset)
- Separate display for top-up credits (used second, carry over)
- Visual indicators showing which credits will be used for current processing
- Low credit warning with purchase prompts
- Quick access to subscription and top-up pages
- Real-time balance updates with usage breakdown

#### PhotoStatusIndicator
**Purpose:** Visual status indicators for different processing states
**Props:**
```typescript
interface PhotoStatusIndicatorProps {
  status: ProcessingStatus;
  progress?: number;
  estimatedTime?: number;
  onRetry?: () => void;
}
```

**Key Features:**
- Animated overlays for different states (queued, processing, completed, failed)
- Progress indicators for active processing
- Retry functionality for failed jobs
- Tooltip information on hover

### Service Layer Interfaces

#### PhotoManagementService
**Purpose:** Core service for photo CRUD operations and metadata management
```typescript
interface PhotoManagementService {
  getPhotos(userId: string, pagination: PaginationOptions): Promise<Photo[]>;
  getPhotoDetails(photoId: string): Promise<PhotoDetails>;
  deletePhoto(photoId: string): Promise<void>;
  deletePhotoResult(photoId: string, resultId: string): Promise<void>;
  downloadPhoto(photoId: string, resultId?: string): Promise<Blob>;
  getPhotoMetadata(photoId: string): Promise<PhotoMetadata>;
}
```

#### CreditManagementService
**Purpose:** Credit balance tracking and cost calculation with separate subscription/top-up handling
```typescript
interface CreditManagementService {
  getCreditBalance(userId: string): Promise<CreditBalance>;
  calculateProcessingCost(options: ProcessingOptions): Promise<CostBreakdown>;
  checkCreditAvailability(userId: string, cost: number): Promise<boolean>;
  deductCredits(userId: string, amount: number): Promise<CreditDeductionResult>;
  getCreditUsageBreakdown(userId: string, cost: number): Promise<CreditUsageBreakdown>;
}

interface CreditDeductionResult {
  subscriptionCreditsUsed: number;
  topupCreditsUsed: number;
  remainingSubscriptionCredits: number;
  remainingTopupCredits: number;
}

interface CreditUsageBreakdown {
  totalCost: number;
  subscriptionCreditsAvailable: number;
  topupCreditsAvailable: number;
  subscriptionCreditsNeeded: number;
  topupCreditsNeeded: number;
  canAfford: boolean;
}
```

#### ProcessingJobService
**Purpose:** Processing job creation and status management
```typescript
interface ProcessingJobService {
  createProcessingJob(photoId: string, options: ProcessingOptions): Promise<ProcessingJob>;
  getJobStatus(jobId: string): Promise<JobStatus>;
  cancelJob(jobId: string): Promise<void>;
  retryJob(jobId: string): Promise<void>;
  getProcessingHistory(photoId: string): Promise<ProcessingJob[]>;
}
```

## Data Models

### Photo Management Data Models

#### Photo Entity
```typescript
interface Photo {
  id: string;
  userId: string;
  originalFilename: string;
  fileKey: string;
  thumbnailKey: string;
  status: 'uploaded' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  metadata: PhotoMetadata;
  results: PhotoResult[];
  processingJobs: ProcessingJob[];
}

interface PhotoMetadata {
  dimensions: { width: number; height: number };
  fileSize: number;
  format: string;
  uploadMethod: 'camera' | 'gallery' | 'desktop' | 'qr' | 'share';
  originalUrl: string;
  thumbnailUrl: string;
}
```

#### Photo Result Entity
```typescript
interface PhotoResult {
  id: string;
  photoId: string;
  resultType: 'restored' | 'colourized' | 'animated' | 'combined';
  fileKey: string;
  thumbnailKey: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  processingJobId: string;
  metadata: ResultMetadata;
}

interface ResultMetadata {
  dimensions: { width: number; height: number };
  fileSize: number;
  format: string;
  quality: 'standard' | 'hd';
  processingTime: number;
  model: string;
  parameters: Record<string, any>;
}
```

#### Credit Balance Model
```typescript
interface CreditBalance {
  totalCredits: number;
  subscriptionCredits: number;
  topupCredits: number;
  subscriptionTier: 'free' | 'remember' | 'cherish' | 'forever';
  monthlyResetDate?: Date;
  lowCreditWarning: boolean;
  creditHistory: CreditTransaction[];
  usageRules: {
    subscriptionFirst: true;
    subscriptionExpires: true;
    topupCarryOver: true;
  };
}

interface CreditTransaction {
  id: string;
  type: 'earned' | 'spent' | 'purchased' | 'refunded';
  amount: number;
  description: string;
  createdAt: Date;
  processingJobId?: string;
}
```

#### Processing Options Model
```typescript
interface ProcessingOptions {
  restore: boolean;
  colourize: boolean;
  animate: boolean;
  bringTogether: boolean;
  quality: 'standard' | 'hd';
  customParameters?: Record<string, any>;
}

interface CostBreakdown {
  individualCosts: {
    restore: number;
    colourize: number;
    animate: number;
    bringTogether: number;
  };
  subtotal: number;
  combinedDiscount: number;
  totalCost: number;
  availableCredits: number;
  remainingCredits: number;
  creditUsage: {
    subscriptionCreditsUsed: number;
    topupCreditsUsed: number;
    subscriptionCreditsRemaining: number;
    topupCreditsRemaining: number;
  };
}
```

#### Processing Job Model
```typescript
interface ProcessingJob {
  id: string;
  photoId: string;
  userId: string;
  options: ProcessingOptions;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  costCredits: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
  error?: string;
  resultIds: string[];
}
```

### API Response Models

#### Photo Gallery Response
```typescript
interface PhotoGalleryResponse {
  photos: Photo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  creditBalance: CreditBalance;
}
```

#### Photo Detail Response
```typescript
interface PhotoDetailResponse {
  photo: Photo;
  results: PhotoResult[];
  processingJobs: ProcessingJob[];
  relatedPhotos: Photo[];
}
```

## User Interface Design

### Mobile-First Design Principles

#### Gallery Layout (Mobile)
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MOBILE GALLERY LAYOUT                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Header: Sub (25) | Top-up (95) | Upload Button | Settings              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                              │
│  │ Photo 1 │ │ Photo 2 │ │ Photo 3 │ │ Photo 4 │                              │
│  │ [Status]│ │ [Status]│ │ [Status]│ │ [Status]│                              │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                              │
│                                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                              │
│  │ Photo 5 │ │ Photo 6 │ │ Photo 7 │ │ Photo 8 │                              │
│  │ [Status]│ │ [Status]│ │ [Status]│ │ [Status]│                              │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                              │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    Loading More Photos...                              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Detail Drawer (Mobile - Full Screen Overlay)
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MOBILE DETAIL DRAWER                             │
│                              (Full Screen Overlay)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ ← Back to Gallery                    Photo Details              ⋯ Menu  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │                    Original Photo (Large Display)                      │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Results:                                                               │   │
│  │ ┌─────────────────────────────────────────────────────────────────────┐ │   │
│  │ │ Restored                    [Download] [Delete]                     │ │   │
│  │ │ [Status]                                                           │ │   │
│  │ └─────────────────────────────────────────────────────────────────────┘ │   │
│  │ ┌─────────────────────────────────────────────────────────────────────┐ │   │
│  │ │ Colourized                  [Download] [Delete]                     │ │   │
│  │ │ [Status]                                                           │ │   │
│  │ └─────────────────────────────────────────────────────────────────────┘ │   │
│  │ ┌─────────────────────────────────────────────────────────────────────┐ │   │
│  │ │ Animated                    [Download] [Delete]                     │ │   │
│  │ │ [Status]                                                           │ │   │
│  │ └─────────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Processing Options:                                                    │   │
│  │ ☐ Restore (2 credits)    ☐ Colourize (3 credits)                     │   │
│  │ ☐ Animate (8 credits)    ☐ Bring Together (6 credits)                │   │
│  │                                                                         │   │
│  │ Total: 5 credits (Sub: 5, Top-up: 0) | Process Photo                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Desktop Design Adaptations

#### Gallery Layout (Desktop)
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DESKTOP GALLERY LAYOUT                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Header: Sub (25) | Top-up (95) | Upload Photos | My Account | Settings │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Photo 1 │ │ Photo 2 │ │ Photo 3 │ │ Photo 4 │ │ Photo 5 │ │ Photo 6 │   │
│  │ [Status]│ │ [Status]│ │ [Status]│ │ [Status]│ │ [Status]│ │ [Status]│   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Photo 7 │ │ Photo 8 │ │ Photo 9 │ │Photo 10 │ │Photo 11 │ │Photo 12 │   │
│  │ [Status]│ │ [Status]│ │ [Status]│ │ [Status]│ │ [Status]│ │ [Status]│   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Detail Drawer (Desktop - Side Panel)
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DESKTOP DETAIL DRAWER                             │
│                              (Side Panel - 60% Width)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ × Close Drawer                      Photo Details              ⋯ Menu  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Original Photo (Large)                    │ Results Panel              │   │
│  │                                           │ ┌─────────────────────────┐ │   │
│  │                                           │ │ Restored                │ │   │
│  │                                           │ │ [Download] [Delete]     │ │   │
│  │                                           │ └─────────────────────────┘ │   │
│  │                                           │ ┌─────────────────────────┐ │   │
│  │                                           │ │ Colourized             │ │   │
│  │                                           │ │ [Download] [Delete]     │ │   │
│  │                                           │ └─────────────────────────┘ │   │
│  │                                           │ ┌─────────────────────────┐ │   │
│  │                                           │ │ Animated               │ │   │
│  │                                           │ │ [Download] [Delete]     │ │   │
│  │                                           │ └─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Processing Options:                                                    │   │
│  │ ☐ Restore (2 credits)    ☐ Colourize (3 credits)                     │   │
│  │ ☐ Animate (8 credits)    ☐ Bring Together (6 credits)                │   │
│  │                                                                         │   │
│  │ Total: 5 credits (Sub: 5, Top-up: 0) | Process Photo                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Desktop Layout with Side Panel (Gallery + Drawer)
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DESKTOP LAYOUT WITH DRAWER                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Header: Sub (25) | Top-up (95) | Upload Photos | My Account | Settings │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ Gallery (40% width)              │ Detail Drawer (60% width)          │   │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ ┌─────────────────────────────┐ │   │
│  │ │ Photo 1 │ │ Photo 2 │ │ Photo 3 │ │ │ Photo Details              │ │   │
│  │ │ [Status]│ │ [Status]│ │ [Status]│ │ │                             │ │   │
│  │ └─────────┘ └─────────┘ └─────────┘ │ │ Original Photo (Large)      │ │   │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │                             │ │   │
│  │ │ Photo 4 │ │ Photo 5 │ │ Photo 6 │ │ │ Results:                   │ │   │
│  │ │ [Status]│ │ [Status]│ │ [Status]│ │ │ ┌─────────┐ ┌─────────┐     │ │   │
│  │ └─────────┘ └─────────┘ └─────────┘ │ │ │Restored │ │Coloured │     │ │   │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │ │[Status] │ │[Status] │     │ │   │
│  │ │ Photo 7 │ │ Photo 8 │ │ Photo 9 │ │ │ └─────────┘ └─────────┘     │ │   │
│  │ │ [Status]│ │ [Status]│ │ [Status]│ │ │                             │ │   │
│  │ └─────────┘ └─────────┘ └─────────┘ │ │ Processing Options:         │ │   │
│  │                                     │ │ ☐ Restore ☐ Colourize     │ │   │
│  │                                     │ │ Total: 5 credits          │ │   │
│  │                                     │ └─────────────────────────────┘ │   │
│  └─────────────────────────────────────┴─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Status Indicator Design

#### Processing Status Overlays
```typescript
interface StatusOverlay {
  'ready': {
    icon: 'check-circle';
    color: 'green';
    animation: 'none';
    text: 'Ready to Process';
  };
  'queued': {
    icon: 'clock';
    color: 'blue';
    animation: 'pulse';
    text: 'In Queue';
  };
  'processing': {
    icon: 'spinner';
    color: 'orange';
    animation: 'spin';
    text: 'Processing...';
  };
  'completed': {
    icon: 'check-circle';
    color: 'green';
    animation: 'bounce';
    text: 'Completed';
  };
  'failed': {
    icon: 'exclamation-triangle';
    color: 'red';
    animation: 'shake';
    text: 'Failed - Tap to Retry';
  };
}
```

### Animation and Interaction Design

#### Drawer Animation
```typescript
interface DrawerAnimation {
  mobile: {
    // Full-screen overlay drawer
    enter: 'slideInRight';
    exit: 'slideOutRight';
    duration: 300;
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)';
    overlay: true; // Covers entire screen
    backdrop: true; // Dark backdrop behind drawer
  };
  desktop: {
    // Side panel drawer
    enter: 'slideInRight';
    exit: 'slideOutRight';
    duration: 250;
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)';
    overlay: false; // Does not cover entire screen
    backdrop: false; // No backdrop, gallery remains visible
    width: '60%'; // Takes up 60% of screen width
    galleryRemainsVisible: true; // Gallery stays visible on left
  };
}
```

#### Photo Grid Interactions
```typescript
interface GridInteractions {
  hover: {
    scale: 1.05;
    shadow: '0 8px 25px rgba(0,0,0,0.15)';
    transition: 'all 0.2s ease';
  };
  tap: {
    scale: 0.95;
    transition: 'all 0.1s ease';
  };
  loading: {
    skeleton: 'shimmer';
    duration: 1.5;
  };
}
```

## Error Handling

### Error Classification System
```typescript
enum PhotoManagementErrorType {
  LOAD_ERROR = 'load_error',
  PROCESSING_ERROR = 'processing_error',
  CREDIT_ERROR = 'credit_error',
  NETWORK_ERROR = 'network_error',
  PERMISSION_ERROR = 'permission_error',
  STORAGE_ERROR = 'storage_error'
}

interface PhotoManagementError {
  type: PhotoManagementErrorType;
  message: string;
  retryable: boolean;
  action?: string;
  details?: any;
}
```

### User-Friendly Error Messages
- **Load Error:** "Unable to load your photos. Please check your connection and try again."
- **Credit Insufficient:** "You don't have enough credits. Purchase more credits to continue processing."
- **Processing Failed:** "Photo processing failed. Tap to retry or try different options."
- **Network Error:** "Connection lost. Your photos are safe and will sync when reconnected."
- **Permission Error:** "Unable to access your photos. Please check your browser permissions."

## Credit Management System

### Credit Usage Logic
```typescript
interface CreditUsageLogic {
  // Credit deduction algorithm
  deductCredits(cost: number, balance: CreditBalance): CreditDeductionResult {
    const result: CreditDeductionResult = {
      subscriptionCreditsUsed: 0,
      topupCreditsUsed: 0,
      remainingSubscriptionCredits: balance.subscriptionCredits,
      remainingTopupCredits: balance.topupCredits
    };

    // Always use subscription credits first
    if (cost <= balance.subscriptionCredits) {
      result.subscriptionCreditsUsed = cost;
      result.remainingSubscriptionCredits = balance.subscriptionCredits - cost;
    } else {
      // Use all subscription credits, then top-up credits
      result.subscriptionCreditsUsed = balance.subscriptionCredits;
      result.remainingSubscriptionCredits = 0;
      result.topupCreditsUsed = cost - balance.subscriptionCredits;
      result.remainingTopupCredits = balance.topupCredits - result.topupCreditsUsed;
    }

    return result;
  }
}
```

### Credit Display Components
```typescript
interface CreditDisplayProps {
  subscriptionCredits: number;
  topupCredits: number;
  subscriptionTier: string;
  monthlyResetDate?: Date;
  showUsageBreakdown?: boolean;
  processingCost?: number;
}

// Example credit display logic
const CreditDisplay: React.FC<CreditDisplayProps> = ({
  subscriptionCredits,
  topupCredits,
  subscriptionTier,
  monthlyResetDate,
  showUsageBreakdown,
  processingCost
}) => {
  const totalCredits = subscriptionCredits + topupCredits;
  const willUseSubscription = processingCost ? processingCost <= subscriptionCredits : false;
  const willUseTopup = processingCost ? processingCost > subscriptionCredits : false;
  
  return (
    <div className="credit-display">
      <div className="subscription-credits">
        <span className="label">Subscription:</span>
        <span className="count">{subscriptionCredits}</span>
        {monthlyResetDate && (
          <span className="reset-info">Resets {formatDate(monthlyResetDate)}</span>
        )}
      </div>
      <div className="topup-credits">
        <span className="label">Top-up:</span>
        <span className="count">{topupCredits}</span>
        <span className="carry-over">Carries over</span>
      </div>
      {showUsageBreakdown && processingCost && (
        <div className="usage-breakdown">
          <span>Processing will use:</span>
          {willUseSubscription && (
            <span>Subscription: {Math.min(processingCost, subscriptionCredits)}</span>
          )}
          {willUseTopup && (
            <span>Top-up: {Math.max(0, processingCost - subscriptionCredits)}</span>
          )}
        </div>
      )}
    </div>
  );
};
```

## Performance Optimization

### Photo Loading Strategy
```typescript
interface PhotoLoadingStrategy {
  thumbnailSize: '150x150';
  lazyLoading: true;
  preloadCount: 10;
  cacheStrategy: 'aggressive';
  compression: 'webp';
  fallback: 'jpeg';
}
```

### Memory Management
```typescript
interface MemoryManagement {
  maxLoadedPhotos: 50;
  cleanupThreshold: 100;
  imageCache: 'LRU';
  resultCache: 'persistent';
  metadataCache: 'persistent';
}
```

This design provides a comprehensive foundation for implementing the photo management system while maintaining focus on user experience, emotional engagement, and technical excellence across all platforms.
