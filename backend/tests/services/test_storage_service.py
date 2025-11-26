"""
Unit tests for StorageService.

Tests user-scoped key generation, validation, and security features.
"""

import pytest
from uuid import UUID, uuid4
from unittest.mock import Mock, patch, MagicMock
from botocore.exceptions import ClientError

from app.services.storage_service import StorageService
from app.services.s3 import S3Service


@pytest.fixture
def storage_service():
    """Create a StorageService instance for testing."""
    return StorageService()


@pytest.fixture
def mock_s3_service():
    """Create a mock S3Service."""
    mock = Mock(spec=S3Service)
    mock.bucket = "test-bucket"
    mock.s3_client = Mock()
    return mock


@pytest.fixture
def sample_user_id():
    """Sample Supabase user ID."""
    return "a0f1a6e6-1234-5678-9abc-def012345678"


@pytest.fixture
def sample_photo_id():
    """Sample photo UUID."""
    return uuid4()


class TestKeyGeneration:
    """Test key generation methods."""
    
    def test_generate_user_scoped_key_basic(self, storage_service, sample_user_id, sample_photo_id):
        """Test basic key generation."""
        key = storage_service.generate_user_scoped_key(
            user_id=sample_user_id,
            photo_id=sample_photo_id,
            category="raw",
            filename="original.jpg"
        )
        
        assert key.startswith(f"users/{sample_user_id}/")
        assert "raw" in key
        assert str(sample_photo_id) in key
        assert key.endswith("original.jpg")
    
    def test_generate_user_scoped_key_all_categories(self, storage_service, sample_user_id, sample_photo_id):
        """Test key generation for all valid categories."""
        categories = ["raw", "processed", "thumbs", "animated", "meta"]
        
        for category in categories:
            key = storage_service.generate_user_scoped_key(
                user_id=sample_user_id,
                photo_id=sample_photo_id,
                category=category,
                filename="test.jpg"
            )
            assert category in key
            assert key.startswith(f"users/{sample_user_id}/")
    
    def test_generate_user_scoped_key_invalid_category(self, storage_service, sample_user_id, sample_photo_id):
        """Test that invalid category raises ValueError."""
        with pytest.raises(ValueError, match="Invalid category"):
            storage_service.generate_user_scoped_key(
                user_id=sample_user_id,
                photo_id=sample_photo_id,
                category="invalid",
                filename="test.jpg"
            )
    
    def test_generate_user_scoped_key_empty_user_id(self, storage_service, sample_photo_id):
        """Test that empty user_id raises ValueError."""
        with pytest.raises(ValueError, match="user_id is required"):
            storage_service.generate_user_scoped_key(
                user_id="",
                photo_id=sample_photo_id,
                category="raw",
                filename="test.jpg"
            )
    
    def test_generate_user_scoped_key_sanitizes_user_id(self, storage_service, sample_photo_id):
        """Test that user_id with slashes is sanitized."""
        malicious_user_id = "user/../../other"
        key = storage_service.generate_user_scoped_key(
            user_id=malicious_user_id,
            photo_id=sample_photo_id,
            category="raw",
            filename="test.jpg"
        )
        
        # Should replace slashes with underscores
        assert "/" not in key.split("/")[1]  # user_id part
        assert "user___other" in key or "user_.._.._other" in key
    
    def test_generate_original_key(self, storage_service, sample_user_id, sample_photo_id):
        """Test original key generation."""
        key = storage_service.generate_original_key(sample_user_id, sample_photo_id, "jpg")
        
        assert key.startswith(f"users/{sample_user_id}/")
        assert "raw" in key
        assert "original.jpg" in key
    
    def test_generate_processed_key(self, storage_service, sample_user_id, sample_photo_id):
        """Test processed key generation."""
        key = storage_service.generate_processed_key(sample_user_id, sample_photo_id, "png")
        
        assert key.startswith(f"users/{sample_user_id}/")
        assert "processed" in key
        assert "restored.png" in key
    
    def test_generate_thumbnail_key(self, storage_service, sample_user_id, sample_photo_id):
        """Test thumbnail key generation."""
        key = storage_service.generate_thumbnail_key(sample_user_id, sample_photo_id)
        
        assert key.startswith(f"users/{sample_user_id}/")
        assert "thumbs" in key
        assert str(sample_photo_id) in key
        assert key.endswith(".jpg")
    
    def test_generate_animation_key(self, storage_service, sample_user_id, sample_photo_id):
        """Test animation key generation."""
        animation_id = "anim123"
        
        # Preview
        preview_key = storage_service.generate_animation_key(
            sample_user_id, sample_photo_id, animation_id, is_preview=True
        )
        assert "animated" in preview_key
        assert "preview" in preview_key
        
        # Result
        result_key = storage_service.generate_animation_key(
            sample_user_id, sample_photo_id, animation_id, is_preview=False
        )
        assert "animated" in result_key
        assert "result" in result_key
    
    def test_generate_metadata_key(self, storage_service, sample_user_id, sample_photo_id):
        """Test metadata key generation."""
        key = storage_service.generate_metadata_key(sample_user_id, sample_photo_id)
        
        assert key.startswith(f"users/{sample_user_id}/")
        assert "meta" in key
        assert str(sample_photo_id) in key
        assert key.endswith(".json")


