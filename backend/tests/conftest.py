"""
Shared test fixtures and configuration
"""

import pytest
import pytest_asyncio
from unittest.mock import Mock, patch
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import io
from PIL import Image

# Set up test configuration before importing app
import os

os.environ.update(
    {
        "SECRET_KEY": "test_secret_key_for_testing_only",
        # Use file-based SQLite so Celery task (separate connection) can see tables
        "DATABASE_URL": "sqlite:///./test.db",
        "REDIS_URL": "redis://localhost:6379/1",
        "AUTH0_DOMAIN": "test.auth0.com",
        "AUTH0_AUDIENCE": "test_audience",
        "STRIPE_SECRET_KEY": "sk_test_test_key",
        "STRIPE_WEBHOOK_SECRET": "whsec_test_secret",
        "RUNPOD_API_KEY": "test_runpod_key",
        "AWS_ACCESS_KEY_ID": "test_aws_key",
        "AWS_SECRET_ACCESS_KEY": "test_aws_secret",
        "S3_BUCKET": "test-bucket",
        "CLOUDFRONT_DOMAIN": "test.cloudfront.net",
    }
)

from app.main import app
from app.core.database import Base, get_db
from app.api.deps import get_current_user
from app.models.restoration import RestorationJob, JobStatus


# Test database setup
@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine with SQLite in-memory"""
    engine = create_engine("sqlite:///./test.db", echo=False)
    # Ensure a clean schema
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def test_db_session(test_engine):
    """Create test database session with transaction rollback"""
    connection = test_engine.connect()
    transaction = connection.begin()

    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=connection
    )
    session = TestingSessionLocal()

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def override_get_db(test_db_session):
    """Override database dependency"""

    def _get_test_db():
        yield test_db_session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    del app.dependency_overrides[get_db]


@pytest.fixture
def mock_user():
    """Mock authenticated user"""
    return "test_user_123"


@pytest.fixture
def override_get_current_user(mock_user):
    """Override authentication dependency"""

    def _get_test_user():
        return mock_user

    app.dependency_overrides[get_current_user] = _get_test_user
    yield
    del app.dependency_overrides[get_current_user]


@pytest.fixture
async def async_client(override_get_db, override_get_current_user):
    """Async test client with overridden dependencies"""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture
def test_image_bytes():
    """Create test image bytes for upload testing"""
    img = Image.new("RGB", (100, 100), color="red")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="JPEG")
    img_bytes.seek(0)
    return img_bytes.read()


@pytest.fixture
def test_large_image_bytes():
    """Create large payload (>50MB) deterministically for size limit testing"""
    # Use raw bytes to avoid compression variability
    return b"x" * (50 * 1024 * 1024 + 1)


@pytest.fixture
def restoration_job_factory(test_db_session, mock_user):
    """Factory for creating restoration jobs"""

    def _create_job(**kwargs):
        defaults = {
            "user_id": mock_user,
            "status": JobStatus.PENDING,
            "original_image_url": "https://test.cloudfront.net/original/test.jpg",
            "denoise": 0.7,
        }
        defaults.update(kwargs)
        job = RestorationJob(**defaults)
        test_db_session.add(job)
        test_db_session.commit()
        test_db_session.refresh(job)
        return job

    return _create_job


@pytest.fixture
def mock_s3_service():
    """Mock S3 service"""
    with patch("app.services.s3.s3_service") as mock:
        mock.upload_image.return_value = (
            "https://test.cloudfront.net/processed/test.jpg"
        )
        mock.download_file.return_value = b"fake_image_data"
        yield mock


@pytest.fixture
def mock_celery_task():
    """Mock Celery task"""
    with patch("app.workers.tasks.restoration.process_restoration") as mock:
        mock.delay.return_value = Mock(id="test_task_id")
        yield mock


@pytest.fixture(scope="session")
def celery_config():
    """Celery configuration for testing"""
    return {
        "broker_url": "memory://",
        "result_backend": "cache+memory://",
        "task_always_eager": True,
        "task_eager_propagates": True,
    }


@pytest.fixture
def celery_app(celery_config):
    """Celery app fixture for testing"""
    from app.workers.celery_app import celery_app

    celery_app.config_from_object(celery_config)
    return celery_app


# Force anyio to use asyncio backend only (no trio dependency required)
@pytest.fixture
def anyio_backend():
    return "asyncio"
