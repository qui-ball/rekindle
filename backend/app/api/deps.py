"""
API dependencies for authentication and database
"""

from datetime import datetime, timezone
from typing import Optional, Dict
from functools import lru_cache

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from jose.constants import ALGORITHMS
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import httpx
from loguru import logger

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserTier
from app.services.cross_device_session_service import CrossDeviceSessionService

# HTTPBearer with auto_error=False so we can handle missing tokens ourselves
# This allows us to return 401 instead of 403 when token is missing
security = HTTPBearer(auto_error=False)

# Cache for JWKS keys (refreshed periodically)
_jwks_cache: Optional[dict] = None
_jwks_cache_time: Optional[datetime] = None
JWKS_CACHE_TTL = 3600  # 1 hour


@lru_cache(maxsize=1)
def get_supabase_jwks_url() -> str:
    """Get Supabase JWKS URL from project URL"""
    base_url = settings.SUPABASE_URL.rstrip("/")
    return f"{base_url}/auth/v1/.well-known/jwks.json"


def fetch_supabase_jwks() -> dict:
    """
    Fetch JWKS from Supabase with caching.
    
    Returns:
        JWKS dictionary with keys
    """
    global _jwks_cache, _jwks_cache_time
    
    # Check cache validity
    if _jwks_cache and _jwks_cache_time:
        age = (datetime.now(timezone.utc) - _jwks_cache_time).total_seconds()
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
            _jwks_cache_time = datetime.now(timezone.utc)
            
            logger.debug(f"JWKS fetched successfully, {len(jwks.get('keys', []))} keys")
            return jwks
            
    except httpx.RequestError as e:
        logger.error(
            "Failed to fetch JWKS",
            extra={
                "event_type": "jwks_fetch_error",
                "error": str(e),
                "jwks_url": get_supabase_jwks_url(),
            }
        )
        # Return cached JWKS if available, even if expired
        if _jwks_cache:
            logger.warning(
                "Using expired JWKS cache due to fetch failure",
                extra={"event_type": "jwks_cache_fallback"}
            )
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )
    except Exception as e:
        logger.error(
            "Unexpected error fetching JWKS",
            extra={
                "event_type": "jwks_fetch_error",
                "error": str(e),
                "jwks_url": get_supabase_jwks_url(),
            }
        )
        if _jwks_cache:
            return _jwks_cache
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )


def is_supabase_issuer(issuer: str, supabase_url: str) -> bool:
    """
    Check if issuer is from the same Supabase instance.
    Accepts both external (localhost:54321) and internal (container:8000) URLs.
    """
    # Normalize URLs for comparison
    def normalize_host(url: str) -> str:
        url = url.replace("host.docker.internal", "localhost")
        url = url.replace("127.0.0.1", "localhost")
        return url
    
    normalized_iss = normalize_host(issuer)
    normalized_supabase = normalize_host(supabase_url.rstrip("/"))
    
    # Check if issuer matches the configured Supabase URL
    if normalized_iss.startswith(normalized_supabase):
        return True
    
    # Also accept external Supabase URLs (localhost:54321) even if backend uses internal URL
    # This handles tokens issued by Supabase via external port
    if "localhost:54321" in normalized_iss or "127.0.0.1:54321" in issuer:
        # Extract base URL from issuer (remove /auth/v1 suffix)
        base_iss = normalized_iss.split("/auth/v1")[0] if "/auth/v1" in normalized_iss else normalized_iss
        # Check if it's a valid Supabase URL pattern
        if base_iss.startswith("http://localhost:54321") or base_iss.startswith("http://127.0.0.1:54321"):
            return True
    
    return False