class TestKeyValidation:
    """Test key validation methods."""
    
    def test_validate_user_key_valid(self, storage_service, sample_user_id, sample_photo_id):
        """Test validation of valid key."""
        key = storage_service.generate_original_key(sample_user_id, sample_photo_id, "jpg")
        
        assert storage_service.validate_user_key(key, sample_user_id) is True
    
    def test_validate_user_key_wrong_user(self, storage_service, sample_user_id, sample_photo_id):
        """Test validation fails for wrong user."""
        key = storage_service.generate_original_key(sample_user_id, sample_photo_id, "jpg")
        other_user_id = "other-user-id"
        
        assert storage_service.validate_user_key(key, other_user_id) is False
    
    def test_validate_user_key_invalid_format(self, storage_service, sample_user_id):
        """Test validation fails for invalid key format."""
        invalid_key = "uploaded/some-file.jpg"
        
        assert storage_service.validate_user_key(invalid_key, sample_user_id) is False
    
    def test_validate_user_key_empty(self, storage_service, sample_user_id):
        """Test validation fails for empty key."""
        assert storage_service.validate_user_key("", sample_user_id) is False
        assert storage_service.validate_user_key(None, sample_user_id) is False
    
    def test_validate_user_key_path_traversal_attempt(self, storage_service, sample_user_id):
        """Test validation handles path traversal attempts."""
        # Even if someone tries path traversal, validation should fail
        malicious_key = f"users/{sample_user_id}/../../other-user/file.jpg"
        
        # Should fail validation (doesn't start with correct prefix after sanitization)
        assert storage_service.validate_user_key(malicious_key, sample_user_id) is False


class TestPresignedURLGeneration:
    """Test presigned URL generation."""
    
    @patch('app.services.storage_service.S3Service')
    def test_generate_presigned_upload_url_success(
        self, mock_s3_class, storage_service, sample_user_id, sample_photo_id
    ):
        """Test successful presigned upload URL generation."""
        # Setup mock
        mock_s3 = Mock()
        mock_s3.bucket = "test-bucket"
        mock_s3.s3_client.generate_presigned_post.return_value = {
            "url": "https://s3.amazonaws.com/test-bucket/",
            "fields": {"key": "test-key", "Content-Type": "image/jpeg"}
        }
        storage_service.s3_service = mock_s3
        
        result = storage_service.generate_presigned_upload_url(
            user_id=sample_user_id,
            photo_id=sample_photo_id,
            category="raw",
            filename="original.jpg",
            content_type="image/jpeg",
            max_size_bytes=50 * 1024 * 1024,
        )
        
        assert "url" in result
        assert "fields" in result
        assert "key" in result
        assert result["key"].startswith(f"users/{sample_user_id}/")
        
        # Verify presigned_post was called with conditions
        mock_s3.s3_client.generate_presigned_post.assert_called_once()
        call_kwargs = mock_s3.s3_client.generate_presigned_post.call_args[1]
        assert "Conditions" in call_kwargs
        conditions = call_kwargs["Conditions"]
        
        # Check prefix condition exists
        prefix_conditions = [c for c in conditions if isinstance(c, list) and c[0] == "starts-with"]
        assert len(prefix_conditions) > 0
    
    def test_generate_presigned_upload_url_invalid_category(
        self, storage_service, sample_user_id, sample_photo_id
    ):
        """Test that invalid category raises ValueError."""
        with pytest.raises(ValueError):
            storage_service.generate_presigned_upload_url(
                user_id=sample_user_id,
                photo_id=sample_photo_id,
                category="invalid",
                filename="test.jpg",
            )
    
    @patch('app.services.storage_service.S3Service')
    def test_generate_presigned_upload_url_s3_error(
        self, mock_s3_class, storage_service, sample_user_id, sample_photo_id
    ):
        """Test handling of S3 errors."""
        mock_s3 = Mock()
        mock_s3.bucket = "test-bucket"
        mock_s3.s3_client.generate_presigned_post.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied"}}, "GeneratePresignedPost"
        )
        storage_service.s3_service = mock_s3
        
        with pytest.raises(ClientError):
            storage_service.generate_presigned_upload_url(
                user_id=sample_user_id,
                photo_id=sample_photo_id,
                category="raw",
                filename="original.jpg",
            )
    
    def test_generate_presigned_download_url_valid(
        self, storage_service, sample_user_id, sample_photo_id
    ):
        """Test presigned download URL generation with valid key."""
        key = storage_service.generate_original_key(sample_user_id, sample_photo_id, "jpg")
        
        mock_s3 = Mock()
        mock_s3.generate_presigned_download_url.return_value = "https://presigned-url.com"
        storage_service.s3_service = mock_s3
        
        url = storage_service.generate_presigned_download_url(key, sample_user_id)
        
        assert url == "https://presigned-url.com"
        mock_s3.generate_presigned_download_url.assert_called_once_with(key, 3600)
    
    def test_generate_presigned_download_url_wrong_user(
        self, storage_service, sample_user_id, sample_photo_id
    ):
        """Test presigned download URL fails for wrong user."""
        key = storage_service.generate_original_key(sample_user_id, sample_photo_id, "jpg")
        other_user_id = "other-user-id"
        
        with pytest.raises(ValueError, match="does not belong"):
            storage_service.generate_presigned_download_url(key, other_user_id)


