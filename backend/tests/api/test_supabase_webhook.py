"""
Unit tests for Supabase webhook handler (Task 3.10)
"""

import pytest
import uuid
import hmac
import hashlib
import json
from fastapi import status
from unittest.mock import patch, MagicMock

from app.models.user import User


class TestSupabaseWebhookSignatureVerification:
    """Tests for webhook signature verification"""

    @pytest.mark.asyncio
    async def test_valid_signature(self, async_client, test_db_session):
        """Test that valid signature passes verification"""
        secret = "test_webhook_secret"
        payload = {"type": "INSERT", "table": "users", "schema": "auth", "record": {}}
        body_bytes = json.dumps(payload).encode('utf-8')
        
        # Generate valid signature
        signature = hmac.new(
        secret.encode('utf-8'),
        body_bytes,
        hashlib.sha256
        ).hexdigest()
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = secret
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"x-supabase-signature": signature, "content-type": "application/json"}
            )
            
            # Should not return 401 (signature error)
            assert response.status_code != status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_invalid_signature(self, async_client, test_db_session):
        """Test that invalid signature is rejected"""
        secret = "test_webhook_secret"
        payload = {"type": "INSERT", "table": "users", "schema": "auth", "record": {}}
        body_bytes = json.dumps(payload).encode('utf-8')
        
        # Use wrong signature
        invalid_signature = "invalid_signature"
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = secret
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"x-supabase-signature": invalid_signature, "content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid webhook signature" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_missing_signature_allowed_in_dev(self, async_client, test_db_session):
        """Test that missing signature is allowed when secret not configured"""
        payload = {"type": "INSERT", "table": "users", "schema": "auth", "record": {}}
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""  # Empty secret
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            # Should not return 401 (allows in dev mode)
            assert response.status_code != status.HTTP_401_UNAUTHORIZED


