"""
Redis client configuration and connection management
"""

import redis
from typing import Optional

from app.core.config import settings

# Global Redis client instance
_redis_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    """
    Get Redis client instance (singleton pattern)
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
    return _redis_client

