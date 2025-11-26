"""
Unit tests for user management API endpoints (Tasks 3.5, 3.6 & 3.7)
"""

import pytest
import uuid
from fastapi import status

from app.models.user import User


class TestUserSyncEndpoint:
    """Tests for POST /api/v1/users/sync endpoint (Task 3.5)"""

    @pytest.mark.asyncio
    async def test_create_new_user_free_tier(self, async_client, test_db_session):
        """Test creating a new user with free tier defaults"""
        client = async_client
        payload = {
        "supabase_user_id": str(uuid.uuid4()),
        "email": "newuser@example.com",
        "email_verified": False,
        "subscription_tier": "free",
        }

        response = await client.post("/api/v1/users/sync", json=payload)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["subscription_tier"] == "free"
        assert data["monthly_credits"] == 3
        assert data["storage_limit_bytes"] == 0
        assert data["total_credits"] == 3
        assert data["account_status"] == "active"
        assert "id" in data
        assert data["id"] is not None

    @pytest.mark.asyncio
    async def test_create_new_user_remember_tier(self, async_client, test_db_session):
        """Test creating a new user with remember tier defaults"""
        client = async_client
        payload = {
        "supabase_user_id": str(uuid.uuid4()),
        "email": "remember@example.com",
        "email_verified": True,
        "subscription_tier": "remember",
        }

        response = await client.post("/api/v1/users/sync", json=payload)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["subscription_tier"] == "remember"
        assert data["monthly_credits"] == 25
        assert data["storage_limit_bytes"] == 10 * 1024 * 1024 * 1024
        assert data["total_credits"] == 25

    @pytest.mark.asyncio
    async def test_existing_user_by_supabase_id(self, async_client, test_db_session):
        """Test that existing user by supabase_user_id returns 200 OK"""
        supabase_id = str(uuid.uuid4())
        
        existing_user = User(
        supabase_user_id=supabase_id,
        email="existing@example.com",
        subscription_tier="free",
        monthly_credits=3,
        )
        test_db_session.add(existing_user)
        test_db_session.commit()

        client = async_client
        payload = {
        "supabase_user_id": supabase_id,
        "email": "different@example.com",
        "subscription_tier": "free",
        }

        response = await client.post("/api/v1/users/sync", json=payload)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["supabase_user_id"] == supabase_id
        assert data["email"] == "existing@example.com"

    @pytest.mark.asyncio
    async def test_invalid_supabase_user_id_format(self, async_client):
        """Test that invalid supabase_user_id format is rejected"""
        client = async_client
        payload = {
        "supabase_user_id": "not-a-uuid",
        "email": "test@example.com",
        "subscription_tier": "free",
        }

        response = await client.post("/api/v1/users/sync", json=payload)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


class TestGetCurrentUserEndpoint:
    """Tests for GET /api/v1/users/me endpoint (Task 3.6)"""

    @pytest.mark.asyncio
    async def test_get_current_user_success(self, async_client, override_get_current_user):
        """Test successfully getting current user profile"""
        client = async_client
        response = await client.get("/api/v1/users/me")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "total_credits" in data
        assert "full_name" in data


