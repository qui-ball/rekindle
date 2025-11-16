"""
API dependencies for authentication and database
"""

import logging
from datetime import datetime
from typing import Optional
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from jose.constants import ALGORITHMS
from sqlalchemy.orm import Session
import httpx

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.services.cross_device_session_service import CrossDeviceSessionService

logger = logging.getLogger(__name__)
security = HTTPBearer()

# Cache for JWKS keys (refreshed periodically)
_jwks_cache: Optional[dict] = None
_jwks_cache_time: Optional[datetime] = None
JWKS_CACHE_TTL = 3600  # 1 hour


@lru_cache(maxsize=1)
def get_supabase_jwks_url() -> str:
    """Get Supabase JWKS URL from project URL"""
    base_url = settings.SUPABASE_URL.rstrip("/")
    return f"{base_url}/.well-known/jwks.json"


def fetch_supabase_jwks() -> dict:
    """
    Fetch JWKS from Supabase with caching.
    
    Returns:
        JWKS dictionary with keys
    """
    global _jwks_cache, _jwks_cache_time
    
    # Check cache validity
    if _jwks_cache and _jwks_cache_time:
        age = (datetime.utcnow() - _jwks_cache_time).total_seconds()
        if age < JWKS_CACHE_TTL:
            return _jwks_cache
    
    try:
        jwks_url = get_supabase_jwks_url()
        logger.debug(f"Fetching JWKS from {jwks_url}")
        
        with httpx.Client(timeout=5.0) as client:
            response = client.get(jwks_url)
            response.raise_for_status()
            jwks = response.json()
            
            _jwks_cache = jwks
            _jwks_cache_time = datetime.utcnow()
            
            logger.debug(f"JWKS fetched successfully, {len(jwks.get('keys', []))} keys")
            return jwks
            
    except httpx.RequestError as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        # Return cached JWKS if available, even if expired
        if _jwks_cache:
            logger.warning("Using expired JWKS cache due to fetch failure")
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error fetching JWKS: {e}")
        if _jwks_cache:
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )


def verify_supabase_token(token: str) -> dict:
    """
    Verify Supabase JWT token using JWKS.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid
    """
    try:
        # Fetch JWKS
        try:
            jwks = fetch_supabase_jwks()
        except HTTPException:
            # Propagate HTTPException from fetch_supabase_jwks (e.g., service unavailable)
            raise
        
        # Get unverified header to find key ID
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        
        if not kid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing key ID"
            )
        
        # Find the key in JWKS
        key = None
        for jwk in jwks.get("keys", []):
            if jwk.get("kid") == kid:
                key = jwk
                break
        
        if not key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token key not found in JWKS"
            )
        
        # Verify and decode token
        payload = jwt.decode(
            token,
            key,
            algorithms=[ALGORITHMS.RS256],
            audience="authenticated",  # Supabase default audience
        )
        
        # Verify issuer matches Supabase
        iss = payload.get("iss")
        if not iss or not iss.startswith(settings.SUPABASE_URL.rstrip("/")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer"
            )
        
        return payload
        
    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except JWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


def _fetch_user_by_identifier(
    db: Session,
    identifier: str,
    is_supabase: bool,
    iss: str
) -> Optional[User]:
    """
    Helper function to fetch user by identifier (supabase_user_id or id).
    
    Args:
        db: Database session
        identifier: User identifier (supabase_user_id for Supabase, id for cross-device)
        is_supabase: True if Supabase token, False if cross-device token
        iss: Token issuer (for logging)
        
    Returns:
        User object if found, None otherwise
    """
    if is_supabase:
        return db.query(User).filter(User.supabase_user_id == identifier).first()
    else:
        return db.query(User).filter(User.id == identifier).first()


