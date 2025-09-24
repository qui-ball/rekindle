"""
Application configuration settings
"""

from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=True)

    # API
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = Field(..., description="Secret key for JWT")

    # Database
    DATABASE_URL: str = Field(..., description="PostgreSQL database URL")

    # Redis
    REDIS_URL: str = Field(..., description="Redis URL for job queue")

    # Auth0
    AUTH0_DOMAIN: str = Field(..., description="Auth0 domain")
    AUTH0_AUDIENCE: str = Field(..., description="Auth0 API audience")

    # Stripe
    STRIPE_SECRET_KEY: str = Field(..., description="Stripe secret key")
    STRIPE_WEBHOOK_SECRET: str = Field(..., description="Stripe webhook secret")

    # RunPod
    RUNPOD_API_KEY: str = Field(..., description="RunPod API key")

    # AWS
    AWS_ACCESS_KEY_ID: str = Field(..., description="AWS access key")
    AWS_SECRET_ACCESS_KEY: str = Field(..., description="AWS secret key")
    AWS_REGION: str = Field(default="us-east-1")
    S3_BUCKET: str = Field(..., description="S3 bucket for file storage")
    CLOUDFRONT_DOMAIN: str = Field(..., description="CloudFront domain")

    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    ALLOWED_HOSTS: List[str] = Field(default=["localhost", "127.0.0.1"])

    # File upload
    MAX_FILE_SIZE: int = Field(default=50 * 1024 * 1024)  # 50MB
    ALLOWED_FILE_TYPES: List[str] = Field(
        default=["image/jpeg", "image/png", "image/heic", "image/webp"]
    )

    model_config = {"env_file": ".env", "case_sensitive": True}


# Global settings instance
settings = Settings()