def verify_supabase_token(token: str) -> dict:
    """
    Verify Supabase JWT token using JWKS (RS256 for production) or anon key (HS256 for local dev).
    
    For local Supabase development, if JWKS is empty, attempts to decode
    token without verification to check issuer, then uses service key for verification.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid
    """
    try:
        # Validate token is not empty
        if not token or not token.strip():
            logger.warning("Empty or None token received")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Empty token"
            )
        
        logger.debug(
            "Verifying Supabase token",
            extra={
                "token_length": len(token),
                "token_starts_with": token[:20] if len(token) >= 20 else token,
            }
        )
        
        # Get unverified header first to check token format and algorithm
        try:
            unverified_header = jwt.get_unverified_header(token)
        except JWTError as e:
            logger.warning(
                "Failed to parse JWT header",
                extra={
                    "event_type": "jwt_header_parse_error",
                    "error": str(e),
                    "token_preview": token[:50] if len(token) > 50 else token,
                }
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token format"
            )
        
        # Get algorithm and key ID from header
        alg = unverified_header.get("alg")
        kid = unverified_header.get("kid")
        
        logger.info(f"Token algorithm: {alg}, kid: {kid}")
        
        # Try to decode without verification to check issuer (for debugging/fallback)
        # Note: jose library requires a key parameter even when verify_signature=False
        unverified_iss = ""
        try:
            unverified_payload = jwt.decode(
                token, 
                "",  # Dummy key - not used since verify_signature=False
                options={
                    "verify_signature": False,
                    "verify_aud": False,  # Don't verify audience when decoding without verification
                }
            )
            unverified_iss = unverified_payload.get("iss", "")
            logger.debug(
                "Decoded token without verification",
                extra={
                    "issuer": unverified_iss,
                    "has_kid": "kid" in unverified_header,
                }
            )
        except JWTError as e:
            # Token is completely malformed
            token_preview = token[:100] if len(token) > 100 else token
            logger.warning(
                "JWT decode error (token malformed)",
                extra={
                    "event_type": "jwt_decode_error",
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "token_length": len(token) if token else 0,
                    "token_preview": token_preview,
                }
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token format: {str(e)}"
            )
        except Exception as e:
            # Unexpected error during decode - log and re-raise as HTTPException
            token_preview = token[:100] if len(token) > 100 else token
            logger.warning(
                "Unexpected error decoding token without verification",
                extra={
                    "event_type": "token_decode_unexpected_error",
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "token_length": len(token) if token else 0,
                    "token_preview": token_preview,
                    "token_starts_with": token[:20] if token and len(token) >= 20 else token,
                }
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token format: {type(e).__name__}: {str(e)}"
            )
        
        # Handle HS256 tokens (local Supabase development)
        if alg == "HS256":
            logger.info("Detected HS256 token (likely local Supabase), attempting verification")
            logger.debug(f"Anon key length: {len(settings.SUPABASE_ANON_KEY)}, preview: {settings.SUPABASE_ANON_KEY[:20]}...")
            
            # For local Supabase, try multiple keys:
            # 1. JWT secret (if explicitly configured)
            # 2. Anon key (most common for local Supabase)
            # 3. Service key (sometimes used for signing)
            keys_to_try = []
            if settings.SUPABASE_JWT_SECRET:
                keys_to_try.append(("jwt_secret", settings.SUPABASE_JWT_SECRET))
            keys_to_try.extend([
                ("anon_key", settings.SUPABASE_ANON_KEY),
                ("service_key", settings.SUPABASE_SERVICE_KEY),
            ])
            
            last_error = None
            for key_name, key_value in keys_to_try:
                try:
                    logger.info(f"Trying HS256 verification with {key_name}")
                    # Try with audience check first
                    try:
                        payload = jwt.decode(
                            token,
                            key_value,
                            algorithms=[ALGORITHMS.HS256],
                            audience="authenticated",
                            options={"verify_aud": True}
                        )
                        logger.info(f"HS256 verification succeeded with {key_name} (with audience check)")
                        break
                    except JWTError as aud_error:
                        logger.debug(f"HS256 verification with {key_name} and audience check failed: {aud_error}, trying without audience check")
                        # Try without audience verification (local Supabase might not set audience)
                        payload = jwt.decode(
                            token,
                            key_value,
                            algorithms=[ALGORITHMS.HS256],
                            options={"verify_aud": False}
                        )
                        logger.info(f"HS256 verification succeeded with {key_name} (without audience check)")
                        break
                except JWTError as e:
                    logger.debug(f"HS256 verification with {key_name} failed: {e}")
                    last_error = e
                    continue
            
            # If all keys failed, raise error with helpful message
            if 'payload' not in locals():
                logger.error(f"HS256 token verification failed with all keys. Last error: {last_error}")
                logger.error(f"Tried keys: JWT_SECRET={'set' if settings.SUPABASE_JWT_SECRET else 'not set'}, anon_key length={len(settings.SUPABASE_ANON_KEY)}, service_key length={len(settings.SUPABASE_SERVICE_KEY)}")
                # Try to decode without verification to get issuer info for debugging
                try:
                    unverified_payload = jwt.decode(
                        token,
                        key=settings.SUPABASE_ANON_KEY,
                        options={"verify_signature": False, "verify_aud": False, "verify_exp": False}
                    )
                    logger.error(f"Token issuer: {unverified_payload.get('iss')}, sub: {unverified_payload.get('sub')}")
                except:
                    pass
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"HS256 token verification failed: Signature verification failed. For local Supabase, ensure SUPABASE_ANON_KEY matches the 'Publishable key' from 'supabase status'. You can also set SUPABASE_JWT_SECRET if your JWT secret differs."
                )
            
            # Verify issuer matches Supabase (more flexible for local dev)
            iss = payload.get("iss")
            supabase_url_normalized = settings.SUPABASE_URL.rstrip("/")
            # For local Supabase, issuer might be different format, so check if it contains the URL
            if not iss:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token missing issuer"
                )
            # Normalize URLs for comparison (handle localhost/127.0.0.1/host.docker.internal)
            def normalize_url(url: str) -> str:
                """Normalize URL by converting 127.0.0.1 and host.docker.internal to localhost for comparison"""
                url = url.replace("host.docker.internal", "localhost")
                url = url.replace("127.0.0.1", "localhost")
                return url
            
            normalized_iss = normalize_url(iss)
            normalized_supabase = normalize_url(supabase_url_normalized)
            
            # Check if issuer matches Supabase URL (exact match or contains for local dev)
            if not (normalized_iss == normalized_supabase or normalized_iss.startswith(normalized_supabase) or normalized_supabase in normalized_iss):
                logger.warning(f"Token issuer {iss} doesn't match Supabase URL {supabase_url_normalized}")
                # In development, be more lenient
                if settings.ENVIRONMENT == "development":
                    logger.warning(f"Allowing issuer mismatch in development mode")
                else:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token issuer"
                    )
            
            logger.info(f"HS256 token verified successfully, issuer: {iss}, sub: {payload.get('sub')}")
            return payload
        
        # Handle RS256 tokens (production Supabase) or unknown algorithm (default to RS256)
        # Fetch JWKS for RS256 verification
        try:
            jwks = fetch_supabase_jwks()
        except HTTPException:
            # Propagate HTTPException from fetch_supabase_jwks (e.g., service unavailable)
            raise
        
        jwks_keys = jwks.get("keys", [])
        
        # Handle case where JWKS is empty (local Supabase with symmetric keys)
        # This should only happen for RS256 tokens when JWKS is not available
        if not jwks_keys:
            # Security: Only allow fallback in development environment
            if settings.ENVIRONMENT != "development":
                logger.error(
                    "JWKS is empty in production - this should never happen",
                    extra={
                        "event_type": "jwks_empty_production",
                        "jwks_url": get_supabase_jwks_url(),
                        "environment": settings.ENVIRONMENT,
                    }
                )
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication service not properly configured. JWKS is empty."
                )
            
            logger.warning(
                "JWKS is empty - attempting fallback verification (development only)",
                extra={
                    "event_type": "jwks_empty_fallback",
                    "jwks_url": get_supabase_jwks_url(),
                    "token_issuer": unverified_iss,
                }
            )
            # For local development only, decode without verification but check issuer matches
            try:
                payload = jwt.decode(
                    token,
                    "",
                    options={
                        "verify_signature": False,
                        "verify_aud": False,
                    }
                )
                # Verify issuer matches Supabase
                iss = payload.get("iss")
                if not iss or not is_supabase_issuer(iss, settings.SUPABASE_URL):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token issuer"
                    )
                logger.info("Token accepted without signature verification (local dev - issuer verified)")
                return payload
            except JWTError as e:
                logger.warning(
                    "Fallback verification failed",
                    extra={
                        "event_type": "fallback_verification_failed",
                        "error": str(e),
                        "error_type": type(e).__name__,
                    }
                )
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication service not properly configured. JWKS is empty and fallback verification failed."
                )
        
        # Handle RS256 tokens (production Supabase)
        if not kid:
            logger.warning(
                "Token missing key ID",
                extra={
                    "event_type": "token_missing_kid",
                    "header_keys": list(unverified_header.keys()),
                    "token_preview": token[:50] if len(token) > 50 else token,
                }
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing key ID"
            )
        
        # Find the key in JWKS
        key = None
        for jwk in jwks_keys:
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
        # Normalize both URLs to handle localhost/127.0.0.1 equivalence
        iss = payload.get("iss")
        if not iss:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer"
            )
        
        # Normalize both URLs to use localhost (canonical form) for comparison
        # This handles cases where frontend uses 127.0.0.1 but backend config uses localhost or host.docker.internal
        def normalize_url(url: str) -> str:
            """Normalize URL by converting 127.0.0.1 and host.docker.internal to localhost for comparison"""
            # Convert all localhost variants to canonical "localhost" form
            url = url.replace("host.docker.internal", "localhost")
            url = url.replace("127.0.0.1", "localhost")
            return url
        
        normalized_iss = normalize_url(iss)
        expected_url = normalize_url(settings.SUPABASE_URL.rstrip("/"))
        
        # Check if issuer matches (allowing for localhost/127.0.0.1 variations)
        if not normalized_iss.startswith(expected_url):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token issuer"
            )
        
        logger.info(f"RS256 token verified successfully, issuer: {iss}, sub: {payload.get('sub')}")
        return payload
        
    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except JWTError as e:
        logger.warning(
            "JWT verification failed",
            extra={
                "event_type": "jwt_verification_failed",
                "error": str(e),
                "token_type": "supabase",
                "algorithm": unverified_header.get("alg") if 'unverified_header' in locals() else "unknown",
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
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
        logger.debug(f"Fetching user by supabase_user_id: {identifier}")
        # Use raw SQL to bypass SQLAlchemy ORM issues with column aliasing
        # This is a workaround for the KeyError('supabase_user_id_1') issue
        from sqlalchemy import text
        try:
            # First, get the user ID using raw SQL
            result = db.execute(
                text("SELECT id FROM users WHERE supabase_user_id = :supabase_user_id LIMIT 1"),
                {"supabase_user_id": identifier}
            ).scalar_one_or_none()
            
            if result:
                # Now use db.get() to get the full User object - this should work reliably
                user = db.get(User, result)
                if user:
                    logger.debug(f"User found: id={user.id}, email={user.email}")
                else:
                    logger.debug("No user found with supabase_user_id (after ID lookup)")
                return user
            else:
                logger.debug("No user found with supabase_user_id")
                return None
        except Exception as e:
            logger.error(
                f"Error fetching user by supabase_user_id: {e}",
                exc_info=True
            )
            # Fallback: try simple ORM query one more time
            try:
                user = db.query(User).filter(User.supabase_user_id == identifier).first()
                return user
            except Exception as fallback_error:
                logger.error(f"Fallback query also failed: {fallback_error}", exc_info=True)
                raise
    else:
        logger.debug(f"Fetching user by id: {identifier}")
        user = db.query(User).filter(User.id == identifier).first()
        logger.debug(f"User lookup result: {'found' if user else 'not found'}")
        return user


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
            logger.warning(
                "Cross-device session not found or inactive",
                extra={
                    "event_type": "session_expired",
                    "session_id": session_id,
                    "token_type": "cross_device",
                }
            )
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
                expires_at = datetime.fromisoformat(expires_at_str)
                if datetime.now(timezone.utc) > expires_at:
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
                "User ID mismatch in cross-device token",
                extra={
                    "event_type": "token_user_mismatch",
                    "token_user_id": user_id_from_token,
                    "session_user_id": user_id_from_session,
                    "session_id": session_id,
                    "token_type": "cross_device",
                }
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token user mismatch"
            )
        
        return payload
        
    except JWTError as e:
        logger.warning(
            "Cross-device JWT verification failed",
            extra={
                "event_type": "jwt_verification_failed",
                "error": str(e),
                "token_type": "cross_device",
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cross-device token"
        )


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Get current authenticated user from JWT token.
    
    Supports two token types:
    1. Supabase tokens (iss = https://<project>.supabase.co) - verified via JWKS
    2. Cross-device tokens (iss = rekindle:xdevice) - verified via XDEVICE_JWT_SECRET
    
    Args:
        credentials: HTTP Bearer token credentials (optional if auto_error=False)
        db: Database session
        
    Returns:
        User model instance
        
    Raises:
        HTTPException: If token is invalid or user not found
    """
    # Check if credentials were provided
    if not credentials:
        ip_address = request.client.host if request.client else None
        logger.warning(
            "Missing Authorization header",
            extra={
                "event_type": "missing_auth_header",
                "ip_address": ip_address,
                "path": request.url.path,
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    
    # Check if token is present
    if not token or not token.strip():
        ip_address = request.client.host if request.client else None
        logger.warning(
            "Empty token in Authorization header",
            extra={
                "event_type": "empty_token",
                "ip_address": ip_address,
                "path": request.url.path,
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Log authentication attempt (without sensitive data)
    ip_address = request.client.host if request.client else None
    logger.info(
        "Authentication attempt",
        extra={
            "event_type": "auth_attempt",
            "ip_address": ip_address,
            "has_token": bool(token),
            "token_length": len(token) if token else 0,
            "token_preview": token[:20] + "..." if token and len(token) > 20 else "N/A",
        }
    )
    
    try:
        # Decode token without verification to check issuer
        # First try to get unverified header to check algorithm
        try:
            unverified_header = jwt.get_unverified_header(token)
            alg = unverified_header.get("alg")
            kid = unverified_header.get("kid")
            logger.info(f"Token header: alg={alg}, kid={kid}")
        except Exception as header_error:
            logger.error(f"Failed to get unverified header: {header_error}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token format: {str(header_error)}"
            )
        
        # Decode token without verification to check issuer
        # For HS256 tokens, we can use the anon key even without verification
        # For RS256 tokens, we need a dummy key since we're not verifying
        # IMPORTANT: Disable ALL verification including audience, expiration, etc.
        try:
            decode_options = {
                "verify_signature": False,
                "verify_aud": False,  # Don't verify audience
                "verify_exp": False,  # Don't verify expiration
                "verify_iat": False,  # Don't verify issued at
                "verify_nbf": False,  # Don't verify not before
            }
            
            if alg == "HS256":
                # For HS256, use anon key (even without verification, jose needs a valid key format)
                unverified_payload = jwt.decode(
                    token,
                    key=settings.SUPABASE_ANON_KEY,
                    options=decode_options
                )
            else:
                # For RS256 or unknown, use a dummy key
                # Note: jose requires a key parameter even when verify_signature=False
                unverified_payload = jwt.decode(
                    token,
                    key="dummy",  # Dummy key since we're not verifying signature
                    options=decode_options
                )
        except JWTError as decode_error:
            logger.error(f"Failed to decode token (unverified): {decode_error}", exc_info=True)
            # If unverified decode fails, the token is malformed
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token format: {str(decode_error)}"
            )
        
        iss = unverified_payload.get("iss")
        logger.info(f"Token issuer: {iss}, sub: {unverified_payload.get('sub')}")
        
        # Variables for logging (set based on token type)
        session_id_for_logging = None
        
        # Route to appropriate verification based on issuer
        user_id = None
        supabase_user_id = None
        
        if iss == "rekindle:xdevice":
            # Cross-device token - get user_id from session (not from token sub)
            payload = verify_cross_device_token(token)
            session_id = payload.get("sid")
            session_id_for_logging = session_id  # Store for logging
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
        elif iss:
            # Check if issuer is from Supabase - accept both external (localhost:54321) and internal (container:8000) URLs
            # Use the is_supabase_issuer helper function for consistent checking
            if is_supabase_issuer(iss, settings.SUPABASE_URL):
                # Supabase token - get supabase_user_id from token sub
                logger.info(f"Verifying Supabase token, issuer: {iss}")
                try:
                    payload = verify_supabase_token(token)
                    supabase_user_id = payload.get("sub")
                    logger.info(f"Token verified, supabase_user_id: {supabase_user_id}")
                    if not supabase_user_id:
                        logger.error("Token missing user ID (sub) in payload")
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Token missing user ID"
                        )
                    # Fetch user by supabase_user_id for Supabase tokens
                    logger.info(f"Fetching user with supabase_user_id: {supabase_user_id}")
                    user = _fetch_user_by_identifier(db, supabase_user_id, is_supabase=True, iss=iss)
                    logger.info(f"User lookup result: {'found' if user else 'not found'}, email: {user.email if user else 'N/A'}")
                except HTTPException:
                    # Re-raise HTTP exceptions (authentication failures)
                    raise
                except Exception as e:
                    # If Supabase verification fails, log and raise
                    # Safely get supabase_user_id for logging
                    supabase_user_id_for_log = None
                    try:
                        if 'supabase_user_id' in locals():
                            supabase_user_id_for_log = supabase_user_id
                    except:
                        pass
                    
                    logger.error(
                        f"Supabase token verification failed: {e}, "
                        f"Exception type: {type(e).__name__}, "
                        f"Exception repr: {repr(e)}, "
                        f"Supabase user ID from token: {supabase_user_id_for_log or 'N/A'}",
                        exc_info=True
                    )
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"Invalid token: {str(e)}"
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Unknown token issuer: {iss}"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing token issuer"
            )
        
        if not user:
            identifier = user_id if iss == "rekindle:xdevice" else supabase_user_id
            ip_address = request.client.host if request and request.client else None
            
            # For Supabase tokens, try to auto-create user if they don't exist
            # This handles cases where user signed in via OAuth or email/password but webhook didn't fire
            if iss != "rekindle:xdevice" and supabase_user_id and 'payload' in locals():
                # Get email from token payload if available
                # Supabase JWT tokens include email for both OAuth and email/password users
                user_email = payload.get("email")
                email_verified = bool(payload.get("email_verified") or payload.get("email_confirmed_at"))
                
                logger.info(
                    f"Token payload email extraction: email={user_email}, email_verified={email_verified}, "
                    f"payload_keys={list(payload.keys())[:10]}"
                )
                
                # Extract metadata from token for richer user creation
                user_metadata = payload.get("user_metadata") or {}
                raw_meta = payload.get("raw_user_meta_data") or {}
                combined_meta = {**raw_meta, **user_metadata}
                
                # Extract name fields
                first_name = combined_meta.get("first_name") or combined_meta.get("name", "").split()[0] if combined_meta.get("name") else None
                last_name = combined_meta.get("last_name") or (combined_meta.get("name", "").split()[1] if len(combined_meta.get("name", "").split()) > 1 else None)
                profile_image_url = combined_meta.get("avatar_url") or combined_meta.get("picture") or combined_meta.get("avatar")
                
                # Fallback: If email not in token (rare edge case), try to fetch from Supabase Admin API
                if not user_email:
                    logger.warning(
                        "Email not in token payload, attempting to fetch from Supabase API",
                        extra={
                            "event_type": "email_missing_from_token",
                            "supabase_user_id": supabase_user_id,
                        }
                    )
                    try:
                        # Use Supabase Admin API to fetch user details
                        admin_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{supabase_user_id}"
                        headers = {
                            "apikey": settings.SUPABASE_SERVICE_KEY,
                            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
                        }
                        logger.info(
                            f"Fetching user email from Supabase Admin API: {admin_url}",
                            extra={
                                "event_type": "email_fetch_attempt",
                                "supabase_user_id": supabase_user_id,
                                "supabase_url": settings.SUPABASE_URL,
                            }
                        )
                        with httpx.Client(timeout=5.0) as client:
                            response = client.get(admin_url, headers=headers)
                            logger.info(
                                f"Supabase Admin API response: status={response.status_code}",
                                extra={
                                    "event_type": "email_fetch_response",
                                    "status_code": response.status_code,
                                    "supabase_user_id": supabase_user_id,
                                }
                            )
                            if response.status_code == 200:
                                user_data = response.json()
                                user_email = user_data.get("email")
                                email_verified = bool(user_data.get("email_confirmed_at"))
                                logger.info(
                                    f"Fetched email from Supabase Admin API: {user_email}",
                                    extra={
                                        "event_type": "email_fetched_from_api",
                                        "supabase_user_id": supabase_user_id,
                                        "email": user_email,
                                    }
                                )
                            else:
                                logger.warning(
                                    f"Supabase Admin API returned non-200 status: {response.status_code}, body: {response.text[:200]}",
                                    extra={
                                        "event_type": "email_fetch_failed",
                                        "status_code": response.status_code,
                                        "supabase_user_id": supabase_user_id,
                                    }
                                )
                    except Exception as e:
                        logger.warning(
                            f"Failed to fetch email from Supabase API: {type(e).__name__}: {str(e)}",
                            extra={
                                "event_type": "email_fetch_failed",
                                "error": str(e),
                                "error_type": type(e).__name__,
                                "supabase_user_id": supabase_user_id,
                                "supabase_url": settings.SUPABASE_URL,
                            },
                            exc_info=True
                        )
                
                if user_email:
                    logger.info(
                        f"Auto-creating user on first authentication: email={user_email}, supabase_user_id={supabase_user_id}",
                        extra={
                            "event_type": "user_auto_create",
                            "supabase_user_id": supabase_user_id,
                            "email": user_email,
                            "email_verified": email_verified,
                            "ip_address": ip_address,
                        }
                    )
                    
                    try:
                        # Create user with free tier defaults
                        new_user = User(
                            supabase_user_id=supabase_user_id,
                            email=user_email,
                            email_verified=email_verified,
                            first_name=first_name,
                            last_name=last_name,
                            profile_image_url=profile_image_url,
                            subscription_tier="free",
                            subscription_status="active",
                            monthly_credits=3,  # Free tier default
                            topup_credits=0,
                            storage_limit_bytes=0,  # Free tier default
                            storage_used_bytes=0,
                            account_status="active",
                        )
                        
                        db.add(new_user)
                        db.commit()
                        db.refresh(new_user)
                        user_id_str = str(new_user.id)
                        
                        logger.info(
                            "User auto-created successfully",
                            extra={
                                "event_type": "user_created",
                                "user_id": user_id_str,
                                "supabase_user_id": supabase_user_id,
                                "email": user_email,
                                "source": "auto_create_on_auth",
                            }
                        )
                        user = new_user
                    except IntegrityError as e:
                        db.rollback()
                        # Handle race condition: user might have been created between check and insert
                        # Extract just the error detail without SQL parameters to avoid loguru formatting issues with braces
                        # The full error is still available in the extra dict
                        error_detail = str(e).split('\n')[0] if '\n' in str(e) else str(e)
                        # Escape curly braces to prevent loguru from interpreting them as format placeholders
                        error_detail_safe = error_detail.replace("{", "{{").replace("}", "}}")
                        logger.warning(
                            f"Integrity error during auto-creation (possible race condition). Attempting to fetch existing user. Error: {error_detail_safe}",
                            extra={
                                "event_type": "user_auto_create_integrity_error",
                                "error": str(e),  # Full error in extra dict
                                "supabase_user_id": supabase_user_id,
                                "email": user_email,
                            }
                        )
                        
                        # Try to fetch the user that was created concurrently
                        existing_user = db.query(User).filter(
                            (User.supabase_user_id == supabase_user_id) | (User.email == user_email)
                        ).first()
                        
                        if existing_user:
                            logger.info(
                                f"Found existing user after integrity error: id={existing_user.id}",
                                extra={
                                    "event_type": "user_found_after_integrity_error",
                                    "user_id": str(existing_user.id),
                                    "supabase_user_id": supabase_user_id,
                                }
                            )
                            user = existing_user
                        else:
                            # If we still can't find the user, log and fall through to raise error
                            logger.error(
                                f"Failed to auto-create user and could not find existing user after integrity error",
                                extra={
                                    "event_type": "user_auto_create_error",
                                    "error": str(e),
                                    "error_type": "IntegrityError",
                                    "supabase_user_id": supabase_user_id,
                                    "email": user_email,
                                    "ip_address": ip_address,
                                },
                                exc_info=True
                            )
                    except Exception as e:
                        db.rollback()
                        logger.error(
                            f"Failed to auto-create user: {type(e).__name__}: {str(e)}",
                            extra={
                                "event_type": "user_auto_create_error",
                                "error": str(e),
                                "error_type": type(e).__name__,
                                "supabase_user_id": supabase_user_id,
                                "email": user_email,
                                "ip_address": ip_address,
                            },
                            exc_info=True
                        )
                        # Fall through to raise error below
                
                # If user still not found (no email or creation failed), raise error
                if not user:
                    logger.warning(
                        "User not found and cannot auto-create",
                        extra={
                            "event_type": "user_not_found",
                            "issuer": iss,
                            "identifier": identifier,
                            "email": user_email,
                            "ip_address": ip_address,
                            "token_type": "supabase",
                        }
                    )
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail=f"User not found. Please ensure your account is synced. Email: {user_email or 'unknown'}, Supabase ID: {identifier}"
                    )
            else:
                # Cross-device token or no supabase_user_id - can't auto-create
                logger.warning(
                    "User not found for token",
                    extra={
                        "event_type": "user_not_found",
                        "issuer": iss,
                        "identifier": identifier,
                        "ip_address": ip_address,
                        "token_type": "supabase" if iss != "rekindle:xdevice" else "cross_device",
                    }
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
        
        # Check account status
        if user.account_status != "active":
            ip_address = request.client.host if request and request.client else None
            logger.warning(
                "Account access denied - inactive status",
                extra={
                    "event_type": "permission_denied",
                    "user_id": str(user.id),
                    "account_status": user.account_status,
                    "ip_address": ip_address,
                    "reason": "account_inactive",
                }
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Account is {user.account_status}"
            )
        
        # Update last_login_at (only for Supabase tokens, not cross-device)
        # Log successful authentication (INFO level - important security event)
        ip_address = request.client.host if request and request.client else None
        is_first_login = user.last_login_at is None
        
        if iss != "rekindle:xdevice":
            user.last_login_at = datetime.now(timezone.utc)
            db.commit()
            
            # Log successful authentication (INFO level for security monitoring)
            # Only log first login or use sampling to reduce volume in production
            if is_first_login or settings.ENVIRONMENT == "development":
                logger.info(
                    "Authentication successful",
                    extra={
                        "event_type": "login_success",
                        "user_id": str(user.id),
                        "email": user.email,
                        "ip_address": ip_address,
                        "token_type": "supabase",
                        "is_first_login": is_first_login,
                    }
                )
        else:
            # Cross-device authentication (less frequent, always log)
            logger.info(
                "Cross-device authentication successful",
                extra={
                    "event_type": "login_success",
                    "user_id": str(user.id),
                    "email": user.email,
                    "ip_address": ip_address,
                    "token_type": "cross_device",
                    "session_id": session_id_for_logging,
                }
            )
        
        return user
        
    except HTTPException:
        raise
    except JWTError as e:
        ip_address = request.client.host if request and request.client else None
        logger.error(
            f"JWT decode error: {str(e)}",
            extra={
                "event_type": "jwt_decode_error",
                "error": str(e),
                "error_type": type(e).__name__,
                "ip_address": ip_address,
                "token_preview": token[:50] + "..." if token and len(token) > 50 else "N/A",
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}"
        )
    except Exception as e:
        ip_address = request.client.host if request and request.client else None
        import traceback
        error_traceback = traceback.format_exc()
        # Sanitize error message to prevent loguru formatting issues with braces
        error_msg = str(e).replace("{", "{{").replace("}", "}}")
        logger.error(
            f"Unexpected error during authentication: {error_msg}",
            extra={
                "event_type": "auth_unexpected_error",
                "error": str(e),  # Full error in extra dict
                "error_type": type(e).__name__,
                "ip_address": ip_address,
                "traceback": error_traceback,
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}"
        )
    except Exception as e:
        ip_address = request.client.host if request.client else None
        error_type = type(e).__name__
        error_message = str(e)
        
        logger.error(
            "Unexpected error in authentication",
            extra={
                "event_type": "auth_error",
                "error": error_message,
                "error_type": error_type,
                "ip_address": ip_address,
                "has_credentials": credentials is not None,
                "has_token": bool(credentials.credentials if credentials else None),
            },
            exc_info=True
        )
        
        # Provide more specific error message for debugging
        detail_message = f"Authentication error: {error_type}: {error_message}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_message
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


# Tier hierarchy for permission checking
# Higher number = higher tier level
TIER_HIERARCHY: Dict[UserTier, int] = {
    "free": 0,
    "remember": 1,
    "cherish": 2,
    "forever": 3,
}


def require_tier(min_tier: UserTier):
    """
    Dependency factory that creates a dependency requiring a minimum subscription tier.
    
    Usage:
        @router.post("/endpoint")
        async def my_endpoint(
            current_user: User = Depends(require_tier("remember"))
        ):
            # User is guaranteed to have at least "remember" tier
            pass
    
    Args:
        min_tier: Minimum required tier ("free", "remember", "cherish", or "forever")
        
    Returns:
        Dependency function that validates tier and returns the user
        
    Raises:
        HTTPException: 403 Forbidden if user's tier is insufficient
    """
    def check_tier(current_user: User = Depends(get_current_user)) -> User:
        """
        Check if user has required tier level.
        
        Args:
            current_user: Authenticated user from get_current_user dependency
            
        Returns:
            User instance if tier requirement met
            
        Raises:
            HTTPException: 403 if tier insufficient
        """
        user_tier_level = TIER_HIERARCHY.get(current_user.subscription_tier, 0)
        required_level = TIER_HIERARCHY.get(min_tier, 0)
        
        if user_tier_level < required_level:
            logger.warning(
                "Tier requirement not met",
                extra={
                    "event_type": "permission_denied",
                    "user_id": str(current_user.id),
                    "user_tier": current_user.subscription_tier,
                    "required_tier": min_tier,
                    "reason": "insufficient_tier",
                }
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This feature requires at least the {min_tier.capitalize()} tier. "
                       f"Your current tier: {current_user.subscription_tier.capitalize()}",
            )
        
        return current_user
    
    return check_tier


def require_credits(min_credits: int):
    """
    Dependency factory that creates a dependency requiring minimum credits.
    
    Usage:
        @router.post("/endpoint")
        async def my_endpoint(
            current_user: User = Depends(require_credits(2))
        ):
            # User is guaranteed to have at least 2 credits
            pass
    
    Args:
        min_credits: Minimum required credits (must be > 0)
        
    Returns:
        Dependency function that validates credits and returns the user
        
    Raises:
        HTTPException: 402 Payment Required if insufficient credits
    """
    if min_credits <= 0:
        raise ValueError("min_credits must be greater than 0")
    
    def check_credits(current_user: User = Depends(get_current_user)) -> User:
        """
        Check if user has sufficient credits.
        
        Args:
            current_user: Authenticated user from get_current_user dependency
            
        Returns:
            User instance if credit requirement met
            
        Raises:
            HTTPException: 402 if insufficient credits
        """
        available_credits = current_user.total_credits
        
        if available_credits < min_credits:
            logger.warning(
                "Insufficient credits",
                extra={
                    "event_type": "permission_denied",
                    "user_id": str(current_user.id),
                    "required_credits": min_credits,
                    "available_credits": available_credits,
                    "reason": "insufficient_credits",
                }
            )
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Insufficient credits. Required: {min_credits}, Available: {available_credits}. "
                       f"Please purchase more credits to continue.",
            )
        
        return current_user
    
    return check_credits


def require_storage(required_bytes: int):
    """
    Dependency factory that creates a dependency requiring available storage space.
    
    Usage:
        @router.post("/endpoint")
        async def my_endpoint(
            current_user: User = Depends(require_storage(5 * 1024 * 1024))  # 5 MB
        ):
            # User is guaranteed to have at least 5 MB available
            pass
    
    Args:
        required_bytes: Minimum required available storage in bytes (must be > 0)
        
    Returns:
        Dependency function that validates storage and returns the user
        
    Raises:
        HTTPException: 507 Insufficient Storage if storage limit exceeded
    """
    if required_bytes <= 0:
        raise ValueError("required_bytes must be greater than 0")
    
    def check_storage(current_user: User = Depends(get_current_user)) -> User:
        """
        Check if user has sufficient available storage.
        
        Args:
            current_user: Authenticated user from get_current_user dependency
            
        Returns:
            User instance if storage requirement met
            
        Raises:
            HTTPException: 507 if insufficient storage
        """
        # If user has no storage limit (free tier), check if they have any storage
        if current_user.storage_limit_bytes == 0:
            # Free tier users have no permanent storage
            logger.warning(
                "Storage limit exceeded - no storage limit",
                extra={
                    "event_type": "permission_denied",
                    "user_id": str(current_user.id),
                    "user_tier": current_user.subscription_tier,
                    "required_bytes": required_bytes,
                    "reason": "no_storage_limit",
                }
            )
            raise HTTPException(
                status_code=507,  # HTTP 507 Insufficient Storage
                detail="Storage not available. Free tier users have no permanent storage. "
                       "Please upgrade to a paid tier to store photos permanently.",
            )
        
        available_bytes = current_user.storage_limit_bytes - current_user.storage_used_bytes
        
        if available_bytes < required_bytes:
            available_gb = available_bytes / (1024 ** 3)
            required_gb = required_bytes / (1024 ** 3)
            limit_gb = current_user.storage_limit_bytes / (1024 ** 3)
            used_gb = current_user.storage_used_bytes / (1024 ** 3)
            
            logger.warning(
                "Insufficient storage",
                extra={
                    "event_type": "permission_denied",
                    "user_id": str(current_user.id),
                    "required_bytes": required_bytes,
                    "available_bytes": available_bytes,
                    "storage_limit_bytes": current_user.storage_limit_bytes,
                    "storage_used_bytes": current_user.storage_used_bytes,
                    "reason": "insufficient_storage",
                }
            )
            raise HTTPException(
                status_code=507,  # HTTP 507 Insufficient Storage
                detail=f"Insufficient storage. Required: {required_gb:.2f} GB, "
                       f"Available: {available_gb:.2f} GB. "
                       f"Storage used: {used_gb:.2f} GB / {limit_gb:.2f} GB. "
                       f"Please free up space or upgrade your plan.",
            )
        
        return current_user
    
    return check_storage