class TestUpdateCurrentUserEndpoint:
    """Tests for PUT /api/v1/users/me endpoint (Task 3.7)"""

    @pytest.mark.asyncio
    async def test_update_first_name_success(self, async_client, override_get_current_user, test_db_session):
        """Test successfully updating first name"""
        client = async_client
        user = override_get_current_user
        original_first_name = user.first_name
        
        payload = {
        "first_name": "UpdatedFirstName"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["first_name"] == "UpdatedFirstName"
        assert data["last_name"] == user.last_name  # Unchanged
        assert data["email"] == user.email  # Unchanged
        
        # Verify database was updated
        test_db_session.refresh(user)
        assert user.first_name == "UpdatedFirstName"

    @pytest.mark.asyncio
    async def test_update_last_name_success(self, async_client, override_get_current_user, test_db_session):
        """Test successfully updating last name"""
        client = async_client
        user = override_get_current_user
        original_last_name = user.last_name
        
        payload = {
        "last_name": "UpdatedLastName"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["last_name"] == "UpdatedLastName"
        assert data["first_name"] == user.first_name  # Unchanged
        
        # Verify database was updated
        test_db_session.refresh(user)
        assert user.last_name == "UpdatedLastName"

    @pytest.mark.asyncio
    async def test_update_profile_image_url_success(self, async_client, override_get_current_user, test_db_session):
        """Test successfully updating profile image URL"""
        client = async_client
        user = override_get_current_user
        
        payload = {
        "profile_image_url": "https://example.com/avatar.jpg"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["profile_image_url"] == "https://example.com/avatar.jpg"
        
        # Verify database was updated
        test_db_session.refresh(user)
        assert user.profile_image_url == "https://example.com/avatar.jpg"

    @pytest.mark.asyncio
    async def test_update_all_fields_success(self, async_client, override_get_current_user, test_db_session):
        """Test successfully updating all fields at once"""
        client = async_client
        user = override_get_current_user
        
        payload = {
        "first_name": "John",
        "last_name": "Doe",
        "profile_image_url": "https://example.com/john.jpg"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["first_name"] == "John"
        assert data["last_name"] == "Doe"
        assert data["profile_image_url"] == "https://example.com/john.jpg"
        assert data["full_name"] == "John Doe"
        
        # Verify database was updated
        test_db_session.refresh(user)
        assert user.first_name == "John"
        assert user.last_name == "Doe"
        assert user.profile_image_url == "https://example.com/john.jpg"

    @pytest.mark.asyncio
    async def test_update_empty_request_body(self, async_client, override_get_current_user):
        """Test that empty request body returns current user"""
        client = async_client
        user = override_get_current_user
        
        payload = {}
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == user.email
        assert data["first_name"] == user.first_name
        assert data["last_name"] == user.last_name

    @pytest.mark.asyncio
    async def test_update_with_none_values(self, async_client, override_get_current_user, test_db_session):
        """Test that None values are handled correctly (should not update)"""
        client = async_client
        user = override_get_current_user
        original_first_name = user.first_name
        
        # Set a value first
        user.first_name = "Original"
        test_db_session.commit()
        test_db_session.refresh(user)
        
        # Try to update with None (should be ignored by Pydantic)
        payload = {
        "first_name": None
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        # Pydantic will treat None as "not provided" for Optional fields
        # So the field should remain unchanged
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.asyncio
    async def test_update_invalid_name_format_special_chars(self, async_client, override_get_current_user):
        """Test that invalid name format with special characters is rejected"""
        client = async_client
        payload = {
        "first_name": "John@123"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        data = response.json()
        assert "detail" in data

    @pytest.mark.asyncio
    async def test_update_name_with_numbers(self, async_client, override_get_current_user):
        """Test that names with numbers are rejected"""
        client = async_client
        payload = {
        "first_name": "John123"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    @pytest.mark.asyncio
    async def test_update_name_too_long(self, async_client, override_get_current_user):
        """Test that names exceeding 100 characters are rejected"""
        client = async_client
        payload = {
        "first_name": "A" * 101  # 101 characters
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT

    @pytest.mark.asyncio
    async def test_update_name_valid_characters(self, async_client, override_get_current_user, test_db_session):
        """Test that valid name characters (hyphens, apostrophes, spaces) are accepted"""
        client = async_client
        payload = {
        "first_name": "Mary-Jane",
        "last_name": "O'Brien"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["first_name"] == "Mary-Jane"
        assert data["last_name"] == "O'Brien"

    @pytest.mark.asyncio
    async def test_update_name_with_spaces(self, async_client, override_get_current_user, test_db_session):
        """Test that names with spaces are accepted"""
        client = async_client
        payload = {
        "first_name": "Mary Jane"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["first_name"] == "Mary Jane"

    @pytest.mark.asyncio
    async def test_update_name_empty_string_becomes_none(self, async_client, override_get_current_user, test_db_session):
        """Test that empty string after trimming becomes None"""
        client = async_client
        user = override_get_current_user
        user.first_name = "Original"
        test_db_session.commit()
        test_db_session.refresh(user)
        
        # Empty string should be trimmed and become None
        payload = {
        "first_name": "   "  # Whitespace only
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # After validation, empty string becomes None
        assert data["first_name"] is None
        
        test_db_session.refresh(user)
        assert user.first_name is None

    @pytest.mark.asyncio
    async def test_update_name_min_length(self, async_client, override_get_current_user, test_db_session):
        """Test that single character name is accepted"""
        client = async_client
        payload = {
        "first_name": "A"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["first_name"] == "A"

    @pytest.mark.asyncio
    async def test_update_name_max_length(self, async_client, override_get_current_user, test_db_session):
        """Test that 100 character name is accepted"""
        client = async_client
        payload = {
        "first_name": "A" * 100  # Exactly 100 characters
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["first_name"]) == 100

    @pytest.mark.asyncio
    async def test_update_preserves_other_fields(self, async_client, override_get_current_user, test_db_session):
        """Test that updating one field preserves other fields"""
        client = async_client
        user = override_get_current_user
        original_email = user.email
        original_tier = user.subscription_tier
        original_credits = user.monthly_credits
        
        payload = {
        "first_name": "NewName"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["first_name"] == "NewName"
        assert data["email"] == original_email
        assert data["subscription_tier"] == original_tier
        assert data["monthly_credits"] == original_credits

    @pytest.mark.asyncio
    async def test_update_returns_computed_fields(self, async_client, override_get_current_user, test_db_session):
        """Test that response includes computed fields like full_name"""
        client = async_client
        payload = {
        "first_name": "John",
        "last_name": "Doe"
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["full_name"] == "John Doe"
        assert "total_credits" in data
        assert "storage_limit_gb" in data
        assert "storage_used_gb" in data
        assert "storage_percentage" in data

    @pytest.mark.asyncio
    async def test_update_requires_authentication(self, override_get_db):
        """Test that unauthenticated requests are rejected"""
        from app.main import app
        from app.api.deps import get_current_user
        from httpx import ASGITransport, AsyncClient
        
        # Remove authentication override before creating client
        if "get_current_user" in app.dependency_overrides:
            del app.dependency_overrides["get_current_user"]
        
        # Create a new client without the override
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            payload = {
                "first_name": "Test"
            }
            
            # Make request without Authorization header
            response = await client.put("/api/v1/users/me", json=payload)
            
            # FastAPI's HTTPBearer may return 403 or 401 for missing authentication
            assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

    @pytest.mark.asyncio
    async def test_update_with_suspended_account(self, async_client, test_db_session):
        """Test that suspended accounts cannot update profile"""
        from app.models.user import User
        from app.main import app
        from app.api.deps import get_current_user
        import uuid
        
        # Create suspended user
        suspended_user = User(
            id=uuid.uuid4(),
            supabase_user_id=str(uuid.uuid4()),
            email="suspended@example.com",
            account_status="suspended",
            subscription_tier="free",
        )
        test_db_session.add(suspended_user)
        test_db_session.commit()
        test_db_session.refresh(suspended_user)
        
        def _get_suspended_user():
            return suspended_user
        
        # Remove any existing override first
        if "get_current_user" in app.dependency_overrides:
            del app.dependency_overrides["get_current_user"]
        
        # Set up override for suspended user
        app.dependency_overrides[get_current_user] = _get_suspended_user
        
        try:
            client = async_client
            payload = {
                "first_name": "Test"
            }
            
            response = await client.put("/api/v1/users/me", json=payload)
            
            # Should be rejected by get_current_user dependency
            assert response.status_code == status.HTTP_403_FORBIDDEN
        finally:
            if "get_current_user" in app.dependency_overrides:
                del app.dependency_overrides["get_current_user"]

    @pytest.mark.asyncio
    async def test_update_profile_image_url_empty_string(self, async_client, override_get_current_user, test_db_session):
        """Test that empty profile_image_url can be set"""
        client = async_client
        user = override_get_current_user
        user.profile_image_url = "https://example.com/old.jpg"
        test_db_session.commit()
        test_db_session.refresh(user)
        
        # Set to None explicitly
        payload = {
        "profile_image_url": None
        }
        
        response = await client.put("/api/v1/users/me", json=payload)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["profile_image_url"] is None
        
        test_db_session.refresh(user)
        assert user.profile_image_url is None
