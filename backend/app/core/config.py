"""
Application configuration settings
"""

from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field, ConfigDict
import pydantic


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=True)

    # API
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = Field(..., description="Secret key for JWT")
    BACKEND_BASE_URL: str = Field(
        ..., description="Backend base URL for webhooks (e.g., https://api.example.com)"
    )

    # Database
    DATABASE_URL: str = Field(..., description="PostgreSQL database URL")

    # Redis
    REDIS_URL: str = Field(..., description="Redis URL for job queue")

    # Supabase
    SUPABASE_URL: str = Field(..., description="Supabase project URL")
    SUPABASE_ANON_KEY: str = Field(..., description="Supabase anonymous key")
    SUPABASE_SERVICE_KEY: str = Field(..., description="Supabase service role key")

    # Cross-Device Authentication
    XDEVICE_JWT_SECRET: str = Field(
        ..., 
        description="Secret key for signing cross-device temporary JWTs (HS256, 32+ bytes)",
        min_length=32,
    )
    
    @pydantic.field_validator("XDEVICE_JWT_SECRET", mode="before")
    @classmethod
    def validate_xdevice_jwt_secret(cls, v: str) -> str:
        """Validate XDEVICE_JWT_SECRET is at least 32 bytes"""
        if len(v.encode("utf-8")) < 32:
            raise ValueError(
                "XDEVICE_JWT_SECRET must be at least 32 bytes (characters) long for security. "
                "Generate a secure random secret using: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
        return v

    # Stripe
    STRIPE_SECRET_KEY: str = Field(..., description="Stripe secret key")
    STRIPE_WEBHOOK_SECRET: str = Field(..., description="Stripe webhook secret")

    # RunPod
    RUNPOD_API_KEY: str = Field(..., description="RunPod API key")
    RUNPOD_S3_ACCESS_KEY: str = Field(
        default="", description="RunPod network volume S3 access key"
    )
    RUNPOD_S3_SECRET_KEY: str = Field(
        default="", description="RunPod network volume S3 secret key"
    )

    # RunPod Serverless
    RUNPOD_ENDPOINT_ID: str = Field(
        default="", description="RunPod serverless endpoint ID"
    )
    RUNPOD_NETWORK_VOLUME_ID: str = Field(
        default="366etpkt4g", description="RunPod network volume ID"
    )
    RUNPOD_S3_ENDPOINT: str = Field(
        default="https://s3api-eu-cz-1.runpod.io/",
        description="RunPod S3 API endpoint URL",
    )
    RUNPOD_S3_REGION: str = Field(
        default="eu-cz-1", description="RunPod network volume region"
    )

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
            "http://192.168.2.11:3000",  # Mobile device access (HTTP fallback)
        ]
    )
    ALLOWED_HOSTS: List[str] = Field(
        default=[
            "localhost",
            "127.0.0.1",
            "test",
            "192.168.2.11",
            "backend",
            "frontend",
            "*.ngrok-free.app",  # Allow ngrok tunnels for webhook development
            ".ngrok-free.app",  # Alternative pattern
        ]
    )

    # ComfyUI
    COMFYUI_URL: str = Field(
        default="http://127.0.0.1:8188", description="ComfyUI server URL"
    )
    COMFYUI_MODE: str = Field(
        default="serverless",
        description="ComfyUI execution mode: 'serverless' or 'pod'",
    )

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
