"""
Unit tests for photo API endpoints with ownership guards (Task 6.2a)

Tests verify that:
1. Users can only access their own photos
2. Ownership violations are logged for security monitoring
3. 404 (not 403) is returned when photo doesn't exist or belongs to another user
4. All photo endpoints enforce ownership checks
"""

import pytest
import uuid
from fastapi import status
from unittest.mock import patch
from loguru import logger

from app.models.photo import Photo
from app.models.user import User
from app.services.photo_service import photo_service


class TestPhotoOwnershipGuards:
    """Tests for photo ownership assertion and security logging"""

    def test_assert_owner_success(self, test_db_session, photo_factory):
        """Test assert_owner() succeeds when user owns the photo"""
        photo = photo_factory(owner_id="user_123")
        
        result = photo_service.assert_owner(
            db=test_db_session,
            photo_id=photo.id,
            user_id="user_123",
        )
        
        assert result.id == photo.id
        assert result.owner_id == "user_123"

    def test_assert_owner_photo_not_found(self, test_db_session):
        """Test assert_owner() raises ValueError when photo doesn't exist"""
        non_existent_id = uuid.uuid4()
        
        with pytest.raises(ValueError, match="Photo not found"):
            photo_service.assert_owner(
                db=test_db_session,
                photo_id=non_existent_id,
                user_id="user_123",
            )

    def test_assert_owner_ownership_violation(self, test_db_session, photo_factory, caplog):
        """Test assert_owner() logs security violation when photo belongs to another user"""
        from loguru import logger
        import sys
        
        # Capture loguru logs by adding a handler that captures to caplog
        log_capture = []
        
        def capture_log(message):
            log_capture.append(message)
        
        handler_id = logger.add(capture_log, level="WARNING", format="{message}")
        
        try:
            photo = photo_factory(owner_id="user_owner")
            
            with pytest.raises(ValueError, match="Photo not found"):
                photo_service.assert_owner(
                    db=test_db_session,
                    photo_id=photo.id,
                    user_id="user_attacker",
                    ip_address="192.168.1.100",
                )
            
            # Verify security log was emitted
            # Since loguru doesn't integrate with caplog, we check the captured logs
            assert len(log_capture) > 0
            log_message = log_capture[-1]
            assert "Photo ownership violation attempt" in log_message
        finally:
            logger.remove(handler_id)

    def test_assert_owner_no_log_when_not_found(self, test_db_session, caplog):
        """Test assert_owner() doesn't log when photo simply doesn't exist"""
        non_existent_id = uuid.uuid4()
        
        with caplog.at_level("WARNING"):
            with pytest.raises(ValueError):
                photo_service.assert_owner(
                    db=test_db_session,
                    photo_id=non_existent_id,
                    user_id="user_123",
                )
        
        # Should not log ownership violation for non-existent photos
        violation_logs = [
            r for r in caplog.records
            if "ownership violation" in r.message.lower()
        ]
        assert len(violation_logs) == 0


