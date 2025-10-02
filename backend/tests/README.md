# Test Suite

This directory contains the test suite for the Rekindle backend application.

## Test Structure

```
tests/
├── api/                    # API endpoint tests
├── fixtures/              # Test data and utilities
├── models/                # Database model tests
├── services/              # Service layer tests
├── workers/               # Background worker tests
├── conftest.py            # Shared test configuration and fixtures
└── test_config.py         # Configuration tests
```

## Running Tests

### Quick Start

```bash
# Run all tests with SQLite (fast)
uv run pytest

# Run with verbose output
uv run pytest -v

# Run specific test file
uv run pytest tests/services/test_db.py -v
```

### Integration Tests

Some tests require real external services and are marked as integration tests:

```bash
# Run integration tests (requires real database, AWS, etc.)
RUN_INTEGRATION_TESTS=1 uv run pytest tests/services/test_s3.py::TestS3ServiceIntegration -v

# Run database tests against real PostgreSQL
RUN_INTEGRATION_TESTS=1 uv run pytest tests/services/test_db.py -v
```

### Service-Specific Tests

#### ComfyUI Tests
```bash
# Test against local ComfyUI instance
COMFYUI_TEST_URL="http://127.0.0.1:8188" uv run pytest tests/services/test_comfyui.py -v

# Test against remote ComfyUI instance
COMFYUI_TEST_URL="http://192.168.0.27:8188" uv run pytest tests/services/test_comfyui.py -v
```

#### S3 Integration Tests
```bash
# Run S3 integration tests (requires AWS credentials in .env)
RUN_INTEGRATION_TESTS=1 uv run pytest tests/services/test_s3.py::TestS3ServiceIntegration -v
```

## Test Types

### Unit Tests (Default)
- Use SQLite in-memory database
- Mock external services (S3, ComfyUI, etc.)
- Fast execution
- No external dependencies

### Integration Tests
- Use real PostgreSQL database
- Connect to actual AWS S3
- Test real ComfyUI instances
- Require proper environment setup

## Environment Variables

### Required for Integration Tests
```bash
# Database (from .env file)
DATABASE_URL='postgresql://user:pass@host:5432/db'

# AWS (from .env file)  
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=your_bucket

# ComfyUI (optional, defaults to localhost)
COMFYUI_TEST_URL=http://your-comfyui-host:8188

# Integration test flag
RUN_INTEGRATION_TESTS=1
```

### Test-Only Variables
```bash
# Secret for JWT tokens (set automatically in tests)
SECRET_KEY=test_secret_key_for_testing_only

# Redis for job queue (set automatically in tests)
REDIS_URL=redis://localhost:6379/1
```

## Test Configuration

### conftest.py
- Sets up test database (SQLite vs PostgreSQL)
- Provides shared fixtures
- Handles dependency injection overrides
- Configures mock services

### Key Fixtures
- `test_db_session` - Database session with rollback
- `async_client` - FastAPI test client
- `mock_user` - Authenticated user for API tests
- `job_factory` - Creates test jobs
- `test_image_bytes` - Sample image data

## Writing Tests

### Service Tests
```python
def test_service_function(self, service_fixture):
    """Test description"""
    # Arrange
    input_data = "test"
    
    # Act
    result = service_fixture.method(input_data)
    
    # Assert
    assert result == expected_value
```

### Integration Tests
```python
@pytest.mark.skipif(
    not os.getenv("RUN_INTEGRATION_TESTS"),
    reason="Set RUN_INTEGRATION_TESTS=1 to run integration tests"
)
def test_real_service(self):
    """Integration test with real service"""
    # Test with actual external dependencies
```

## Common Test Commands

```bash
# Run all tests
uv run pytest

# Run tests with coverage
uv run pytest --cov=app

# Run specific test class
uv run pytest tests/services/test_s3.py::TestS3ServiceMocked -v

# Run tests matching pattern
uv run pytest -k "test_db" -v

# Run tests and stop on first failure
uv run pytest -x

# Run tests with detailed output
uv run pytest -v -s
```

## Debugging Tests

```bash
# Run with Python debugger
uv run pytest --pdb

# Show local variables on failure
uv run pytest -l

# Capture print statements
uv run pytest -s
```

## Test Data

### Fixtures Directory
- `create_test_images.py` - Utilities for generating test images
- Add other test data files as needed

### Database
- Tests use isolated transactions that rollback automatically
- Each test gets a fresh database state
- Use factory fixtures to create test data