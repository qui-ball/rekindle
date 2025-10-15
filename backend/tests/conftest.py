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

# Only override env vars if not running integration tests
# Integration tests need to use real environment variables
if not os.getenv("RUN_INTEGRATION_TESTS"):
    os.environ.update(
        {
            "SECRET_KEY": "test_secret_key_for_testing_only",
            # Use in-memory SQLite for tests
            "DATABASE_URL": "sqlite:///:memory:",
            "REDIS_URL": "redis://localhost:6379/1",
            "AUTH0_DOMAIN": "test.auth0.com",
            "AUTH0_AUDIENCE": "test_audience",
            "STRIPE_SECRET_KEY": "sk_test_test_key",
            "STRIPE_WEBHOOK_SECRET": "whsec_test_secret",
            "RUNPOD_API_KEY": "test_runpod_key",
            "AWS_ACCESS_KEY_ID": "test_aws_key",
            "AWS_SECRET_ACCESS_KEY": "test_aws_secret",
            "AWS_REGION": "us-east-2",
            "S3_BUCKET": "rekindle-media",
        }
    )
else:
    # For integration tests, we still need some test values for non-AWS settings
    # that aren't in the .env file. DATABASE_URL should come from environment.
    test_env = {
        "SECRET_KEY": "test_secret_key_for_testing_only",
        "REDIS_URL": "redis://localhost:6379/1",
        "AUTH0_DOMAIN": "test.auth0.com",
        "AUTH0_AUDIENCE": "test_audience",
        "STRIPE_SECRET_KEY": "sk_test_test_key",
        "STRIPE_WEBHOOK_SECRET": "whsec_test_secret",
        "RUNPOD_API_KEY": "test_runpod_key",
    }
    # Only set test values for keys that aren't already in environment
    for key, value in test_env.items():
        if key not in os.environ:
            os.environ[key] = value

from app.main import app
from app.core.database import Base, get_db
from app.api.deps import get_current_user
from app.models.jobs import Job, RestoreAttempt, AnimationAttempt


# Test database setup
@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine with PostgreSQL"""
    from app.core.config import settings
    engine = create_engine(settings.DATABASE_URL, echo=False)
    # Ensure a clean schema for tests
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
def job_factory(test_db_session):
    """Factory for creating jobs"""
    
    def _create_job(**kwargs):
        defaults = {
            "email": "test@example.com",
        }
        defaults.update(kwargs)
        job = Job(**defaults)
        test_db_session.add(job)
        test_db_session.commit()
        test_db_session.refresh(job)
        return job
    
    return _create_job


@pytest.fixture  
def restore_attempt_factory(test_db_session):
    """Factory for creating restore attempts"""
    
    def _create_restore(**kwargs):
        defaults = {
            "s3_key": "uploaded/test-job.jpg",
            "model": "test_model",
            "params": {"denoise": 0.7},
        }
        defaults.update(kwargs)
        restore = RestoreAttempt(**defaults)
        test_db_session.add(restore)
        test_db_session.commit()
        test_db_session.refresh(restore)
        return restore
    
    return _create_restore


@pytest.fixture
def animation_attempt_factory(test_db_session):
    """Factory for creating animation attempts"""
    
    def _create_animation(**kwargs):
        defaults = {
            "preview_s3_key": "animated/test-job/test-anim_preview.mp4",
            "model": "test_model",
            "params": {"fps": 30},
        }
        defaults.update(kwargs)
        animation = AnimationAttempt(**defaults)
        test_db_session.add(animation)
        test_db_session.commit()
        test_db_session.refresh(animation)
        return animation
    
    return _create_animation


# Legacy restoration_job_factory removed - use job_factory instead


@pytest.fixture
def mock_s3_service():
    """Mock S3 service"""
    with patch("app.services.s3.s3_service") as mock:
        mock.upload_image.return_value = (
            "https://test-bucket.s3.us-east-1.amazonaws.com/uploaded/test.jpg"
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