class TestSupabaseWebhookUserCreated:
    """Tests for user.created (INSERT) event handling"""

    @pytest.mark.asyncio
    async def test_create_new_user(self, async_client, test_db_session):
        """Test creating a new user via webhook"""
        supabase_user_id = str(uuid.uuid4())
        payload = {
        "type": "INSERT",
        "table": "users",
        "schema": "auth",
        "record": {
            "id": supabase_user_id,
            "email": "webhook@example.com",
            "email_confirmed_at": "2025-01-01T00:00:00Z",
            "raw_user_meta_data": {
                "first_name": "Webhook",
                "last_name": "User"
            }
        }
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "success"
            assert data["action"] == "created"
            assert "user_id" in data
            
            # Verify user was created in database
            user = test_db_session.query(User).filter(
                User.supabase_user_id == supabase_user_id
            ).first()
            assert user is not None
            assert user.email == "webhook@example.com"
            assert user.first_name == "Webhook"
            assert user.last_name == "User"
            assert user.email_verified is True
            assert user.subscription_tier == "free"
            assert user.monthly_credits == 3

    @pytest.mark.asyncio
    async def test_create_user_with_metadata(self, async_client, test_db_session):
        """Test creating user with profile image URL"""
        supabase_user_id = str(uuid.uuid4())
        payload = {
        "type": "INSERT",
        "table": "users",
        "schema": "auth",
        "record": {
            "id": supabase_user_id,
            "email": "avatar@example.com",
            "email_confirmed_at": None,
            "user_metadata": {
                "avatar_url": "https://example.com/avatar.jpg",
                "name": "Avatar User"
            }
        }
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            
            # Verify user was created with metadata
            user = test_db_session.query(User).filter(
                User.supabase_user_id == supabase_user_id
            ).first()
            assert user is not None
            assert user.profile_image_url == "https://example.com/avatar.jpg"
            assert user.first_name == "Avatar"
            assert user.last_name == "User"

    @pytest.mark.asyncio
    async def test_skip_existing_user(self, async_client, test_db_session):
        """Test that existing user is skipped (idempotency)"""
        supabase_user_id = str(uuid.uuid4())
        
        # Create existing user
        existing_user = User(
        supabase_user_id=supabase_user_id,
        email="existing@example.com",
        subscription_tier="free",
        monthly_credits=3,
        )
        test_db_session.add(existing_user)
        test_db_session.commit()
        
        payload = {
        "type": "INSERT",
        "table": "users",
        "schema": "auth",
        "record": {
            "id": supabase_user_id,
            "email": "new@example.com",  # Different email
        }
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "success"
            assert data["action"] == "skipped"
            assert data["reason"] == "User already exists"
            
            # Verify user email was not changed
            user = test_db_session.query(User).filter(
                User.supabase_user_id == supabase_user_id
            ).first()
            assert user.email == "existing@example.com"  # Original email preserved

    @pytest.mark.asyncio
    async def test_missing_required_fields(self, async_client, test_db_session):
        """Test that missing required fields returns error"""
        payload = {
        "type": "INSERT",
        "table": "users",
        "schema": "auth",
        "record": {
            # Missing id and email
        }
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestSupabaseWebhookUserUpdated:
    """Tests for user.updated (UPDATE) event handling"""

    @pytest.mark.asyncio
    async def test_update_user_email(self, async_client, test_db_session):
        """Test updating user email via webhook"""
        supabase_user_id = str(uuid.uuid4())
        
        # Create existing user
        user = User(
        supabase_user_id=supabase_user_id,
        email="old@example.com",
        subscription_tier="free",
        monthly_credits=3,
        )
        test_db_session.add(user)
        test_db_session.commit()
        
        payload = {
        "type": "UPDATE",
        "table": "users",
        "schema": "auth",
        "record": {
            "id": supabase_user_id,
            "email": "new@example.com",
            "email_confirmed_at": "2025-01-01T00:00:00Z",
        },
        "old_record": {
            "id": supabase_user_id,
            "email": "old@example.com",
        }
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "success"
            assert data["action"] == "updated"
            assert "email" in data["updated_fields"]
            
            # Verify user was updated
            test_db_session.refresh(user)
            assert user.email == "new@example.com"
            assert user.email_verified is True

    @pytest.mark.asyncio
    async def test_update_user_creates_if_not_exists(self, async_client, test_db_session):
        """Test that UPDATE creates user if not found"""
        supabase_user_id = str(uuid.uuid4())
        
        payload = {
        "type": "UPDATE",
        "table": "users",
        "schema": "auth",
        "record": {
            "id": supabase_user_id,
            "email": "newuser@example.com",
        },
        "old_record": {}
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            
            # Verify user was created
            user = test_db_session.query(User).filter(
                User.supabase_user_id == supabase_user_id
            ).first()
            assert user is not None
            assert user.email == "newuser@example.com"

    @pytest.mark.asyncio
    async def test_no_changes_returns_no_changes(self, async_client, test_db_session):
        """Test that no changes returns appropriate response"""
        supabase_user_id = str(uuid.uuid4())
        
        # Use a unique email to avoid clashing with other fixtures
        existing_email = "webhook-existing@example.com"
        user = User(
        supabase_user_id=supabase_user_id,
        email=existing_email,
        subscription_tier="free",
        monthly_credits=3,
        )
        test_db_session.add(user)
        test_db_session.commit()
        
        payload = {
        "type": "UPDATE",
        "table": "users",
        "schema": "auth",
        "record": {
            "id": supabase_user_id,
            "email": existing_email,  # Same email
        },
        "old_record": {
            "id": supabase_user_id,
            "email": existing_email,
        }
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "success"
            assert data["action"] == "no_changes"


class TestSupabaseWebhookUserDeleted:
    """Tests for user.deleted (DELETE) event handling"""

    @pytest.mark.asyncio
    async def test_delete_user(self, async_client, test_db_session):
        """Test deleting user via webhook"""
        supabase_user_id = str(uuid.uuid4())
        
        user = User(
        supabase_user_id=supabase_user_id,
        email="delete@example.com",
        subscription_tier="free",
        monthly_credits=3,
        )
        test_db_session.add(user)
        test_db_session.commit()
        
        payload = {
        "type": "DELETE",
        "table": "users",
        "schema": "auth",
        "old_record": {
            "id": supabase_user_id,
            "email": "delete@example.com",
        }
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "success"
            assert data["action"] == "deleted"
            
            # Verify user was marked as deleted
            test_db_session.refresh(user)
            assert user.account_status == "deleted"
            assert user.deletion_requested_at is not None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_user(self, async_client, test_db_session):
        """Test deleting non-existent user returns skipped"""
        supabase_user_id = str(uuid.uuid4())
        
        payload = {
        "type": "DELETE",
        "table": "users",
        "schema": "auth",
        "old_record": {
            "id": supabase_user_id,
            "email": "nonexistent@example.com",
        }
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "success"
            assert data["action"] == "skipped"
            assert data["reason"] == "User not found in database"


class TestSupabaseWebhookValidation:
    """Tests for webhook payload validation"""

    @pytest.mark.asyncio
    async def test_invalid_json(self, async_client, test_db_session):
        """Test that invalid JSON returns error"""
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=b"invalid json",
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.asyncio
    async def test_missing_type_field(self, async_client, test_db_session):
        """Test that missing type field returns error"""
        payload = {
        "table": "users",
        "schema": "auth",
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.asyncio
    async def test_wrong_table_ignored(self, async_client, test_db_session):
        """Test that webhook for wrong table is ignored"""
        payload = {
        "type": "INSERT",
        "table": "photos",
        "schema": "public",
        "record": {}
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["status"] == "ignored"
            assert "Not a users table event" in data["reason"]

    @pytest.mark.asyncio
    async def test_missing_record_field(self, async_client, test_db_session):
        """Test that missing record field returns error for INSERT"""
        payload = {
        "type": "INSERT",
        "table": "users",
        "schema": "auth",
        # Missing record field
        }
        body_bytes = json.dumps(payload).encode('utf-8')
        
        client = async_client
        with patch('app.api.webhooks.supabase.settings') as mock_settings:
            mock_settings.SUPABASE_WEBHOOK_SECRET = ""
            
            response = await client.post(
                "/api/webhooks/supabase",
                content=body_bytes,
                headers={"content-type": "application/json"}
            )
            
            assert response.status_code == status.HTTP_400_BAD_REQUEST

