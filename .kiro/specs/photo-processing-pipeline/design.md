# Design Document

## Overview

The Photo Processing Pipeline is a scalable, AI-powered system that transforms uploaded family photos through restoration and colourization using RunPod's serverless infrastructure. The system manages the complete workflow from job creation to result delivery, implementing a credit-based business model with tier-based quality and priority controls.

The design prioritizes cost efficiency, reliability, and user experience by implementing intelligent queue management, automatic retry logic, and real-time status updates. The architecture supports both free and paid tiers with appropriate quality limitations and processing priorities while maintaining strict cost controls and usage analytics.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT INTERFACE LAYER                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  📱 Frontend UI                         🔌 API Gateway                         │
│  ┌─────────────────────────────────────┐ ┌─────────────────────────────────────┐ │
│  │ • Processing Options UI             │ │ • Job Creation Endpoints            │ │
│  │ • Real-time Status Updates          │ │ • Status Polling Endpoints          │ │
│  │ • Results Viewer                    │ │ • Authentication & Authorization    │ │
│  │ • Credit Management                 │ │ • Rate Limiting & Validation        │ │
│  └─────────────────────────────────────┘ └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              JOB ORCHESTRATION LAYER                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Job Manager     │  │ Credit Manager  │  │ Queue Manager   │                │
│  │ • Job creation  │  │ • Credit deduct │  │ • Priority mgmt │                │
│  │ • Status track  │  │ • Tier enforce  │  │ • Load balancing│                │
│  │ • Error handling│  │ • Cost tracking │  │ • Worker scaling│                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              QUEUE & STORAGE LAYER                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ Redis Queues    │  │ PostgreSQL DB   │  │ AWS S3 Storage  │                │
│  │ • Free tier     │  │ • Job metadata  │  │ • Input images  │                │
│  │ • Paid priority │  │ • User credits  │  │ • Results       │                │
│  │ • Retry logic   │  │ • Cost tracking │  │ • Thumbnails    │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI PROCESSING LAYER                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         RunPod Serverless                              │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │ Qwen 3 Image    │  │ Worker Pool     │  │ Result Handler  │        │   │
│  │  │ Edit Model      │  │ • Auto-scaling  │  │ • Quality check │        │   │
│  │  │ • Restoration   │  │ • Load balancing│  │ • Format conv.  │        │   │
│  │  │ • Colourization │  │ • Cost tracking │  │ • Upload to S3  │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Processing Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PROCESSING FLOW DIAGRAM                           │
└─────────────────────────────────────────────────────────────────────────────────┘

📤 Job Creation Flow                     🔄 Processing Flow
┌─────────────────────────────────────┐  ┌─────────────────────────────────────┐
│                                     │  │                                     │
│ 1. User Selects Processing Options  │  │ 1. Worker Picks Up Job              │
│    ↓                                │  │    ↓                                │
│ 2. Credit Validation & Deduction    │  │ 2. Download Image from S3           │
│    ↓                                │  │    ↓                                │
│ 3. Job Creation with Metadata       │  │ 3. Prepare RunPod Request           │
│    ↓                                │  │    ↓                                │
│ 4. Queue Assignment (Priority)      │  │ 4. Send to RunPod API               │
│    ↓                                │  │    ↓                                │
│ 5. Real-time Status: "Queued"       │  │ 5. Monitor Processing Progress      │
│    ↓                                │  │    ↓                                │
│ 6. Queue Position Updates           │  │ 6. Receive Processed Result         │
│                                     │  │    ↓                                │
│                                     │  │ 7. Quality Validation               │
│                                     │  │    ↓                                │
│                                     │  │ 8. Upload Result to S3              │
│                                     │  │    ↓                                │
│                                     │  │ 9. Update Job Status: "Complete"    │
│                                     │  │    ↓                                │
│                                     │  │ 10. Generate Thumbnail              │
│                                     │  │    ↓                                │
│                                     │  │ 11. Notify User                     │
│                                     │  │                                     │
└─────────────────────────────────────┘  └─────────────────────────────────────┘
                    │                                  │
                    └──────────────┬───────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ERROR HANDLING FLOW                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  🚨 Failure Scenarios                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ RunPod API Failure → Retry (3x) → Refund Credits → User Notification   │   │
