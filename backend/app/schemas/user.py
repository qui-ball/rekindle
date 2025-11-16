"""
Pydantic schemas for user operations.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, constr, Field, field_validator, ConfigDict

from app.models.user import UserTier, SubscriptionStatus, AccountStatus


class UserBase(BaseModel):
    supabase_user_id: str = Field(..., description="Supabase Auth user identifier (sub).")
    email: EmailStr = Field(..., description="Verified email address for the user.")
    email_verified: bool = Field(False, description="Whether the email has been verified.")

    first_name: Optional[constr(min_length=1, max_length=100)] = None
    last_name: Optional[constr(min_length=1, max_length=100)] = None
    profile_image_url: Optional[str] = None

    subscription_tier: UserTier = Field("free", description="Current subscription tier.")
    subscription_status: SubscriptionStatus = Field("active", description="Subscription billing status.")
    monthly_credits: int = Field(3, ge=0, description="Allocated monthly credits.")
    topup_credits: int = Field(0, ge=0, description="Additional purchased credits.")

    storage_used_bytes: int = Field(0, ge=0, description="Current storage usage in bytes.")
    storage_limit_bytes: int = Field(0, ge=0, description="Maximum allowed storage in bytes.")

    account_status: AccountStatus = Field("active", description="Overall account status.")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "supabase_user_id": "a0f1a6e6-1234-5678-9abc-def012345678",
                "email": "jane.doe@example.com",
                "email_verified": True,
                "first_name": "Jane",
                "last_name": "Doe",
                "profile_image_url": "https://cdn.example.com/avatars/jane.jpg",
                "subscription_tier": "remember",
                "subscription_status": "active",
                "monthly_credits": 25,
                "topup_credits": 10,
                "storage_used_bytes": 52428800,
                "storage_limit_bytes": 5368709120,
                "account_status": "active",
            }
        },
    )

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            return None
        # Validate name format: letters, spaces, hyphens, and apostrophes only
        if not re.match(r"^[a-zA-Z\s'-]+$", value):
            raise ValueError(
                "Name can only contain letters, spaces, hyphens, and apostrophes"
            )
        return value


class UserSyncRequest(UserBase):
    """
    Payload received from Supabase webhooks or onboarding flow.
    """

    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_period_start: Optional[datetime] = None
    subscription_period_end: Optional[datetime] = None

    @field_validator("supabase_user_id")
    @classmethod
    def validate_supabase_user_id(cls, v: str) -> str:
        """
        Validate supabase_user_id is a valid UUID format.
        
        Supabase user IDs are UUIDs, so we validate the format here.
        """
        import uuid
        try:
            uuid.UUID(v)
        except ValueError:
            raise ValueError(
                f"supabase_user_id must be a valid UUID format, got: {v}"
            )
        return v


class UserUpdateRequest(BaseModel):
    """
    Allow limited profile updates.
    """

    first_name: Optional[constr(min_length=1, max_length=100)] = None
    last_name: Optional[constr(min_length=1, max_length=100)] = None
    profile_image_url: Optional[str] = None

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            return None
        # Validate name format: letters, spaces, hyphens, and apostrophes only
        if not re.match(r"^[a-zA-Z\s'-]+$", value):
            raise ValueError(
                "Name can only contain letters, spaces, hyphens, and apostrophes"
            )
        return value

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "first_name": "Jane",
                "last_name": "Doe",
                "profile_image_url": "https://cdn.example.com/avatars/jane.jpg",
            }
        },
    )


class UserResponse(UserBase):
    """
    Full payload returned from API responses.
    """

    id: str
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    subscription_period_start: Optional[datetime] = None
    subscription_period_end: Optional[datetime] = None
    deletion_requested_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    total_credits: int
    full_name: str
    storage_limit_gb: float
    storage_used_gb: float
    storage_percentage: float

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "27e9ac12-1234-5678-8123-456789abcdef",
                "supabase_user_id": "a0f1a6e6-1234-5678-9abc-def012345678",
                "email": "jane.doe@example.com",
                "email_verified": True,
                "first_name": "Jane",
                "last_name": "Doe",
                "profile_image_url": "https://cdn.example.com/avatars/jane.jpg",
                "subscription_tier": "remember",
                "subscription_status": "active",
                "monthly_credits": 25,
                "topup_credits": 10,
                "subscription_period_start": "2025-10-01T00:00:00Z",
                "subscription_period_end": "2025-11-01T00:00:00Z",
                "storage_used_bytes": 52428800,
                "storage_limit_bytes": 5368709120,
                "storage_used_gb": 0.05,
                "storage_limit_gb": 5.0,
                "storage_percentage": 0.98,
                "total_credits": 35,
                "account_status": "active",
                "deletion_requested_at": None,
                "created_at": "2025-10-15T12:34:56Z",
                "updated_at": "2025-10-20T08:00:00Z",
                "last_login_at": "2025-10-20T08:00:00Z",
            }
        },
    )

