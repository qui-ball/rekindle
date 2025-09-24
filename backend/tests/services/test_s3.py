"""
Tests for S3 service (mocked)
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from botocore.exceptions import ClientError
import uuid

from app.services.s3 import S3Service


class TestS3Service:
    """Test suite for S3 service"""

    @pytest.fixture
    def mock_s3_client(self):
        """Mock boto3 S3 client"""
        with patch('boto3.client') as mock_client:
            mock_s3_client = Mock()
            mock_client.return_value = mock_s3_client
            yield mock_s3_client

    @pytest.fixture
    def s3_service(self, mock_s3_client):
        """S3 service instance with mocked client"""
        with patch('app.core.config.settings') as mock_settings:
            mock_settings.AWS_ACCESS_KEY_ID = "test_key"
            mock_settings.AWS_SECRET_ACCESS_KEY = "test_secret"
            mock_settings.AWS_REGION = "us-east-1"
            mock_settings.S3_BUCKET = "test-bucket"
            mock_settings.CLOUDFRONT_DOMAIN = "test.cloudfront.net"
            
            service = S3Service()
            return service

    def test_upload_file_success(self, s3_service, mock_s3_client):
        """Test successful file upload"""
        # Arrange
        file_content = b"test image content"
        key = "test/file.jpg"
        content_type = "image/jpeg"

        # Act
        result = s3_service.upload_file(file_content, key, content_type)

        # Assert
        mock_s3_client.put_object.assert_called_once_with(
            Bucket="test-bucket",
            Key=key,
            Body=file_content,
            ContentType=content_type
        )
        expected_url = "https://test.cloudfront.net/test/file.jpg"
        assert result == expected_url

    def test_upload_file_client_error(self, s3_service, mock_s3_client):
        """Test S3 client error handling"""
        # Arrange
        mock_s3_client.put_object.side_effect = ClientError(
            error_response={'Error': {'Code': 'AccessDenied'}},
            operation_name='PutObject'
        )

        # Act & Assert
        with pytest.raises(ClientError):
            s3_service.upload_file(b"content", "key", "image/jpeg")

    def test_upload_image_key_generation(self, s3_service, mock_s3_client):
        """Test image upload with proper key generation"""
        # Arrange
        image_content = b"test image"
        user_id = "user123"
        prefix = "original"
        extension = "jpg"

        # Mock uuid generation for predictable test
        with patch('uuid.uuid4') as mock_uuid:
            mock_uuid.return_value = uuid.UUID('12345678-1234-5678-9012-123456789012')
            
            # Act
            result = s3_service.upload_image(image_content, user_id, prefix, extension)

            # Assert
            expected_key = "restorations/user123/original/12345678-1234-5678-9012-123456789012.jpg"
            mock_s3_client.put_object.assert_called_once_with(
                Bucket="test-bucket",
                Key=expected_key,
                Body=image_content,
                ContentType="image/jpg"
            )
            expected_url = f"https://test.cloudfront.net/{expected_key}"
            assert result == expected_url

    def test_upload_image_different_prefixes_and_extensions(self, s3_service, mock_s3_client):
        """Test image upload with different prefixes and extensions"""
        test_cases = [
            ("processed", "png"),
            ("thumbnail", "webp"),
            ("original", "heic")
        ]
        
        for prefix, extension in test_cases:
            # Arrange
            image_content = b"test image"
            user_id = "user456"
            
            with patch('uuid.uuid4') as mock_uuid:
                mock_uuid.return_value = uuid.UUID('87654321-4321-8765-4321-876543218765')
                
                # Act
                s3_service.upload_image(image_content, user_id, prefix, extension)
                
                # Assert
                expected_key = f"restorations/user456/{prefix}/87654321-4321-8765-4321-876543218765.{extension}"
                mock_s3_client.put_object.assert_called_with(
                    Bucket="test-bucket",
                    Key=expected_key,
                    Body=image_content,
                    ContentType=f"image/{extension}"
                )
                mock_s3_client.reset_mock()

    def test_download_file_success(self, s3_service, mock_s3_client):
        """Test successful file download"""
        # Arrange
        key = "test/file.jpg"
        expected_content = b"downloaded content"
        
        mock_body = Mock()
        mock_body.read.return_value = expected_content
        mock_response = {'Body': mock_body}
        mock_s3_client.get_object.return_value = mock_response

        # Act
        result = s3_service.download_file(key)

        # Assert
        mock_s3_client.get_object.assert_called_once_with(
            Bucket="test-bucket",
            Key=key
        )
        assert result == expected_content

    def test_download_file_client_error(self, s3_service, mock_s3_client):
        """Test download file error handling"""
        # Arrange
        mock_s3_client.get_object.side_effect = ClientError(
            error_response={'Error': {'Code': 'NoSuchKey'}},
            operation_name='GetObject'
        )

        # Act & Assert
        with pytest.raises(ClientError):
            s3_service.download_file("nonexistent/key")

    def test_generate_presigned_url_success(self, s3_service, mock_s3_client):
        """Test presigned URL generation"""
        # Arrange
        key = "test/upload.jpg"
        expiration = 7200
        expected_url = "https://presigned-url.example.com"
        mock_s3_client.generate_presigned_url.return_value = expected_url

        # Act
        result = s3_service.generate_presigned_url(key, expiration)

        # Assert
        mock_s3_client.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={"Bucket": "test-bucket", "Key": key},
            ExpiresIn=expiration,
        )
        assert result == expected_url

    def test_generate_presigned_url_default_expiration(self, s3_service, mock_s3_client):
        """Test presigned URL generation with default expiration"""
        # Arrange
        key = "test/upload.jpg"
        expected_url = "https://presigned-url.example.com"
        mock_s3_client.generate_presigned_url.return_value = expected_url

        # Act
        result = s3_service.generate_presigned_url(key)

        # Assert
        mock_s3_client.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={"Bucket": "test-bucket", "Key": key},
            ExpiresIn=3600,  # Default value
        )

    def test_generate_presigned_url_client_error(self, s3_service, mock_s3_client):
        """Test presigned URL generation error handling"""
        # Arrange
        mock_s3_client.generate_presigned_url.side_effect = ClientError(
            error_response={'Error': {'Code': 'AccessDenied'}},
            operation_name='GeneratePresignedUrl'
        )

        # Act & Assert
        with pytest.raises(ClientError):
            s3_service.generate_presigned_url("test/key")

    def test_get_cloudfront_url(self, s3_service):
        """Test CloudFront URL generation"""
        # Arrange
        key = "test/file.jpg"

        # Act
        result = s3_service.get_cloudfront_url(key)

        # Assert
        expected_url = "https://test.cloudfront.net/test/file.jpg"
        assert result == expected_url

    def test_s3_key_pattern_validation(self, s3_service, mock_s3_client):
        """Test S3 key patterns follow expected structure"""
        # Test data
        test_cases = [
            ("user1", "original", "jpg"),
            ("user_with_underscores", "processed", "png"),
            ("user-with-dashes", "thumbnail", "webp"),
        ]
        
        for user_id, prefix, extension in test_cases:
            with patch('uuid.uuid4') as mock_uuid:
                test_uuid = uuid.uuid4()
                mock_uuid.return_value = test_uuid
                
                # Act
                s3_service.upload_image(b"content", user_id, prefix, extension)
                
                # Assert key pattern
                call_args = mock_s3_client.put_object.call_args
                actual_key = call_args[1]['Key']
                expected_pattern = f"restorations/{user_id}/{prefix}/{test_uuid}.{extension}"
                assert actual_key == expected_pattern
                
                # Verify key structure
                key_parts = actual_key.split('/')
                assert len(key_parts) == 4
                assert key_parts[0] == "restorations"
                assert key_parts[1] == user_id
                assert key_parts[2] == prefix
                assert key_parts[3].endswith(f".{extension}")
                
                mock_s3_client.reset_mock()

    def test_concurrent_uploads_generate_unique_keys(self, s3_service, mock_s3_client):
        """Test that concurrent uploads generate unique keys"""
        # Arrange
        user_id = "concurrent_user"
        prefix = "test"
        extension = "jpg"
        
        # Don't mock uuid to test real uniqueness
        keys_generated = set()
        
        # Act - simulate multiple uploads
        for _ in range(10):
            s3_service.upload_image(b"content", user_id, prefix, extension)
            call_args = mock_s3_client.put_object.call_args
            key = call_args[1]['Key']
            keys_generated.add(key)
        
        # Assert
        assert len(keys_generated) == 10  # All keys should be unique