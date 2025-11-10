"""
Application configuration settings
"""

from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field, ConfigDict


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

    # Supabase
    SUPABASE_URL: str = Field(..., description="Supabase project URL")
    SUPABASE_ANON_KEY: str = Field(..., description="Supabase anonymous key")
    SUPABASE_SERVICE_KEY: str = Field(..., description="Supabase service role key")

    # Stripe
    STRIPE_SECRET_KEY: str = Field(..., description="Stripe secret key")
    STRIPE_WEBHOOK_SECRET: str = Field(..., description="Stripe webhook secret")

    # RunPod
    RUNPOD_API_KEY: str = Field(..., description="RunPod API key")
    RUNPOD_S3_ACCESS_KEY: str = Field(default="", description="RunPod network volume S3 access key")
    RUNPOD_S3_SECRET_KEY: str = Field(default="", description="RunPod network volume S3 secret key")

    # AWS
    AWS_ACCESS_KEY_ID: str = Field(..., description="AWS access key")
    AWS_SECRET_ACCESS_KEY: str = Field(..., description="AWS secret key")
    AWS_REGION: str = Field(default="us-east-1")
    S3_BUCKET: str = Field(..., description="S3 bucket for file storage")

    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:3000", 
            "http://127.0.0.1:3000",
            "https://localhost:3000",
            "https://127.0.0.1:3000",
            "https://192.168.2.11:3000",  # Mobile device access
            "http://192.168.2.11:3000"   # Mobile device access (HTTP fallback)
        ]
    )
    ALLOWED_HOSTS: List[str] = Field(default=["localhost", "127.0.0.1", "test", "192.168.2.11", "backend", "frontend"])

    # ComfyUI
    COMFYUI_URL: str = Field(default="http://127.0.0.1:8188", description="ComfyUI server URL")

    # File upload
    MAX_FILE_SIZE: int = Field(default=50 * 1024 * 1024)  # 50MB
    ALLOWED_FILE_TYPES: List[str] = Field(
        default=["image/jpeg", "image/png", "image/heic", "image/webp"]
    )

    model_config = ConfigDict(
        env_file=".env", 
        case_sensitive=True,
        extra="ignore"  # Ignore extra fields like NEXT_PUBLIC_* that are for frontend
    )


# Global settings instance
settings = Settings()
