"""
Cross-device session management service for Redis-backed temporary sessions.

This service manages QR tokens and temporary cross-device sessions used for
mobile-to-desktop photo uploads with biometric authentication.

Note: This is a minimal implementation for Task 3.4a. Full implementation
will be completed in Task 5.1a.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import json
import logging

from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)


class CrossDeviceSessionService:
    """
    Service for managing cross-device sessions in Redis.
    
    Redis key schema:
    - qr_token:{token} -> JSON with desktop_user_id, issued_at, expires_at, status
    - xdevice_session:{session_id} -> JSON with user_id, desktop_user_id, token, 
                                       temporary_jwt_id, issued_at, expires_at, 
                                       last_seen_at, status, mobile_device
    """

    QR_TOKEN_TTL = 300  # 5 minutes
    SESSION_TTL = 3600  # 60 minutes

    @staticmethod
    def _get_qr_token_key(token: str) -> str:
        """Get Redis key for QR token"""
        return f"qr_token:{token}"

    @staticmethod
    def _get_session_key(session_id: str) -> str:
        """Get Redis key for cross-device session"""
        return f"xdevice_session:{session_id}"

    @staticmethod
    def get_active_session(session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get an active cross-device session from Redis.
        
        Args:
            session_id: The session ID (sid from JWT)
            
        Returns:
            Session data dict if found and active, None otherwise
        """
        redis_client = get_redis()
        key = CrossDeviceSessionService._get_session_key(session_id)
        
        try:
            data = redis_client.get(key)
            if not data:
                logger.debug(f"Session {session_id} not found in Redis")
                return None
            
            session = json.loads(data)
            
            # Check if session is active
            if session.get("status") != "active":
                logger.debug(f"Session {session_id} is not active (status: {session.get('status')})")
                return None
            
            # Check if session is expired
            expires_at_str = session.get("expires_at")
            if expires_at_str:
                expires_at = datetime.fromisoformat(expires_at_str)
                if datetime.now(timezone.utc) > expires_at:
                    logger.debug(f"Session {session_id} has expired")
                    return None
            
            return session
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode session data for {session_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error retrieving session {session_id}: {e}")
            return None

    @staticmethod
    def consume_session(session_id: str) -> bool:
        """
        Mark a session as consumed (after successful upload).
        
        Args:
            session_id: The session ID to consume
            
        Returns:
            True if session was consumed, False otherwise
        """
        redis_client = get_redis()
        key = CrossDeviceSessionService._get_session_key(session_id)
        
        try:
            data = redis_client.get(key)
            if not data:
                return False
            
            session = json.loads(data)
            session["status"] = "consumed"
            session["consumed_at"] = datetime.now(timezone.utc).isoformat()
            
            redis_client.setex(
                key,
                CrossDeviceSessionService.SESSION_TTL,
                json.dumps(session)
            )
            
            logger.info(f"Session {session_id} marked as consumed")
            return True
            
        except Exception as e:
            logger.error(f"Error consuming session {session_id}: {e}")
            return False