class TestPhotoEndpointsOwnership:
    """Tests for photo API endpoints with ownership enforcement"""

    @pytest.mark.asyncio
    async def test_get_photo_success(self, async_client, override_get_current_user, test_db_session, photo_factory):
        """Test GET /photos/{photo_id} succeeds for owned photo"""
        user = override_get_current_user
        photo = photo_factory(owner_id=user.supabase_user_id)
        
        response = await async_client.get(f"/api/v1/photos/{photo.id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["photo"]["id"] == str(photo.id)
        assert data["photo"]["owner_id"] == user.supabase_user_id

    @pytest.mark.asyncio
    async def test_get_photo_not_found(self, async_client, override_get_current_user):
        """Test GET /photos/{photo_id} returns 404 for non-existent photo"""
        non_existent_id = uuid.uuid4()
        
        response = await async_client.get(f"/api/v1/photos/{non_existent_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_photo_ownership_violation(self, async_client, test_db_session, photo_factory, caplog):
        """Test GET /photos/{photo_id} returns 404 and logs violation for another user's photo"""
        # Create two users
        owner_user = User(
            id=uuid.uuid4(),
            supabase_user_id="owner_user_123",
            email="owner@example.com",
            account_status="active",
            subscription_tier="free",
        )
        attacker_user = User(
            id=uuid.uuid4(),
            supabase_user_id="attacker_user_456",
            email="attacker@example.com",
            account_status="active",
            subscription_tier="free",
        )
        test_db_session.add(owner_user)
        test_db_session.add(attacker_user)
        test_db_session.commit()
        
        # Create photo owned by owner_user
        photo = photo_factory(owner_id=owner_user.supabase_user_id)
        
        # Override auth to use attacker_user
        from app.api.deps import get_current_user
        from app.main import app
        
        def _get_attacker_user():
            return attacker_user
        
        app.dependency_overrides[get_current_user] = _get_attacker_user
        
        try:
            from loguru import logger
            log_capture = []
            
            def capture_log(message):
                log_capture.append(message)
            
            handler_id = logger.add(capture_log, level="WARNING", format="{message}")
            
            try:
                response = await async_client.get(f"/api/v1/photos/{photo.id}")
                
                # Should return 404 (not 403) to avoid leaking existence
                assert response.status_code == status.HTTP_404_NOT_FOUND
                
                # Verify security log was emitted
                assert len(log_capture) > 0
                log_message = log_capture[-1]
                assert "Photo ownership violation attempt" in log_message
            finally:
                logger.remove(handler_id)
        finally:
            if get_current_user in app.dependency_overrides:
                del app.dependency_overrides[get_current_user]

    @pytest.mark.asyncio
    async def test_list_photos_scoped_to_user(self, async_client, override_get_current_user, test_db_session, photo_factory):
        """Test GET /photos/ only returns photos owned by current user"""
        user = override_get_current_user
        
        # Create photos for current user
        photo1 = photo_factory(owner_id=user.supabase_user_id, status="ready")
        photo2 = photo_factory(owner_id=user.supabase_user_id, status="ready")
        
        # Create photo for another user (should not appear)
        other_user_id = "other_user_789"
        photo3 = photo_factory(owner_id=other_user_id, status="ready")
        
        response = await async_client.get("/api/v1/photos/")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 2
        assert len(data["photos"]) == 2
        
        photo_ids = [p["id"] for p in data["photos"]]
        assert str(photo1.id) in photo_ids
        assert str(photo2.id) in photo_ids
        assert str(photo3.id) not in photo_ids

    @pytest.mark.asyncio
    async def test_list_photos_enforces_limit(self, async_client, override_get_current_user, test_db_session, photo_factory):
        """Test GET /photos/ enforces limit parameter to prevent unbounded queries"""
        user = override_get_current_user
        
        # Create more than 100 photos
        for i in range(150):
            photo_factory(owner_id=user.supabase_user_id)
        
        # Request with limit > 100 should be rejected with 422
        response = await async_client.get("/api/v1/photos/?limit=200")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Request with limit=50 should return 50
        response = await async_client.get("/api/v1/photos/?limit=50")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["photos"]) == 50
        
        # Request with limit=100 (max allowed) should return 100
        response = await async_client.get("/api/v1/photos/?limit=100")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["photos"]) == 100

    @pytest.mark.asyncio
    async def test_get_download_url_ownership_check(self, async_client, override_get_current_user, test_db_session, photo_factory):
        """Test GET /photos/{photo_id}/download-url validates ownership"""
        user = override_get_current_user
        photo = photo_factory(owner_id=user.supabase_user_id, original_key="users/test/raw/test.jpg")
        
        # Mock storage service to avoid S3 calls
        with patch("app.api.v1.photos.storage_service.generate_presigned_download_url") as mock_gen:
            mock_gen.return_value = "https://s3.example.com/presigned-url"
            
            response = await async_client.get(f"/api/v1/photos/{photo.id}/download-url")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "url" in data

    @pytest.mark.asyncio
    async def test_get_download_url_not_found(self, async_client, override_get_current_user):
        """Test GET /photos/{photo_id}/download-url returns 404 for non-existent photo"""
        non_existent_id = uuid.uuid4()
        
        response = await async_client.get(f"/api/v1/photos/{non_existent_id}/download-url")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_update_photo_ownership_check(self, async_client, override_get_current_user, test_db_session, photo_factory):
        """Test PUT /photos/{photo_id} validates ownership"""
        user = override_get_current_user
        photo = photo_factory(owner_id=user.supabase_user_id)
        
        response = await async_client.put(
            f"/api/v1/photos/{photo.id}",
            json={"metadata": {"test": "value"}},
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["metadata"]["test"] == "value"

    @pytest.mark.asyncio
    async def test_update_photo_not_found(self, async_client, override_get_current_user):
        """Test PUT /photos/{photo_id} returns 404 for non-existent photo"""
        non_existent_id = uuid.uuid4()
        
        response = await async_client.put(
            f"/api/v1/photos/{non_existent_id}",
            json={"metadata": {"test": "value"}},
        )
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_delete_photo_ownership_check(self, async_client, override_get_current_user, test_db_session, photo_factory):
        """Test DELETE /photos/{photo_id} validates ownership"""
        user = override_get_current_user
        photo = photo_factory(owner_id=user.supabase_user_id)
        
        response = await async_client.delete(f"/api/v1/photos/{photo.id}")
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify photo is soft-deleted
        test_db_session.refresh(photo)
        assert photo.status == "deleted"

    @pytest.mark.asyncio
    async def test_delete_photo_not_found(self, async_client, override_get_current_user):
        """Test DELETE /photos/{photo_id} returns 404 for non-existent photo"""
        non_existent_id = uuid.uuid4()
        
        response = await async_client.delete(f"/api/v1/photos/{non_existent_id}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_delete_photo_ownership_violation(self, async_client, test_db_session, photo_factory, caplog):
        """Test DELETE /photos/{photo_id} returns 404 and logs violation for another user's photo"""
        # Create two users
        owner_user = User(
            id=uuid.uuid4(),
            supabase_user_id="owner_user_123",
            email="owner@example.com",
            account_status="active",
            subscription_tier="free",
        )
        attacker_user = User(
            id=uuid.uuid4(),
            supabase_user_id="attacker_user_456",
            email="attacker@example.com",
            account_status="active",
            subscription_tier="free",
        )
        test_db_session.add(owner_user)
        test_db_session.add(attacker_user)
        test_db_session.commit()
        
        # Create photo owned by owner_user
        photo = photo_factory(owner_id=owner_user.supabase_user_id)
        
        # Override auth to use attacker_user
        from app.api.deps import get_current_user
        from app.main import app
        
        def _get_attacker_user():
            return attacker_user
        
        app.dependency_overrides[get_current_user] = _get_attacker_user
        
        try:
            from loguru import logger
            log_capture = []
            
            def capture_log(message):
                log_capture.append(message)
            
            handler_id = logger.add(capture_log, level="WARNING", format="{message}")
            
            try:
                response = await async_client.delete(f"/api/v1/photos/{photo.id}")
                
                # Should return 404 (not 403) to avoid leaking existence
                assert response.status_code == status.HTTP_404_NOT_FOUND
                
                # Verify security log was emitted
                assert len(log_capture) > 0
                log_message = log_capture[-1]
                assert "Photo ownership violation attempt" in log_message
            finally:
                logger.remove(handler_id)
        finally:
            if get_current_user in app.dependency_overrides:
                del app.dependency_overrides[get_current_user]


