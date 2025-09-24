# Requirements Specification: Restoration Workflow Tests

## Problem Statement
The restoration workflow backend currently lacks comprehensive test coverage for its image processing pipeline. The system involves complex async operations with external services (ComfyUI, S3), database transactions, and Celery task processing, making it critical to implement thorough testing to ensure reliability and maintainability.

## Solution Overview
Implement a comprehensive test suite covering unit tests, integration tests, and error scenarios for the entire restoration workflow, from API endpoints through Celery tasks to completion. Tests will use real ComfyUI integration while mocking S3 operations, with SQLite in-memory database for speed and isolation.

## Functional Requirements

### FR1: API Layer Testing (`backend/app/api/v1/restoration.py`)
- **FR1.1**: Test file upload validation (JPEG, PNG, HEIC, WebP support)
- **FR1.2**: Test file size limit enforcement (50MB maximum)
- **FR1.3**: Test job creation with database persistence
- **FR1.4**: Test Celery task queuing on job creation
- **FR1.5**: Test job status retrieval by ID and user authorization
- **FR1.6**: Test user job listing with pagination
- **FR1.7**: Test error handling for invalid file types and oversized files
- **FR1.8**: Test authentication/authorization requirements

### FR2: Celery Task Testing (`backend/app/workers/tasks/restoration.py`)
- **FR2.1**: Test job status transitions (PENDING → PROCESSING → COMPLETED/FAILED)
- **FR2.2**: Test S3 file download operation (mocked)
- **FR2.3**: Test ComfyUI service integration (real service)
- **FR2.4**: Test processed image S3 upload (mocked)
- **FR2.5**: Test database updates throughout processing lifecycle
- **FR2.6**: Test error handling and failure recovery
- **FR2.7**: Test job completion with success status
- **FR2.8**: Test async workflow execution end-to-end

### FR3: Service Layer Testing
- **FR3.1**: Test ComfyUI service methods (real integration)
  - Image upload to ComfyUI
  - Workflow execution with parameters
  - Result retrieval and image download
  - Error handling for service unavailability
  - Timeout handling for long-running processes
- **FR3.2**: Test S3 service methods (mocked)
  - File upload with proper key generation
  - File download operations
  - Key pattern validation
  - Error handling for network failures

### FR4: Database Layer Testing
- **FR4.1**: Test RestorationJob model CRUD operations
- **FR4.2**: Test job status enum transitions
- **FR4.3**: Test user-job associations
- **FR4.4**: Test error message storage
- **FR4.5**: Test timestamp tracking (created_at, updated_at)

### FR5: Error Handling Testing
- **FR5.1**: Test network failure scenarios
- **FR5.2**: Test ComfyUI service timeout handling
- **FR5.3**: Test ComfyUI processing failures
- **FR5.4**: Test S3 operation failures (mocked)
- **FR5.5**: Test database connection issues
- **FR5.6**: Test invalid job ID handling
- **FR5.7**: Test unauthorized access attempts

## Technical Requirements

### TR1: Test Framework Setup
- **Framework**: pytest with async support (pytest-asyncio)
- **FastAPI Testing**: httpx.AsyncClient with ASGITransport
- **Async Testing**: @pytest.mark.anyio decorators
- **Database**: SQLite in-memory for test isolation
- **Celery Testing**: Eager mode for unit tests, real worker for integration

### TR2: Test Organization
- **Structure**: `backend/tests/` mirroring app structure
- **Directories**: `tests/api/`, `tests/workers/`, `tests/services/`, `tests/models/`
- **Configuration**: `conftest.py` with shared fixtures
- **Separation**: Unit tests and integration tests in separate modules

### TR3: Mocking Strategy
- **S3 Operations**: Mock all S3 service calls using unittest.mock
- **ComfyUI Integration**: Use real ComfyUI service as specified
- **Database**: SQLite in-memory for each test
- **Celery Tasks**: Mock .delay() calls in API tests, test actual execution separately

### TR4: Test Data Management
- **Image Files**: Small test images for upload testing
- **Database Fixtures**: Factory functions for RestorationJob creation
- **User Fixtures**: Mock authentication with test user IDs
- **S3 Key Validation**: Test proper key generation patterns

### TR5: Coverage Requirements
- **API Endpoints**: 100% coverage of all routes and error paths
- **Celery Tasks**: Complete workflow testing with all status transitions
- **Service Methods**: All public methods with success and failure cases
- **Error Scenarios**: Comprehensive error handling validation

## Implementation Hints and Patterns

### Test File Structure
```
backend/tests/
├── conftest.py                 # Shared fixtures and configuration
├── api/
│   ├── __init__.py
│   ├── test_restoration.py     # API endpoint tests
├── workers/
│   ├── __init__.py
│   ├── test_restoration_tasks.py  # Celery task tests
├── services/
│   ├── __init__.py
│   ├── test_comfyui.py         # ComfyUI service tests
│   ├── test_s3.py              # S3 service tests (mocked)
└── models/
    ├── __init__.py
    ├── test_restoration.py     # Database model tests
```

### Key Testing Patterns
- **Async Test Functions**: Use `async def` with `@pytest.mark.anyio`
- **Fixture Dependencies**: Database session → Test client → Test data
- **Cleanup**: Automatic rollback with SQLite in-memory
- **Parameterized Tests**: Multiple file types, error conditions
- **Real vs Mock**: ComfyUI real, S3 mocked, database in-memory

### Configuration Example
```python
# conftest.py
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from app.main import app

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    # Database setup logic

@pytest.fixture
async def async_client():
    async with AsyncClient(
        transport=ASGITransport(app=app), 
        base_url="http://test"
    ) as ac:
        yield ac
```

## Acceptance Criteria

### AC1: Test Suite Completeness
- [ ] All API endpoints have comprehensive test coverage
- [ ] All Celery tasks tested with real async execution
- [ ] All service methods tested (ComfyUI real, S3 mocked)
- [ ] All error scenarios have corresponding test cases
- [ ] Database models and status transitions validated

### AC2: Test Quality
- [ ] Tests run in isolation without external dependencies (except ComfyUI)
- [ ] Fast execution time (< 30 seconds for full suite)
- [ ] Clear test names describing the scenario being tested
- [ ] Proper setup and teardown for each test
- [ ] No test data leakage between tests

### AC3: CI/CD Integration
- [ ] Tests run successfully in CI environment
- [ ] Test failures provide clear diagnostic information
- [ ] Coverage reporting integrated
- [ ] Tests pass consistently without flakiness

### AC4: Developer Experience
- [ ] Easy to run individual tests or test suites
- [ ] Clear documentation for adding new tests
- [ ] Fixtures available for common test scenarios
- [ ] Mock helpers for S3 operations

## Assumptions
- ComfyUI service will be available during test execution at configured endpoint
- Test environment has access to create SQLite in-memory databases
- S3 operations are deterministic enough to mock effectively
- User authentication can be mocked for testing purposes
- Test images can be included in the repository for upload testing

## Dependencies
- pytest-asyncio for async test support
- httpx for FastAPI testing
- pytest-mock for enhanced mocking capabilities
- Small test image files for upload validation
- Access to running ComfyUI instance for integration tests