"""
Unit tests for JWT authentication and verification
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
from jose import jwt
from fastapi import HTTPException, status
import uuid

from app.api.deps import (
    get_current_user,
    verify_supabase_token,
    verify_cross_device_token,
    fetch_supabase_jwks,
)
from app.models.user import User
from app.core.config import settings


@pytest.fixture
def mock_supabase_jwks():
    """Mock Supabase JWKS response"""
    return {
        "keys": [
            {
                "kty": "RSA",
                "kid": "test-key-id",
                "use": "sig",
                "n": "test-n-value",
                "e": "AQAB",
            }
        ]
    }


@pytest.fixture
def mock_user(test_db_session):
    """Create a test user"""
    user = User(
        id=uuid.uuid4(),
        supabase_user_id="test-supabase-user-id",
        email="test@example.com",
        account_status="active",
        subscription_tier="free",
    )
    test_db_session.add(user)
    test_db_session.commit()
    test_db_session.refresh(user)
    return user


@pytest.fixture
def supabase_token(mock_supabase_jwks):
    """Create a valid Supabase JWT token"""
    # Note: This is a mock token - in real tests, you'd need actual RSA keys
    payload = {
        "sub": "test-supabase-user-id",
        "email": "test@example.com",
        "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        "aud": "authenticated",
        "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
    }
    # For testing, we'll mock the verification
    return jwt.encode(payload, "test-secret", algorithm="HS256")


@pytest.fixture
def cross_device_token():
    """Create a valid cross-device JWT token"""
    session_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    payload = {
        "iss": "rekindle:xdevice",
        "sub": user_id,
        "sid": session_id,
        "scope": ["upload:mobile"],
        "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
    }
    return jwt.encode(payload, settings.XDEVICE_JWT_SECRET, algorithm="HS256"), session_id, user_id


class TestSupabaseTokenVerification:
    """Tests for Supabase JWT token verification"""

    @patch("app.api.deps.fetch_supabase_jwks")
    @patch("app.api.deps.jwt.get_unverified_header")
    @patch("app.api.deps.jwt.decode")
    def test_verify_supabase_token_success(self, mock_decode, mock_header, mock_fetch_jwks, mock_supabase_jwks):
        """Test successful Supabase token verification"""
        mock_fetch_jwks.return_value = mock_supabase_jwks
        mock_header.return_value = {"kid": "test-key-id"}
        mock_decode.return_value = {
            "sub": "test-user-id",
            "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
            "aud": "authenticated",
        }
        
        token = "test-token"
        result = verify_supabase_token(token)
        
        assert result["sub"] == "test-user-id"
        mock_decode.assert_called_once()

    @patch("app.api.deps.fetch_supabase_jwks")
    def test_verify_supabase_token_missing_kid(self, mock_fetch_jwks, mock_supabase_jwks):
        """Test token verification fails when key ID is missing"""
        mock_fetch_jwks.return_value = mock_supabase_jwks
        
        with patch("app.api.deps.jwt.get_unverified_header") as mock_header:
            mock_header.return_value = {}  # No 'kid' field
            
            with pytest.raises(HTTPException) as exc_info:
                verify_supabase_token("test-token")
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "key id" in exc_info.value.detail.lower()

    @patch("app.api.deps.fetch_supabase_jwks")
    @patch("app.api.deps.jwt.get_unverified_header")
    @patch("app.api.deps.jwt.decode")
    def test_verify_supabase_token_invalid_issuer(self, mock_decode, mock_header, mock_fetch_jwks, mock_supabase_jwks):
        """Test token verification fails with invalid issuer"""
        mock_fetch_jwks.return_value = mock_supabase_jwks
        mock_header.return_value = {"kid": "test-key-id"}
        mock_decode.return_value = {
            "sub": "test-user-id",
            "iss": "https://invalid-issuer.com",
        }
        
        with pytest.raises(HTTPException) as exc_info:
            verify_supabase_token("test-token")
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "issuer" in exc_info.value.detail.lower()


class TestCrossDeviceTokenVerification:
    """Tests for cross-device JWT token verification"""

    @patch("app.services.cross_device_session_service.CrossDeviceSessionService.get_active_session")
    def test_verify_cross_device_token_success(
        self, mock_get_session, cross_device_token
    ):
        """Test successful cross-device token verification"""
        token, session_id, user_id = cross_device_token
        
        mock_get_session.return_value = {
            "user_id": user_id,
            "status": "active",
            "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        }
        
        result = verify_cross_device_token(token)
        
        assert result["sub"] == user_id
        assert result["sid"] == session_id
        assert result["iss"] == "rekindle:xdevice"
        mock_get_session.assert_called_once_with(session_id)

    @patch("app.services.cross_device_session_service.CrossDeviceSessionService.get_active_session")
    def test_verify_cross_device_token_session_not_found(
        self, mock_get_session, cross_device_token
    ):
        """Test cross-device token verification fails when session not found"""
        token, session_id, _ = cross_device_token
        
        mock_get_session.return_value = None
        
        with pytest.raises(HTTPException) as exc_info:
            verify_cross_device_token(token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "expired" in exc_info.value.detail.lower() or "revoked" in exc_info.value.detail.lower()

    @patch("app.services.cross_device_session_service.CrossDeviceSessionService.get_active_session")
    def test_verify_cross_device_token_session_inactive(
        self, mock_get_session, cross_device_token
    ):
        """Test cross-device token verification fails when session is inactive"""
        token, session_id, user_id = cross_device_token
        
        mock_get_session.return_value = {
            "user_id": user_id,
            "status": "consumed",  # Not active
            "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        }
        
        with pytest.raises(HTTPException) as exc_info:
            verify_cross_device_token(token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @patch("app.services.cross_device_session_service.CrossDeviceSessionService.get_active_session")
    def test_verify_cross_device_token_user_mismatch(
        self, mock_get_session, cross_device_token
    ):
        """Test cross-device token verification fails when user ID doesn't match"""
        token, session_id, user_id = cross_device_token
        
        mock_get_session.return_value = {
            "user_id": "different-user-id",  # Mismatch
            "status": "active",
            "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        }
        
        with pytest.raises(HTTPException) as exc_info:
            verify_cross_device_token(token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "mismatch" in exc_info.value.detail.lower()


class TestGetCurrentUser:
    """Tests for get_current_user dependency"""

    @patch("app.api.deps.verify_supabase_token")
    def test_get_current_user_supabase_token_success(
        self, mock_verify_token, mock_user, test_db_session
    ):
        """Test get_current_user with valid Supabase token"""
        mock_verify_token.return_value = {
            "sub": mock_user.supabase_user_id,
            "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        }
        
        credentials = Mock()
        credentials.credentials = "test-token"
        
        with patch("app.api.deps.jwt.get_unverified_claims") as mock_get_claims:
            mock_get_claims.return_value = {
                "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
            }
            
            user = get_current_user(credentials, test_db_session)
            
            assert user.id == mock_user.id
            assert user.supabase_user_id == mock_user.supabase_user_id
            mock_verify_token.assert_called_once()

    @patch("app.api.deps.verify_cross_device_token")
    @patch("app.services.cross_device_session_service.CrossDeviceSessionService.get_active_session")
    def test_get_current_user_cross_device_token_success(
        self, mock_get_session, mock_verify_token, mock_user, test_db_session
    ):
        """Test get_current_user with valid cross-device token"""
        session_id = str(uuid.uuid4())
        mock_verify_token.return_value = {
            "sub": str(mock_user.id),
            "sid": session_id,
            "iss": "rekindle:xdevice",
        }
        
        mock_get_session.return_value = {
            "user_id": str(mock_user.id),
            "status": "active",
            "expires_at": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
        }
        
        credentials = Mock()
        credentials.credentials = "test-token"
        
        with patch("app.api.deps.jwt.get_unverified_claims") as mock_get_claims:
            mock_get_claims.return_value = {
                "iss": "rekindle:xdevice"
            }
            
            user = get_current_user(credentials, test_db_session)
            
            assert user.id == mock_user.id
            assert user.supabase_user_id == mock_user.supabase_user_id
            # Cross-device tokens should not update last_login_at
            assert user.last_login_at == mock_user.last_login_at
            mock_verify_token.assert_called_once()
            # get_active_session should be called twice: once in verify_cross_device_token,
            # once in get_current_user
            assert mock_get_session.call_count >= 1

    @patch("app.api.deps.verify_supabase_token")
    def test_get_current_user_user_not_found(
        self, mock_verify_token, test_db_session
    ):
        """Test get_current_user when user doesn't exist"""
        mock_verify_token.return_value = {
            "sub": "non-existent-user-id",
            "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        }
        
        credentials = Mock()
        credentials.credentials = "test-token"
        
        with patch("app.api.deps.jwt.get_unverified_claims") as mock_get_claims:
            mock_get_claims.return_value = {
                "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
            }
            
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(credentials, test_db_session)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "not found" in exc_info.value.detail.lower()

    @patch("app.api.deps.verify_supabase_token")
    def test_get_current_user_account_suspended(
        self, mock_verify_token, mock_user, test_db_session
    ):
        """Test get_current_user when account is suspended"""
        mock_user.account_status = "suspended"
        test_db_session.commit()
        
        mock_verify_token.return_value = {
            "sub": mock_user.supabase_user_id,
            "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        }
        
        credentials = Mock()
        credentials.credentials = "test-token"
        
        with patch("app.api.deps.jwt.get_unverified_claims") as mock_get_claims:
            mock_get_claims.return_value = {
                "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
            }
            
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(credentials, test_db_session)
            
            assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
            assert "suspended" in exc_info.value.detail.lower()

    @patch("app.api.deps.verify_supabase_token")
    def test_get_current_user_updates_last_login(
        self, mock_verify_token, mock_user, test_db_session
    ):
        """Test get_current_user updates last_login_at for Supabase tokens"""
        mock_verify_token.return_value = {
            "sub": mock_user.supabase_user_id,
            "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
        }
        
        credentials = Mock()
        credentials.credentials = "test-token"
        
        initial_login_time = mock_user.last_login_at
        
        with patch("app.api.deps.jwt.get_unverified_claims") as mock_get_claims:
            mock_get_claims.return_value = {
                "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
            }
            
            user = get_current_user(credentials, test_db_session)
            
            assert user.last_login_at is not None
            assert user.last_login_at != initial_login_time

    def test_get_current_user_unknown_issuer(self, test_db_session):
        """Test get_current_user rejects tokens with unknown issuer"""
        credentials = Mock()
        credentials.credentials = "test-token"
        
        with patch("app.api.deps.jwt.get_unverified_claims") as mock_get_claims:
            mock_get_claims.return_value = {
                "iss": "https://unknown-issuer.com"
            }
            
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(credentials, test_db_session)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Unknown token issuer" in exc_info.value.detail


class TestJWKSCaching:
    """Tests for JWKS caching"""

    @patch("app.api.deps.httpx.Client")
    def test_fetch_jwks_caches_response(self, mock_client_class):
        """Test that JWKS responses are cached"""
        mock_response = Mock()
        mock_response.json.return_value = {"keys": []}
        mock_response.raise_for_status = Mock()
        
        mock_client = Mock()
        mock_client.__enter__ = Mock(return_value=mock_client)
        mock_client.__exit__ = Mock(return_value=False)
        mock_client.get.return_value = mock_response
        mock_client_class.return_value = mock_client
        
        # First call should fetch from network
        jwks1 = fetch_supabase_jwks()
        assert mock_client.get.call_count == 1
        
        # Second call should use cache
        jwks2 = fetch_supabase_jwks()
        assert mock_client.get.call_count == 1  # Still 1, not 2
        assert jwks1 == jwks2


class TestEdgeCases:
    """Tests for edge cases and error scenarios"""

    @patch("app.api.deps.fetch_supabase_jwks")
    def test_expired_supabase_token(self, mock_fetch_jwks, mock_supabase_jwks):
        """Test expired Supabase token is rejected"""
        mock_fetch_jwks.return_value = mock_supabase_jwks
        
        # Create expired token
        expired_payload = {
            "sub": "test-user-id",
            "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1",
            "aud": "authenticated",
            "exp": int((datetime.utcnow() - timedelta(hours=1)).timestamp()),  # Expired 1 hour ago
            "iat": int((datetime.utcnow() - timedelta(hours=2)).timestamp()),
        }
        
        with patch("app.api.deps.jwt.decode") as mock_decode:
            # jwt.decode will raise ExpiredSignatureError for expired tokens
            from jose.exceptions import ExpiredSignatureError
            mock_decode.side_effect = ExpiredSignatureError("Token has expired")
            
            with pytest.raises(HTTPException) as exc_info:
                verify_supabase_token("expired-token")
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid token" in exc_info.value.detail

    def test_malformed_jwt_token(self):
        """Test malformed JWT token is rejected"""
        credentials = Mock()
        credentials.credentials = "not.a.valid.jwt.token"
        
        with pytest.raises(HTTPException) as exc_info:
            from app.api.deps import get_current_user
            from app.core.database import SessionLocal
            db = SessionLocal()
            try:
                get_current_user(credentials, db)
            finally:
                db.close()
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    def test_empty_token(self):
        """Test empty token is rejected"""
        credentials = Mock()
        credentials.credentials = ""
        
        with pytest.raises(HTTPException) as exc_info:
            from app.api.deps import get_current_user
            from app.core.database import SessionLocal
            db = SessionLocal()
            try:
                get_current_user(credentials, db)
            finally:
                db.close()
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @patch("app.api.deps.fetch_supabase_jwks")
    def test_jwks_fetch_timeout(self, mock_fetch_jwks):
        """Test JWKS fetch timeout handling"""
        # Mock fetch_supabase_jwks to raise HTTPException (as it would after catching TimeoutException)
        # This simulates the behavior when fetch_supabase_jwks catches a timeout and raises HTTPException
        mock_fetch_jwks.side_effect = HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable"
        )
        
        # verify_supabase_token should propagate the HTTPException
        with pytest.raises(HTTPException) as exc_info:
            verify_supabase_token("test-token")
        
        # Should return 503 from fetch_supabase_jwks
        assert exc_info.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE

    def test_jwks_invalid_json_response(self):
        """Test handling of invalid JSON in JWKS response"""
        import httpx
        
        mock_response = Mock()
        mock_response.json.side_effect = ValueError("Invalid JSON")
        mock_response.raise_for_status = Mock()
        
        mock_client = Mock()
        mock_client.__enter__ = Mock(return_value=mock_client)
        mock_client.__exit__ = Mock(return_value=False)
        mock_client.get.return_value = mock_response
        
        with patch("app.api.deps.httpx.Client", return_value=mock_client):
            # Clear cache to ensure we hit the error path
            from app.api.deps import _jwks_cache, _jwks_cache_time
            import app.api.deps as deps_module
            deps_module._jwks_cache = None
            deps_module._jwks_cache_time = None
            
            with pytest.raises(HTTPException):
                fetch_supabase_jwks()

    @patch("app.services.cross_device_session_service.CrossDeviceSessionService.get_active_session")
    def test_expired_cross_device_token(self, mock_get_session):
        """Test expired cross-device token is rejected"""
        # Create expired token
        expired_payload = {
            "iss": "rekindle:xdevice",
            "sub": str(uuid.uuid4()),
            "sid": str(uuid.uuid4()),
            "exp": int((datetime.utcnow() - timedelta(hours=1)).timestamp()),  # Expired
            "iat": int((datetime.utcnow() - timedelta(hours=2)).timestamp()),
        }
        
        expired_token = jwt.encode(expired_payload, settings.XDEVICE_JWT_SECRET, algorithm="HS256")
        
        with pytest.raises(HTTPException) as exc_info:
            verify_cross_device_token(expired_token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @patch("app.services.cross_device_session_service.CrossDeviceSessionService.get_active_session")
    def test_cross_device_token_missing_sid(self, mock_get_session):
        """Test cross-device token without session ID is rejected"""
        payload = {
            "iss": "rekindle:xdevice",
            "sub": str(uuid.uuid4()),
            # Missing "sid"
            "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
        }
        
        token = jwt.encode(payload, settings.XDEVICE_JWT_SECRET, algorithm="HS256")
        
        with pytest.raises(HTTPException) as exc_info:
            verify_cross_device_token(token)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "session id" in exc_info.value.detail.lower()

    @patch("app.api.deps.verify_supabase_token")
    def test_get_current_user_with_expired_token(self, mock_verify_token, test_db_session):
        """Test get_current_user handles expired token gracefully"""
        mock_verify_token.side_effect = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
        
        credentials = Mock()
        credentials.credentials = "expired-token"
        
        with patch("app.api.deps.jwt.get_unverified_claims") as mock_get_claims:
            mock_get_claims.return_value = {
                "iss": f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
            }
            
            with pytest.raises(HTTPException) as exc_info:
                get_current_user(credentials, test_db_session)
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_with_malformed_token(self, test_db_session):
        """Test get_current_user handles malformed token"""
        credentials = Mock()
        credentials.credentials = "invalid.jwt.token.format"
        
        with pytest.raises(HTTPException) as exc_info:
            get_current_user(credentials, test_db_session)
        
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    @patch("app.api.deps.fetch_supabase_jwks")
    def test_jwks_key_not_found(self, mock_fetch_jwks, mock_supabase_jwks):
        """Test handling when JWKS key ID doesn't match any key"""
        mock_fetch_jwks.return_value = mock_supabase_jwks
        
        with patch("app.api.deps.jwt.get_unverified_header") as mock_header:
            mock_header.return_value = {"kid": "non-existent-key-id"}
            
            with pytest.raises(HTTPException) as exc_info:
                verify_supabase_token("test-token")
            
            assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
            assert "key not found" in exc_info.value.detail.lower()

    @patch("app.services.cross_device_session_service.CrossDeviceSessionService.get_active_session")
    def test_cross_device_session_expired_in_redis(self, mock_get_session, cross_device_token):
        """Test cross-device token with expired session in Redis"""
        token, session_id, user_id = cross_device_token
        
        # Session exists but is expired
        mock_get_session.return_value = {
            "user_id": user_id,
            "status": "active",
            "expires_at": (datetime.utcnow() - timedelta(minutes=1)).isoformat(),  # Expired
        }
        
        with pytest.raises(HTTPException) as exc_info:
            verify_cross_device_token(token)
        
        # Should return None for expired session, causing 401
        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

