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
import httpx
from loguru import logger

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User, UserTier
from app.services.cross_device_session_service import CrossDeviceSessionService

security = HTTPBearer()

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
    Verify Supabase JWT token using JWKS.
    
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
        
        # Get unverified header first to check token format
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
        
        # Try to decode without verification to check issuer (for debugging/fallback)
        # Note: jose library requires a key parameter even when verify_signature=False
        # We use an empty string as a dummy key since we're not verifying the signature
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
        
        # Fetch JWKS
        try:
            jwks = fetch_supabase_jwks()
        except HTTPException:
            # Propagate HTTPException from fetch_supabase_jwks (e.g., service unavailable)
            raise
        
        kid = unverified_header.get("kid")
        jwks_keys = jwks.get("keys", [])
        
        # Handle case where JWKS is empty (local Supabase with symmetric keys)
        # Try to verify using service key as fallback (ONLY in development)
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
            # For local development only, try to verify with service key
            # This is a fallback when JWKS is not available (local Supabase may use symmetric keys)
            # Check token algorithm from header
            token_algorithm = unverified_header.get("alg", "unknown")
            logger.debug(
                "Token algorithm from header",
                extra={
                    "algorithm": token_algorithm,
                    "has_kid": "kid" in unverified_header,
                }
            )
            
            try:
                # Try HS256 first (symmetric key - common for local Supabase)
                # If that fails, the token is likely signed with RS256 (asymmetric)
                # but we don't have the public key in JWKS
                try:
                    payload = jwt.decode(
                        token,
                        settings.SUPABASE_SERVICE_KEY,
                        algorithms=[ALGORITHMS.HS256],
                        audience="authenticated",
                    )
                    logger.info("Token verified using HS256 with service key (local dev)")
                except JWTError:
                    # If HS256 fails, the token is likely RS256 but we don't have the key
                    # For local dev, we can skip signature verification if issuer matches
                    logger.warning(
                        "HS256 verification failed, token may be RS256 signed",
                        extra={
                            "token_algorithm": token_algorithm,
                            "falling_back_to_unverified": True,
                        }
                    )
                    # Decode without verification but check issuer matches
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
                
                # Verify issuer matches (for both HS256 and RS256 fallback cases)
                iss = payload.get("iss")
                if not iss or not is_supabase_issuer(iss, settings.SUPABASE_URL):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token issuer"
                    )
                
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
            }
        )
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
            if is_supabase_issuer(iss, settings.SUPABASE_URL):
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
            if iss != "rekindle:xdevice" and supabase_user_id:
                try:
                    # Get email from token payload if available
                    # Supabase JWT tokens include email for both OAuth and email/password users
                    email = payload.get("email")
                    email_verified = payload.get("email_verified", False)
                    
                    # Fallback: If email not in token (rare edge case), try to fetch from Supabase Admin API
                    if not email:
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
                            with httpx.Client(timeout=5.0) as client:
                                response = client.get(admin_url, headers=headers)
                                if response.status_code == 200:
                                    user_data = response.json()
                                    email = user_data.get("email")
                                    email_verified = bool(user_data.get("email_confirmed_at"))
                                    logger.info(
                                        "Fetched email from Supabase Admin API",
                                        extra={
                                            "event_type": "email_fetched_from_api",
                                            "supabase_user_id": supabase_user_id,
                                            "email": email,
                                        }
                                    )
                        except Exception as e:
                            logger.warning(
                                "Failed to fetch email from Supabase API",
                                extra={
                                    "event_type": "email_fetch_failed",
                                    "error": str(e),
                                    "supabase_user_id": supabase_user_id,
                                }
                            )
                    
                    if email:
                        logger.info(
                            "Auto-creating user on first authentication",
                            extra={
                                "event_type": "user_auto_create",
                                "supabase_user_id": supabase_user_id,
                                "email": email,
                                "ip_address": ip_address,
                            }
                        )
                        
                        # Create user with free tier defaults
                        new_user = User(
                            supabase_user_id=supabase_user_id,
                            email=email,
                            email_verified=email_verified,
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
                        
                        logger.info(
                            "User auto-created successfully",
                            extra={
                                "event_type": "user_created",
                                "user_id": str(new_user.id),
                                "supabase_user_id": supabase_user_id,
                                "email": email,
                                "source": "auto_create_on_auth",
                            }
                        )
                        
                        user = new_user
                    else:
                        # No email in token - can't auto-create
                        logger.warning(
                            "User not found and cannot auto-create (no email in token)",
                            extra={
                                "event_type": "user_not_found",
                                "issuer": iss,
                                "identifier": identifier,
                                "ip_address": ip_address,
                                "token_type": "supabase",
                            }
                        )
                        raise HTTPException(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="User not found. Please complete sign-up."
                        )
                except Exception as e:
                    db.rollback()
                    logger.error(
                        "Failed to auto-create user",
                        extra={
                            "event_type": "user_auto_create_error",
                            "error": str(e),
                            "supabase_user_id": supabase_user_id,
                            "ip_address": ip_address,
                        },
                        exc_info=True
                    )
                    # Re-raise as user not found
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User not found"
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
        logger.warning(
            "JWT decode error",
            extra={
                "event_type": "jwt_decode_error",
                "error": str(e),
                "ip_address": ip_address,
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    except Exception as e:
        ip_address = request.client.host if request and request.client else None
        import traceback
        error_traceback = traceback.format_exc()
        logger.error(
            "Unexpected error in authentication",
            extra={
                "event_type": "auth_error",
                "error": str(e),
                "error_type": type(e).__name__,
                "ip_address": ip_address,
                "traceback": error_traceback,
            },
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Authentication error: {type(e).__name__}: {str(e)}"
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
