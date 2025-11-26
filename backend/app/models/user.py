"""
SQLAlchemy model for application users.
"""

from __future__ import annotations

from typing import Optional, Literal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Integer,
    String,
)
from sqlalchemy.sql import func
import uuid

from app.core.database import Base
from app.core.types import GUID

UserTier = Literal["free", "remember", "cherish", "forever"]
SubscriptionStatus = Literal["active", "cancelled", "past_due", "paused"]
AccountStatus = Literal["active", "suspended", "deleted", "archived"]


class User(Base):
    """User account model"""

    __tablename__ = "users"

    # Core identity
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    supabase_user_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    email_verified = Column(Boolean, default=False, nullable=False)

    # Profile
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    profile_image_url = Column(String, nullable=True)

    # Subscription & credits
    subscription_tier = Column(String(20), default="free", nullable=False, index=True)
    monthly_credits = Column(Integer, default=3, nullable=False)
    topup_credits = Column(Integer, default=0, nullable=False)
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    subscription_status = Column(String(20), default="active", nullable=False)
    subscription_period_start = Column(DateTime(timezone=True), nullable=True)
    subscription_period_end = Column(DateTime(timezone=True), nullable=True)

    # Storage
    storage_used_bytes = Column(BigInteger, default=0, nullable=False)
    storage_limit_bytes = Column(BigInteger, default=0, nullable=False)

    # Account status
    account_status = Column(String(20), default="active", nullable=False)
    deletion_requested_at = Column(DateTime(timezone=True), nullable=True)
    deletion_task_id = Column(String(255), nullable=True, index=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            subscription_tier.in_(["free", "remember", "cherish", "forever"]),
            name="valid_subscription_tier",
        ),
        CheckConstraint(
            account_status.in_(["active", "suspended", "deleted", "archived"]),
            name="valid_account_status",
        ),
        CheckConstraint(
            subscription_status.in_(["active", "cancelled", "past_due", "paused"]),
            name="valid_subscription_status",
        ),
    )

    @property
    def total_credits(self) -> int:
        """Total available credits."""
        monthly = self.monthly_credits or 0
        topup = self.topup_credits or 0
        return monthly + topup

    @property
    def full_name(self) -> str:
        """Concatenate first and last names, or fall back to email prefix."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        if self.first_name:
            return self.first_name
        if self.last_name:
            return self.last_name
        return self.email.split("@")[0]

    @property
    def storage_limit_gb(self) -> float:
        """Storage limit expressed in gigabytes."""
        return float(self.storage_limit_bytes) / (1024 ** 3) if self.storage_limit_bytes else 0.0

    @property
    def storage_used_gb(self) -> float:
        """Storage used expressed in gigabytes."""
        return float(self.storage_used_bytes) / (1024 ** 3) if self.storage_used_bytes else 0.0

    @property
    def storage_percentage(self) -> float:
        """Percentage of storage used."""
        if not self.storage_limit_bytes:
            return 0.0
        return (self.storage_used_bytes / self.storage_limit_bytes) * 100

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.subscription_tier})>"

