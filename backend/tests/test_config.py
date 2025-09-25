"""
Test configuration settings
"""

from app.core.config import Settings


class TestSettings(Settings):
    """Test settings with default values"""

    # Override required fields with test defaults
    SECRET_KEY: str = "test_secret_key_for_testing_only"
    DATABASE_URL: str = "sqlite:///:memory:"
    REDIS_URL: str = "redis://localhost:6379/1"
    AUTH0_DOMAIN: str = "test.auth0.com"
    AUTH0_AUDIENCE: str = "test_audience"
    STRIPE_SECRET_KEY: str = "sk_test_test_key"
    STRIPE_WEBHOOK_SECRET: str = "whsec_test_secret"
    RUNPOD_API_KEY: str = "test_runpod_key"
    AWS_ACCESS_KEY_ID: str = "test_aws_key"
    AWS_SECRET_ACCESS_KEY: str = "test_aws_secret"
    S3_BUCKET: str = "test-bucket"
    CLOUDFRONT_DOMAIN: str = "test.cloudfront.net"

    model_config = {"env_file": None}  # Don't load from .env in tests
