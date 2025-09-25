# Context Findings

## Codebase Analysis

### Current Restoration Workflow Structure
- **API Endpoint**: `backend/app/api/v1/restoration.py` - FastAPI routes for job creation and status
- **Celery Task**: `backend/app/workers/tasks/restoration.py` - Async image processing task
- **ComfyUI Service**: `backend/app/services/comfyui.py` - Integration with ComfyUI API
- **S3 Service**: `backend/app/services/s3.py` - File storage operations
- **Database Model**: `backend/app/models/restoration.py` - Job tracking with PostgreSQL
- **Workflow Definition**: `backend/app/workflows/restore.json` - ComfyUI workflow configuration

### Current Testing Infrastructure
- **Test Framework**: pytest with async support (pytest-asyncio)
- **Coverage Tool**: pytest-cov
- **Code Quality**: black, isort, mypy
- **Dependencies**: No existing test files found in the codebase
- **Test Directory**: None exists yet - needs to be created

### Key Workflow Components to Test

#### 1. API Layer (`app/api/v1/restoration.py`)
- File upload validation (type, size limits)
- Job creation and database persistence 
- Celery task queueing
- Authentication and authorization
- Error handling for invalid requests

#### 2. Celery Task Layer (`app/workers/tasks/restoration.py`)
- Job status transitions (PENDING → PROCESSING → COMPLETED/FAILED)
- S3 file operations (download original, upload processed)
- ComfyUI service integration
- Error handling and job failure recovery
- Database updates throughout processing

#### 3. Service Layer
- **ComfyUI Service**: Image upload, workflow execution, result retrieval
- **S3 Service**: File upload/download with proper key generation

#### 4. Database Layer
- Job creation and status updates
- User-job association
- Error message storage

## 2025 Testing Best Practices Research

### Recommended Testing Strategy
1. **Unit Tests with Mocks** (Primary approach)
   - Mock S3 operations using `unittest.mock` or `pytest-mock`
   - Test ComfyUI with real service (per user requirement)
   - Mock Celery task execution for API tests
   - Use in-memory database for isolation

2. **Integration Tests** (Secondary)
   - End-to-end workflow testing with real ComfyUI
   - Celery worker testing using `celery_worker` fixture
   - Database integration with test PostgreSQL instance

### Modern Testing Stack Configuration
- **FastAPI Testing**: `httpx.AsyncClient` with `ASGITransport`
- **Async Testing**: `@pytest.mark.anyio` for async test functions
- **Celery Testing**: `celery.contrib.pytest` with worker fixtures
- **Database Testing**: SQLAlchemy test sessions with rollback
- **File Mocking**: Mock S3 operations, use test image files

### Key Testing Patterns
- **Fixture-based Setup**: Database sessions, test clients, mock services
- **Parametrized Tests**: Multiple file types, error conditions
- **Async/Await**: Proper async testing for FastAPI endpoints
- **Test Isolation**: Each test should be independent with proper cleanup

## File Structure Analysis
- Tests should be organized in `backend/tests/` directory
- Mirror the app structure: `tests/api/`, `tests/workers/`, `tests/services/`
- Use `conftest.py` for shared fixtures and configuration
- Separate unit tests from integration tests

## Integration Points Identified
- **S3 ↔ API**: File upload handling
- **API ↔ Database**: Job creation and status tracking  
- **API ↔ Celery**: Task queuing and status updates
- **Celery ↔ S3**: File download/upload operations
- **Celery ↔ ComfyUI**: Image processing workflow
- **Celery ↔ Database**: Status updates and error handling

## Error Scenarios to Test
- File type validation failures
- File size limit exceeded
- S3 upload/download failures
- ComfyUI service unavailability
- ComfyUI processing timeouts
- Database connection issues
- Invalid job IDs and unauthorized access