│  │ Processing Timeout → Cancel Job → Refund Credits → Queue Health Check  │   │
│  │ Result Corruption → Auto-Reprocess → Quality Validation → Success      │   │
│  │ S3 Upload Failure → Retry Upload → Alternative Storage → Manual Review │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Core Service Classes

#### JobManager
**Purpose:** Central orchestration for all processing jobs
```python
class JobManager:
    def create_job(self, user_id: str, photo_id: str, options: ProcessingOptions) -> ProcessingJob:
        """Create new processing job with credit validation"""
        
    def get_job_status(self, job_id: str) -> JobStatus:
        """Get current job status and progress"""
        
    def cancel_job(self, job_id: str) -> bool:
        """Cancel job and refund credits if applicable"""
        
    def retry_failed_job(self, job_id: str) -> ProcessingJob:
        """Retry failed job without additional credit charge"""
        
    def get_user_jobs(self, user_id: str, limit: int = 10) -> List[ProcessingJob]:
        """Get user's recent jobs with pagination"""
```

#### CreditManager
**Purpose:** Handle credit deduction, validation, and tier enforcement
```python
class CreditManager:
    def validate_credits(self, user_id: str, cost: int) -> CreditValidationResult:
        """Check if user has sufficient credits"""
        
    def deduct_credits(self, user_id: str, cost: int, job_id: str) -> CreditTransaction:
        """Atomically deduct credits for job"""
        
    def refund_credits(self, user_id: str, amount: int, reason: str) -> CreditTransaction:
        """Refund credits for failed/cancelled jobs"""
        
    def get_credit_cost(self, processing_type: ProcessingType, user_tier: UserTier) -> int:
        """Calculate credit cost based on processing type and user tier"""
        
    def apply_tier_limits(self, user_id: str, job_options: ProcessingOptions) -> ProcessingOptions:
        """Apply tier-specific limitations (resolution, watermarks, etc.)"""
```

#### QueueManager
**Purpose:** Manage job queues with priority and load balancing
```python
class QueueManager:
    def enqueue_job(self, job: ProcessingJob, priority: QueuePriority) -> QueuePosition:
        """Add job to appropriate priority queue"""
        
    def get_queue_position(self, job_id: str) -> int:
        """Get current position in queue"""
        
    def estimate_wait_time(self, queue_position: int, queue_name: str) -> int:
        """Estimate processing wait time in seconds"""
        
    def scale_workers(self, queue_metrics: QueueMetrics) -> ScalingDecision:
        """Determine if worker scaling is needed"""
        
    def rebalance_queues(self) -> RebalanceResult:
        """Redistribute jobs across queues for optimal processing"""
```

#### RunPodService
**Purpose:** Interface with RunPod API for AI processing
```python
class RunPodService:
    def __init__(self, api_key: str, endpoint_id: str):
        self.client = runpod.Endpoint(endpoint_id)
        
    async def process_image(self, image_data: bytes, options: ProcessingOptions) -> ProcessingResult:
        """Send image to RunPod for AI processing"""
        
    async def check_job_status(self, runpod_job_id: str) -> RunPodJobStatus:
        """Check status of RunPod job"""
        
    async def cancel_job(self, runpod_job_id: str) -> bool:
        """Cancel running RunPod job"""
        
    def get_cost_estimate(self, processing_type: ProcessingType, resolution: str) -> float:
        """Estimate processing cost in USD"""
```

### Queue System Design