class TestFileOperations:
    """Test file upload/download/delete operations."""
    
    def test_upload_file_success(
        self, storage_service, sample_user_id, sample_photo_id
    ):
        """Test successful file upload."""
        mock_s3 = Mock()
        mock_s3.upload_file.return_value = "https://s3-url.com/file.jpg"
        storage_service.s3_service = mock_s3
        
        url = storage_service.upload_file(
            file_content=b"test content",
            user_id=sample_user_id,
            photo_id=sample_photo_id,
            category="raw",
            filename="original.jpg",
            content_type="image/jpeg",
        )
        
        assert url == "https://s3-url.com/file.jpg"
        mock_s3.upload_file.assert_called_once()
        call_args = mock_s3.upload_file.call_args
        assert call_args[0][0] == b"test content"
        assert call_args[0][1].startswith(f"users/{sample_user_id}/")
    
    def test_download_file_success(
        self, storage_service, sample_user_id, sample_photo_id
    ):
        """Test successful file download."""
        key = storage_service.generate_original_key(sample_user_id, sample_photo_id, "jpg")
        
        mock_s3 = Mock()
        mock_s3.download_file.return_value = b"file content"
        storage_service.s3_service = mock_s3
        
        content = storage_service.download_file(key, sample_user_id)
        
        assert content == b"file content"
        mock_s3.download_file.assert_called_once_with(key)
    
    def test_download_file_wrong_user(
        self, storage_service, sample_user_id, sample_photo_id
    ):
        """Test download fails for wrong user."""
        key = storage_service.generate_original_key(sample_user_id, sample_photo_id, "jpg")
        other_user_id = "other-user-id"
        
        with pytest.raises(ValueError, match="does not belong"):
            storage_service.download_file(key, other_user_id)
    
    def test_delete_file_success(
        self, storage_service, sample_user_id, sample_photo_id
    ):
        """Test successful file deletion."""
        key = storage_service.generate_original_key(sample_user_id, sample_photo_id, "jpg")
        
        mock_s3 = Mock()
        mock_s3.bucket = "test-bucket"
        mock_s3.s3_client.delete_object.return_value = {}
        storage_service.s3_service = mock_s3
        
        result = storage_service.delete_file(key, sample_user_id)
        
        assert result is True
        mock_s3.s3_client.delete_object.assert_called_once_with(
            Bucket="test-bucket",
            Key=key
        )
    
    def test_delete_file_wrong_user(
        self, storage_service, sample_user_id, sample_photo_id
    ):
        """Test delete fails for wrong user."""
        key = storage_service.generate_original_key(sample_user_id, sample_photo_id, "jpg")
        other_user_id = "other-user-id"
        
        with pytest.raises(ValueError, match="does not belong"):
            storage_service.delete_file(key, other_user_id)


class TestCrossUserIsolation:
    """Test that users cannot access other users' files."""
    
    def test_keys_different_for_different_users(
        self, storage_service, sample_photo_id
    ):
        """Test that same photo_id generates different keys for different users."""
        user1_id = "user-1"
        user2_id = "user-2"
        
        key1 = storage_service.generate_original_key(user1_id, sample_photo_id, "jpg")
        key2 = storage_service.generate_original_key(user2_id, sample_photo_id, "jpg")
        
        assert key1 != key2
        assert key1.startswith(f"users/{user1_id}/")
        assert key2.startswith(f"users/{user2_id}/")
    
    def test_validation_prevents_cross_user_access(
        self, storage_service, sample_photo_id
    ):
        """Test that validation prevents cross-user access."""
        user1_id = "user-1"
        user2_id = "user-2"
        
        key1 = storage_service.generate_original_key(user1_id, sample_photo_id, "jpg")
        
        # User 2 should not be able to validate User 1's key
        assert storage_service.validate_user_key(key1, user2_id) is False
        assert storage_service.validate_user_key(key1, user1_id) is True

