"""
SQLAlchemy model for audit logs (compliance and security tracking)
"""

from __future__ import annotations

import uuid
from sqlalchemy import Column, DateTime, JSON, String
from sqlalchemy.sql import func

from app.core.database import Base
from app.core.types import GUID


class AuditLog(Base):
    """Audit log for tracking user actions and compliance events"""

    __tablename__ = "audit_logs"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), nullable=True, index=True)  # Nullable for system events
    action = Column(String(50), nullable=False, index=True)  # e.g., 'data_export', 'account_deletion_requested'
    ip_address = Column(String(45), nullable=True)  # IPv4 or IPv6
    user_agent = Column(String(500), nullable=True)
    metadata_json = Column(JSON, nullable=True)  # Additional context (counts, sizes, etc.)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    def __repr__(self):
        return f"<AuditLog {self.action} user={self.user_id} at {self.created_at}>"