#### Priority Queue Structure
```python
class QueuePriority(Enum):
    FREE_TIER = 1      # Standard processing queue
    REMEMBER = 2       # Basic paid tier
    CHERISH = 3        # Mid-tier priority
    FOREVER = 4        # Highest priority
    RETRY = 5          # Failed job retries (highest priority)

class QueueConfiguration:
    queues = {
        'free_tier': {
            'priority': QueuePriority.FREE_TIER,
            'max_concurrent': 2,
            'timeout': 300,  # 5 minutes
            'retry_attempts': 3
        },
        'paid_priority': {
            'priority': QueuePriority.CHERISH,
            'max_concurrent': 8,
            'timeout': 180,  # 3 minutes
            'retry_attempts': 3
        },
        'forever_tier': {
            'priority': QueuePriority.FOREVER,
            'max_concurrent': 4,
            'timeout': 120,  # 2 minutes
            'retry_attempts': 5
        }
    }
```

#### Worker Pool Management
```python
class WorkerPool:
    def __init__(self, redis_connection: Redis):
        self.queues = [
            Queue('forever_tier', connection=redis_connection),
            Queue('paid_priority', connection=redis_connection),
            Queue('free_tier', connection=redis_connection)
        ]
        
    def start_workers(self, worker_count: int):
        """Start worker processes with queue priority"""
        
    def scale_workers(self, target_count: int):
        """Dynamically scale worker count based on queue load"""
        
    def monitor_health(self) -> WorkerHealthStatus:
        """Monitor worker health and restart failed workers"""
```

## Data Models

### Processing Job Schema
```python
@dataclass
class ProcessingJob:
    id: str
    user_id: str
    photo_id: str
    status: JobStatus
    processing_type: ProcessingType
    user_tier: UserTier
    
    # Processing configuration
    options: ProcessingOptions
    resolution: str  # '480p' or '720p'
    add_watermark: bool
    
    # Queue and timing
    queue_name: str
    priority: QueuePriority
    queued_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    
    # RunPod integration
    runpod_job_id: Optional[str]
    runpod_status: Optional[str]
    
    # Cost and credits
    credit_cost: int
    actual_cost_usd: Optional[float]
    credit_transaction_id: str
    
    # Results
    input_file_key: str
    output_file_key: Optional[str]
    thumbnail_key: Optional[str]
    
    # Error handling
    error_message: Optional[str]
    retry_count: int
    max_retries: int

class ProcessingOptions:
    restoration: bool = False
    colourization: bool = False
    combined: bool = False  # restoration + colourization
    
    def get_processing_type(self) -> ProcessingType:
        if self.combined:
            return ProcessingType.COMBINED
        elif self.restoration:
            return ProcessingType.RESTORATION
        elif self.colourization:
            return ProcessingType.COLOURIZATION
        else:
            raise ValueError("No processing type selected")
```

### Credit System Schema
```python
@dataclass
class CreditTransaction:
    id: str
    user_id: str
    transaction_type: TransactionType  # DEDUCTION, REFUND, PURCHASE
    amount: int
    balance_before: int
    balance_after: int
    job_id: Optional[str]
    reason: str
    created_at: datetime

class CreditCosts:
    RESTORATION = 2
    COLOURIZATION = 3
    COMBINED = 4  # 1 credit discount
    
    @classmethod
    def get_cost(cls, processing_type: ProcessingType) -> int:
        costs = {
            ProcessingType.RESTORATION: cls.RESTORATION,
            ProcessingType.COLOURIZATION: cls.COLOURIZATION,
            ProcessingType.COMBINED: cls.COMBINED
        }
        return costs[processing_type]
```

