"""
Unit tests for user management API endpoints (Tasks 3.5 & 3.6)
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
        async for client in async_client:
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
        async for client in async_client:
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

        async for client in async_client:
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
        async for client in async_client:
            payload = {
                "supabase_user_id": "not-a-uuid",
                "email": "test@example.com",
                "subscription_tier": "free",
            }

            response = await client.post("/api/v1/users/sync", json=payload)

            assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestGetCurrentUserEndpoint:
    """Tests for GET /api/v1/users/me endpoint (Task 3.6)"""

    @pytest.mark.asyncio
    async def test_get_current_user_success(self, async_client, override_get_current_user):
        """Test successfully getting current user profile"""
        async for client in async_client:
            response = await client.get("/api/v1/users/me")

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "id" in data
            assert "email" in data
            assert "total_credits" in data
            assert "full_name" in data
