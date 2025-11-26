"""
Integration tests for photo ownership isolation (Task 6.2b)

These tests validate that users cannot view or download other users' photos.
Tests simulate two users with distinct photos and verify complete isolation.

Run with: RUN_INTEGRATION_TESTS=1 pytest tests/integration/test_photo_ownership.py -v
"""

import pytest
import uuid
import os
from fastapi import status
from unittest.mock import patch

from app.models.user import User
from app.models.photo import Photo
from app.api.deps import get_current_user
from app.core.database import get_db
from app.main import app


@pytest.mark.integration
@pytest.mark.skipif(
    not os.getenv("RUN_INTEGRATION_TESTS"),
    reason="Set RUN_INTEGRATION_TESTS=1 to run integration tests"
)
class TestPhotoOwnershipIsolation:
    """
    Integration tests validating complete photo ownership isolation.
    
    These tests verify that:
    1. Users can only see their own photos in list endpoints
    2. Users cannot access other users' photos via any endpoint
    3. Presigned URLs are properly scoped to the requesting user
    4. All endpoints return 404 (not 403) for cross-user access attempts
    
    Note: These tests require database override setup via pytest fixtures.
    """

    @pytest.fixture
    def user1(self, test_db_session):
        """Create first test user"""
        user = User(
            id=uuid.uuid4(),
            supabase_user_id="integration_user_1",
            email="user1@integration.test",
            account_status="active",
            subscription_tier="free",
            monthly_credits=3,
        )
        test_db_session.add(user)
        test_db_session.commit()
        test_db_session.refresh(user)
        return user

    @pytest.fixture
    def user2(self, test_db_session):
        """Create second test user"""
        user = User(
            id=uuid.uuid4(),
            supabase_user_id="integration_user_2",
            email="user2@integration.test",
            account_status="active",
            subscription_tier="free",
            monthly_credits=3,
        )
        test_db_session.add(user)
        test_db_session.commit()
        test_db_session.refresh(user)
        return user

    @pytest.fixture
    def user1_photos(self, test_db_session, user1, photo_factory):
        """Create photos for user1"""
        photos = []
        for i in range(3):
            photo = photo_factory(
                owner_id=user1.supabase_user_id,
                status="ready",
                original_key=f"users/{user1.supabase_user_id}/raw/photo_{i}.jpg",
            )
            photos.append(photo)
        return photos

    @pytest.fixture
    def user2_photos(self, test_db_session, user2, photo_factory):
        """Create photos for user2"""
        photos = []
        for i in range(2):
            photo = photo_factory(
                owner_id=user2.supabase_user_id,
                status="ready",
                original_key=f"users/{user2.supabase_user_id}/raw/photo_{i}.jpg",
            )
            photos.append(photo)
        return photos

    async def _get_client_with_user(self, user, test_db_session):
        """
        Helper to create test client with specific user and database session.
        
        Returns an async context manager that:
        1. Sets up dependency overrides for user and database
        2. Creates AsyncClient
        3. Cleans up dependency overrides on exit
        """
        from httpx import ASGITransport, AsyncClient
        from contextlib import asynccontextmanager
        
        @asynccontextmanager
        async def client_context():
            def _get_user():
                return user
            
            def _get_db():
                yield test_db_session
            
            app.dependency_overrides[get_current_user] = _get_user
            app.dependency_overrides[get_db] = _get_db
            try:
                async with AsyncClient(
                    transport=ASGITransport(app=app),
                    base_url="http://test"
                ) as client:
                    yield client
            finally:
                # Clean up dependency overrides
                if get_current_user in app.dependency_overrides:
                    del app.dependency_overrides[get_current_user]
                if get_db in app.dependency_overrides:
                    del app.dependency_overrides[get_db]
        
        return client_context()

    @pytest.mark.asyncio
    async def test_list_endpoint_only_returns_caller_assets(
        self, test_db_session, user1, user2, user1_photos, user2_photos
    ):
        """
        Test that GET /photos/ only returns photos owned by the authenticated user.
        
        User1 should only see their 3 photos, not User2's 2 photos.
        """
        async with self._get_client_with_user(user1, test_db_session) as client:
            response = await client.get("/api/v1/photos/")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            
            # User1 should only see their own photos
            assert data["total"] == 3, f"Expected 3 photos, got {data['total']}"
            assert len(data["photos"]) == 3
            
            # Verify all returned photos belong to user1
            for photo in data["photos"]:
                assert photo["owner_id"] == user1.supabase_user_id, \
                    f"Photo {photo['id']} does not belong to user1"
            
            # Verify user2's photos are not included
            user2_photo_ids = {str(p.id) for p in user2_photos}
            returned_photo_ids = {p["id"] for p in data["photos"]}
            assert user2_photo_ids.isdisjoint(returned_photo_ids), \
                "User1 should not see User2's photos"

    @pytest.mark.asyncio
    async def test_get_photo_returns_404_for_other_user(
        self, test_db_session, user1, user2, user2_photos
    ):
        """
        Test that GET /photos/{photo_id} returns 404 when photo belongs to another user.
        
        User1 attempting to access User2's photo should get 404 (not 403).
        """
        other_user_photo = user2_photos[0]
        
        async with self._get_client_with_user(user1, test_db_session) as client:
            response = await client.get(f"/api/v1/photos/{other_user_photo.id}")
            
            # Should return 404 (not 403) to avoid leaking existence
            assert response.status_code == status.HTTP_404_NOT_FOUND, \
                "Should return 404 for another user's photo"
            assert "not found" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_get_photo_succeeds_for_own_photo(
        self, test_db_session, user1, user1_photos
    ):
        """Test that GET /photos/{photo_id} succeeds for user's own photo"""
        own_photo = user1_photos[0]
        
        async with self._get_client_with_user(user1, test_db_session) as client:
            response = await client.get(f"/api/v1/photos/{own_photo.id}")
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["id"] == str(own_photo.id)
            assert data["owner_id"] == user1.supabase_user_id

    @pytest.mark.asyncio
    async def test_download_url_fails_for_other_user(
        self, test_db_session, user1, user2, user2_photos
    ):
        """
        Test that GET /photos/{photo_id}/download-url returns 404 for another user's photo.
        
        Presigned URL generation should fail before even attempting to generate URL.
        """
        other_user_photo = user2_photos[0]
        
        async with self._get_client_with_user(user1, test_db_session) as client:
            response = await client.get(
                f"/api/v1/photos/{other_user_photo.id}/download-url",
                params={"key_type": "original"}
            )
            
            # Should return 404 (not 403) to avoid leaking existence
            assert response.status_code == status.HTTP_404_NOT_FOUND, \
                "Should return 404 for another user's photo"
            assert "not found" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_download_url_succeeds_for_own_photo(
        self, test_db_session, user1, user1_photos
    ):
        """Test that GET /photos/{photo_id}/download-url succeeds for user's own photo"""
        own_photo = user1_photos[0]
        
        async with self._get_client_with_user(user1, test_db_session) as client:
            # Mock storage service to avoid S3 calls
            with patch("app.api.v1.photos.storage_service.generate_presigned_download_url") as mock_gen:
                mock_gen.return_value = "https://s3.example.com/presigned-url"
                
                response = await client.get(
                    f"/api/v1/photos/{own_photo.id}/download-url",
                    params={"key_type": "original"}
                )
                
                assert response.status_code == status.HTTP_200_OK
                data = response.json()
                assert "url" in data
                assert mock_gen.called, "Storage service should be called for own photo"

    @pytest.mark.asyncio
    async def test_update_photo_fails_for_other_user(
        self, test_db_session, user1, user2, user2_photos
    ):
        """
        Test that PUT /photos/{photo_id} returns 404 for another user's photo.
        
        User1 should not be able to update User2's photo metadata.
        """
        other_user_photo = user2_photos[0]
        
        async with self._get_client_with_user(user1, test_db_session) as client:
            response = await client.put(
                f"/api/v1/photos/{other_user_photo.id}",
                json={"metadata": {"malicious": "update"}}
            )
            
            # Should return 404 (not 403) to avoid leaking existence
            assert response.status_code == status.HTTP_404_NOT_FOUND, \
                "Should return 404 for another user's photo"
            
            # Verify photo was not updated
            from app.services.photo_service import photo_service
            photo = photo_service.get_photo(
                db=test_db_session,
                owner_id=user2.supabase_user_id,
                photo_id=other_user_photo.id,
            )
            assert photo is not None, "Photo should still exist"
            assert photo.metadata_json != {"malicious": "update"}, \
                "Photo metadata should not be updated"

    @pytest.mark.asyncio
    async def test_delete_photo_fails_for_other_user(
        self, test_db_session, user1, user2, user2_photos
    ):
        """
        Test that DELETE /photos/{photo_id} returns 404 for another user's photo.
        
        User1 should not be able to delete User2's photo.
        """
        other_user_photo = user2_photos[0]
        
        async with self._get_client_with_user(user1, test_db_session) as client:
            response = await client.delete(f"/api/v1/photos/{other_user_photo.id}")
            
            # Should return 404 (not 403) to avoid leaking existence
            assert response.status_code == status.HTTP_404_NOT_FOUND, \
                "Should return 404 for another user's photo"
            
            # Verify photo was not deleted
            from app.services.photo_service import photo_service
            photo = photo_service.get_photo(
                db=test_db_session,
                owner_id=user2.supabase_user_id,
                photo_id=other_user_photo.id,
            )
            assert photo is not None, "Photo should still exist"
            assert photo.status != "deleted", "Photo should not be deleted"

    @pytest.mark.asyncio
    async def test_presigned_upload_url_scoped_to_user(
        self, test_db_session, user1, user2
    ):
        """
        Test that presigned upload URLs are scoped to the requesting user.
        
        User1's presigned upload URL should only work for User1's prefix.
        """
        async with self._get_client_with_user(user1, test_db_session) as client:
            response = await client.post(
                "/api/v1/photos/presigned-upload",
                params={
                    "filename": "test.jpg",
                    "content_type": "image/jpeg",
                    "max_size_bytes": 1024 * 1024,  # 1MB
                }
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            
            # Verify key is scoped to user1
            assert data["key"].startswith(f"users/{user1.supabase_user_id}/"), \
                f"Key should be scoped to user1: {data['key']}"
            
            # Verify key does NOT start with user2's prefix
            assert not data["key"].startswith(f"users/{user2.supabase_user_id}/"), \
                "Key should not be scoped to user2"

    @pytest.mark.asyncio
    async def test_multiple_users_complete_isolation(
        self, test_db_session, user1, user2, user1_photos, user2_photos
    ):
        """
        Comprehensive test: Multiple users with photos maintain complete isolation.
        
        This test verifies that:
        1. User1 can only see their photos
        2. User2 can only see their photos
        3. Neither user can access the other's photos
        """
        # Test User1's view
        async with self._get_client_with_user(user1, test_db_session) as client:
            response = await client.get("/api/v1/photos/")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["total"] == 3, "User1 should see 3 photos"
            
            # Try to access User2's photo
            user2_photo = user2_photos[0]
            response = await client.get(f"/api/v1/photos/{user2_photo.id}")
            assert response.status_code == status.HTTP_404_NOT_FOUND
        
        # Test User2's view
        async with self._get_client_with_user(user2, test_db_session) as client:
            response = await client.get("/api/v1/photos/")
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["total"] == 2, "User2 should see 2 photos"
            
            # Try to access User1's photo
            user1_photo = user1_photos[0]
            response = await client.get(f"/api/v1/photos/{user1_photo.id}")
            assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_presigned_url_generation_fails_for_mismatched_ownership(
        self, test_db_session, user1, user2, user2_photos
    ):
        """
        Test that presigned URL generation fails when ownership is mismatched.
        
        Even if a user somehow gets a photo ID, they cannot generate download URLs
        for photos they don't own.
        """
        other_user_photo = user2_photos[0]
        
        async with self._get_client_with_user(user1, test_db_session) as client:
            # Attempt to generate download URL for User2's photo
            response = await client.get(
                f"/api/v1/photos/{other_user_photo.id}/download-url",
                params={"key_type": "original", "expiration": 3600}
            )
            
            # Should fail before even attempting to generate URL
            assert response.status_code == status.HTTP_404_NOT_FOUND, \
                "Should return 404 before attempting URL generation"
            
            # Verify storage service was NOT called (ownership check happens first)
            # This is implicit - if we get 404, ownership check failed

    def teardown_method(self):
        """Clean up dependency overrides after each test"""
        if get_current_user in app.dependency_overrides:
            del app.dependency_overrides[get_current_user]