### Queue Metrics and Analytics
```python
@dataclass
class QueueMetrics:
    queue_name: str
    pending_jobs: int
    processing_jobs: int
    completed_jobs_last_hour: int
    failed_jobs_last_hour: int
    average_processing_time: float
    estimated_wait_time: int
    worker_count: int
    worker_utilization: float

@dataclass
class CostAnalytics:
    date: date
    total_jobs: int
    total_revenue_credits: int
    total_cost_usd: float
    profit_margin: float
    jobs_by_type: Dict[ProcessingType, int]
    jobs_by_tier: Dict[UserTier, int]
    average_processing_time: float
```

## Error Handling

### Comprehensive Error Classification
```python
class ProcessingError(Exception):
    def __init__(self, error_type: ErrorType, message: str, retryable: bool = False):
        self.error_type = error_type
        self.message = message
        self.retryable = retryable
        super().__init__(message)

class ErrorType(Enum):
    INSUFFICIENT_CREDITS = "insufficient_credits"
    RUNPOD_API_ERROR = "runpod_api_error"
    RUNPOD_TIMEOUT = "runpod_timeout"
    IMAGE_PROCESSING_ERROR = "image_processing_error"
    S3_UPLOAD_ERROR = "s3_upload_error"
    QUEUE_ERROR = "queue_error"
    VALIDATION_ERROR = "validation_error"
    SYSTEM_ERROR = "system_error"

class ErrorHandler:
    def handle_error(self, error: ProcessingError, job: ProcessingJob) -> ErrorResponse:
        """Handle processing errors with appropriate actions"""
        
    def should_retry(self, error: ProcessingError, retry_count: int) -> bool:
        """Determine if job should be retried"""
        
    def get_user_message(self, error: ProcessingError) -> str:
        """Generate user-friendly error message"""
        
    def log_error(self, error: ProcessingError, job: ProcessingJob, context: dict):
        """Log error with full context for debugging"""
```

### Retry Strategy Implementation
```python
class RetryStrategy:
    def __init__(self):
        self.retry_delays = [30, 120, 300]  # 30s, 2min, 5min
        self.max_retries = 3
        
    def get_retry_delay(self, attempt: int) -> int:
        """Get delay before retry attempt"""
        if attempt <= len(self.retry_delays):
            return self.retry_delays[attempt - 1]
        return self.retry_delays[-1]
        
    def should_retry(self, error: ProcessingError, attempt: int) -> bool:
        """Determine if error is retryable and within limits"""
        return (
            error.retryable and 
            attempt <= self.max_retries and
            error.error_type in [
                ErrorType.RUNPOD_API_ERROR,
                ErrorType.RUNPOD_TIMEOUT,
                ErrorType.S3_UPLOAD_ERROR
            ]
        )
```

## Testing Strategy

### Unit Testing Focus
- **Credit management:** Deduction, refund, and validation logic
- **Queue operations:** Job enqueueing, priority handling, position calculation
- **Error handling:** All error scenarios and retry logic
- **Cost calculations:** Credit costs, tier limitations, profit tracking
- **RunPod integration:** API calls, response handling, timeout management

### Integration Testing
- **End-to-end job processing:** From creation to completion
- **Queue priority enforcement:** Verify paid jobs process before free jobs
- **Credit transaction atomicity:** Ensure credits are properly managed
- **Error recovery:** Test retry logic and credit refunds
- **Real-time status updates:** WebSocket or polling mechanisms

### Load Testing Scenarios
- **High queue volume:** 1000+ concurrent jobs across all tiers
- **Worker scaling:** Automatic scaling under load
- **Cost control:** Budget limits and emergency shutoffs
- **Database performance:** Query optimization under load
- **RunPod API limits:** Rate limiting and backoff strategies

### Error Scenario Testing
- **RunPod service outages:** Queue backup and recovery
- **Database failures:** Transaction rollback and data consistency
- **S3 storage issues:** Alternative storage and retry logic
- **Credit system failures:** Transaction integrity and audit trails
- **Worker crashes:** Job reassignment and status recovery

This design provides a robust, scalable foundation for the photo processing pipeline that can handle the demands of a growing user base while maintaining cost efficiency and reliability.