def verify_cross_device_token(token: str) -> dict:
    """
    Verify cross-device temporary JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid or session expired
    """
    try:
        # Verify signature with XDEVICE_JWT_SECRET
        payload = jwt.decode(
            token,
            settings.XDEVICE_JWT_SECRET,
            algorithms=[ALGORITHMS.HS256],
        )
        
        # Verify issuer
        iss = payload.get("iss")
        if iss != "rekindle:xdevice":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid cross-device token issuer"
            )
        
        # Get session ID from token
        session_id = payload.get("sid")
        if not session_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing session id"
            )
        
        # Load session from Redis
        session = CrossDeviceSessionService.get_active_session(session_id)
        if not session:
            logger.warning(f"Cross-device session {session_id} not found or inactive")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or revoked"
            )
        
        # Double-check session status (defense in depth)
        session_status = session.get("status")
        if session_status != "active":
            logger.warning(f"Cross-device session {session_id} is not active (status: {session_status})")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or revoked"
            )
        
        # Check if session is expired (defense in depth)
        expires_at_str = session.get("expires_at")
        if expires_at_str:
            try:
                from datetime import datetime
                expires_at = datetime.fromisoformat(expires_at_str)
                if datetime.utcnow() > expires_at:
                    logger.warning(f"Cross-device session {session_id} has expired")
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Session expired or revoked"
                    )
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid expires_at format for session {session_id}: {e}")
        
        # Verify user_id matches session
        user_id_from_token = payload.get("sub")
        user_id_from_session = session.get("user_id")
        
        if user_id_from_token != user_id_from_session:
            logger.warning(
                f"User ID mismatch: token={user_id_from_token}, session={user_id_from_session}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token user mismatch"
            )
        
        return payload
        
    except JWTError as e:
        logger.warning(f"Cross-device JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cross-device token"
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Supports two token types:
    1. Supabase tokens (iss = https://<project>.supabase.co) - verified via JWKS
    2. Cross-device tokens (iss = rekindle:xdevice) - verified via XDEVICE_JWT_SECRET
    
    Args:
        credentials: HTTP Bearer token credentials
        db: Database session
        
    Returns:
        User model instance
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    token = credentials.credentials
    
    # Validate token is not empty
    if not token or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty token"
        )
    
    try:
        # Decode token without verification to check issuer
        # We need to catch JWTError for malformed tokens
        try:
            # Use get_unverified_claims to decode without verification
            unverified_payload = jwt.get_unverified_claims(token)
        except JWTError as e:
            # Token is malformed or invalid
            logger.warning(f"Malformed JWT token: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format"
            )
        
        iss = unverified_payload.get("iss")
        
        # Route to appropriate verification based on issuer
        user_id = None
        supabase_user_id = None
        
        if iss == "rekindle:xdevice":
            # Cross-device token - get user_id from session (not from token sub)
            payload = verify_cross_device_token(token)
            session_id = payload.get("sid")
            session = CrossDeviceSessionService.get_active_session(session_id)
            if not session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session expired or revoked"
                )
            user_id = session.get("user_id")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session missing user ID"
                )
            # Fetch user by ID (UUID) for cross-device tokens
            user = _fetch_user_by_identifier(db, user_id, is_supabase=False, iss=iss)
        elif iss and iss.startswith(settings.SUPABASE_URL.rstrip("/")):
            # Supabase token - get supabase_user_id from token sub
            payload = verify_supabase_token(token)
            supabase_user_id = payload.get("sub")
            if not supabase_user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token missing user ID"
                )
            # Fetch user by supabase_user_id for Supabase tokens
            user = _fetch_user_by_identifier(db, supabase_user_id, is_supabase=True, iss=iss)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unknown token issuer: {iss}"
            )
        
        if not user:
            identifier = user_id if iss == "rekindle:xdevice" else supabase_user_id
            logger.warning(f"User not found for {iss} token with identifier: {identifier}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        # Check account status
        if user.account_status != "active":
            logger.warning(f"User {user.id} account status is {user.account_status}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {user.account_status}"
            )
        
        # Update last_login_at (only for Supabase tokens, not cross-device)
        if iss != "rekindle:xdevice":
            user.last_login_at = datetime.utcnow()
            db.commit()
        
        return user
        
    except HTTPException:
        raise
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        logger.error(f"Unexpected error in get_current_user: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error"
        )


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency that ensures user is authenticated and active.
    This is a convenience wrapper around get_current_user.
    """
    return current_user


def get_db_session() -> Session:
    """
    Get database session dependency
    """
    return Depends(get_db)
