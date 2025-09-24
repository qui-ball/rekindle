"""
API dependencies for authentication and database
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """
    Get current user ID from JWT token
    """
    try:
        # Decode JWT token
        payload = jwt.decode(
            credentials.credentials,
            options={
                "verify_signature": False
            },  # Auth0 verification handled by middleware
        )

        # Get user ID from token (Auth0 'sub' field)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        return user_id

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


def get_db_session() -> Session:
    """
    Get database session dependency
    """
    return Depends(get_db)
