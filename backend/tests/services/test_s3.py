"""
Tests for S3 service - both mocked and integration tests
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from botocore.exceptions import ClientError
import uuid
import os

from app.services.s3 import S3Service


class TestS3ServiceMocked:
    """Test suite for S3 service with mocked AWS calls"""

    @pytest.fixture
    def mock_s3_client(self):
        """Mock boto3 S3 client"""
        with patch("boto3.client") as mock_client:
            mock_s3_client = Mock()
            mock_client.return_value = mock_s3_client
            yield mock_s3_client

    @pytest.fixture
    def s3_service(self, mock_s3_client):
        """S3 service instance with mocked client"""
        # Use real settings from environment
        service = S3Service()

        def presigned_url(operation, Params, ExpiresIn):
            custom = mock_s3_client.generate_presigned_url.return_value
            if custom is not None:
                return custom
            key = Params["Key"]
            return f"https://{service.bucket}.s3.{service.region}.amazonaws.com/{key}"

        mock_s3_client.generate_presigned_url.return_value = None
        mock_s3_client.generate_presigned_url.side_effect = presigned_url
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
            Bucket="rekindle-media", Key=key, Body=file_content, ContentType=content_type
        )
        expected_url = "https://rekindle-media.s3.us-east-2.amazonaws.com/test/file.jpg"
        assert result == expected_url

    def test_upload_file_client_error(self, s3_service, mock_s3_client):
        """Test S3 client error handling"""
        # Arrange
        mock_s3_client.put_object.side_effect = ClientError(
            error_response={"Error": {"Code": "AccessDenied"}},
            operation_name="PutObject",
        )

        # Act & Assert
        with pytest.raises(ClientError):
            s3_service.upload_file(b"content", "key", "image/jpeg")

    def test_upload_processed_image(self, s3_service, mock_s3_client):
        """Test uploaded image upload with new structure"""
        # Arrange
        image_content = b"test uploaded image"
        job_id = "job-123-456"
        extension = "jpg"

        # Act
        result = s3_service.upload_processed_image(
            image_content, job_id, extension
        )

        # Assert
        expected_key = f"uploaded/{job_id}.jpg"
        mock_s3_client.put_object.assert_called_once_with(
            Bucket="rekindle-media",
            Key=expected_key,
            Body=image_content,
            ContentType="image/jpeg",
        )
        expected_url = f"https://rekindle-media.s3.us-east-2.amazonaws.com/{expected_key}"
        assert result == expected_url

    def test_upload_restored_image(self, s3_service, mock_s3_client):
        """Test restored image upload with new structure"""
        # Arrange
        image_content = b"test restored image"
        job_id = "job-123"
        restore_id = "20250926_143052_123456"  # Timestamp format
        extension = "jpg"

        # Act
        result = s3_service.upload_restored_image(
            image_content, job_id, restore_id, extension
        )

        # Assert
        expected_key = f"restored/{job_id}/{restore_id}.jpg"
        mock_s3_client.put_object.assert_called_once_with(
            Bucket="rekindle-media",
            Key=expected_key,
            Body=image_content,
            ContentType="image/jpeg",
        )
        expected_url = f"https://rekindle-media.s3.us-east-2.amazonaws.com/{expected_key}"
        assert result == expected_url

    def test_upload_animation_preview(self, s3_service, mock_s3_client):
        """Test animation preview upload"""
        # Arrange
        video_content = b"test video content"
        job_id = "job-123"
        animation_id = "20250926_143052_654321"  # Timestamp format

        # Act
        result = s3_service.upload_animation(
            video_content, job_id, animation_id, is_preview=True
        )

        # Assert
        expected_key = f"animated/{job_id}/{animation_id}_preview.mp4"
        mock_s3_client.put_object.assert_called_once_with(
            Bucket="rekindle-media",
            Key=expected_key,
            Body=video_content,
            ContentType="video/mp4",
        )
        expected_url = f"https://rekindle-media.s3.us-east-2.amazonaws.com/{expected_key}"
        assert result == expected_url

    def test_upload_animation_result(self, s3_service, mock_s3_client):
        """Test animation result (HD) upload"""
        # Arrange
        video_content = b"test HD video content"
        job_id = "job-123"
        animation_id = "20250926_143052_654321"  # Timestamp format

        # Act
        result = s3_service.upload_animation(
            video_content, job_id, animation_id, is_preview=False
        )

        # Assert
        expected_key = f"animated/{job_id}/{animation_id}_result.mp4"
        mock_s3_client.put_object.assert_called_once_with(
            Bucket="rekindle-media",
            Key=expected_key,
            Body=video_content,
            ContentType="video/mp4",
        )

    def test_upload_thumbnail(self, s3_service, mock_s3_client):
        """Test thumbnail upload"""
        # Arrange
        image_content = b"test thumbnail"
        job_id = "job-123"
        animation_id = "20250926_143052_789012"  # Timestamp format

        # Act
        result = s3_service.upload_thumbnail(
            image_content, job_id, animation_id, extension="jpg"
        )

        # Assert
        expected_key = f"thumbnails/{job_id}/{animation_id}.jpg"
        mock_s3_client.put_object.assert_called_once_with(
            Bucket="rekindle-media",
            Key=expected_key,
            Body=image_content,
            ContentType="image/jpeg",
        )

    def test_upload_meta(self, s3_service, mock_s3_client):
        """Test metadata JSON upload"""
        # Arrange
        meta_content = b'{"status": "completed"}'
        job_id = "job-123"

        # Act
        result = s3_service.upload_meta(meta_content, job_id)

        # Assert
        expected_key = f"meta/{job_id}.json"
        mock_s3_client.put_object.assert_called_once_with(
            Bucket="rekindle-media",
            Key=expected_key,
            Body=meta_content,
            ContentType="application/json",
        )

    def test_get_content_type(self, s3_service):
        """Test content type determination"""
        # Test various extensions
        test_cases = [
            ("jpg", "image/jpeg"),
            ("jpeg", "image/jpeg"),
            ("png", "image/png"),
            ("webp", "image/webp"),
            ("heic", "image/heic"),
            ("tiff", "image/tiff"),
        ]

        for extension, expected_ct in test_cases:
            ct = s3_service._get_content_type(extension)
            assert ct == expected_ct

        # Test with explicit content type
        ct = s3_service._get_content_type("jpg", "image/custom")
        assert ct == "image/custom"

    def test_extract_key_from_s3_bucket_url(self, s3_service):
        """Test extracting S3 key from S3 bucket URL"""
        # Arrange - use the same bucket name as the mocked service
        url = "https://rekindle-media.s3.us-east-2.amazonaws.com/restored/job123/restore456.jpg"

        # Act
        key = s3_service.extract_key_from_url(url)

        # Assert
        assert key == "restored/job123/restore456.jpg"

    def test_extract_key_from_s3_url(self, s3_service):
        """Test extracting S3 key from S3 URL"""
        # Arrange
        url = "https://rekindle-media.s3.amazonaws.com/restored/job123/restore456.jpg"

        # Act
        key = s3_service.extract_key_from_url(url)

        # Assert
        assert key == "restored/job123/restore456.jpg"

    def test_extract_key_from_regional_s3_url(self, s3_service):
        """Test extracting S3 key from regional S3 URL"""
        # Arrange
        url = "https://s3.us-east-2.amazonaws.com/rekindle-media/restored/job123/restore456.jpg"

        # Act
        key = s3_service.extract_key_from_url(url)

        # Assert
        assert key == "restored/job123/restore456.jpg"

    def test_extract_key_returns_input_if_not_url(self, s3_service):
        """Test that plain keys are returned as-is"""
        # Arrange
        key = "restored/job123/restore456.jpg"

        # Act
        result = s3_service.extract_key_from_url(key)

        # Assert
        assert result == key

    def test_download_file_success(self, s3_service, mock_s3_client):
        """Test successful file download"""
        # Arrange
        key = "test/file.jpg"
        expected_content = b"downloaded content"

        mock_body = Mock()
        mock_body.read.return_value = expected_content
        mock_response = {"Body": mock_body}
        mock_s3_client.get_object.return_value = mock_response

        # Act
        result = s3_service.download_file(key)

        # Assert
        mock_s3_client.get_object.assert_called_once_with(Bucket="rekindle-media", Key=key)
        assert result == expected_content

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
            Params={"Bucket": "rekindle-media", "Key": key},
            ExpiresIn=expiration,
        )
        assert result == expected_url

    def test_get_s3_url(self, s3_service):
        """Test S3 URL generation"""
        # Arrange
        key = "test/file.jpg"

        # Act
        result = s3_service.get_s3_url(key)

        # Assert
        expected_url = "https://rekindle-media.s3.us-east-2.amazonaws.com/test/file.jpg"
        assert result == expected_url

    def test_generate_timestamp_id(self, s3_service):
        """Test timestamp ID generation"""
        # Act
        timestamp_id = s3_service.generate_timestamp_id()
        
        # Assert
        # Check format: YYYYMMDD_HHMMSS_microseconds
        import re
        pattern = r"^\d{8}_\d{6}_\d{6}$"
        assert re.match(pattern, timestamp_id), f"Invalid timestamp format: {timestamp_id}"
        
        # Generate two IDs and ensure they're different
        timestamp_id2 = s3_service.generate_timestamp_id()
        assert timestamp_id != timestamp_id2, "Timestamp IDs should be unique"

    def test_clean_s3_key_removes_query_parameters(self, s3_service):
        """Test that clean_s3_key removes query parameters from keys"""
        # Arrange - key with query parameters (simulating old bug)
        dirty_key = "thumbnails/job-123.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIA"
        
        # Act
        clean_key = s3_service.clean_s3_key(dirty_key)
        
        # Assert
        assert clean_key == "thumbnails/job-123.jpg"
        assert "?" not in clean_key
        assert "X-Amz" not in clean_key

    def test_clean_s3_key_handles_url_encoded_query(self, s3_service):
        """Test that clean_s3_key handles URL-encoded query parameters"""
        # Arrange - key with URL-encoded query parameters
        dirty_key = "thumbnails/job-123.jpg%3FX-Amz-Algorithm%3DAWS4-HMAC-SHA256"
        
        # Act
        clean_key = s3_service.clean_s3_key(dirty_key)
        
        # Assert
        assert clean_key == "thumbnails/job-123.jpg"
        assert "?" not in clean_key
        assert "%3F" not in clean_key

    def test_clean_s3_key_handles_clean_key(self, s3_service):
        """Test that clean_s3_key returns clean keys unchanged"""
        # Arrange
        clean_key = "thumbnails/job-123.jpg"
        
        # Act
        result = s3_service.clean_s3_key(clean_key)
        
        # Assert
        assert result == clean_key

    def test_clean_s3_key_handles_double_encoded(self, s3_service):
        """Test that clean_s3_key handles double-encoded query parameters"""
        # Arrange - key with double-encoded query parameters
        dirty_key = "thumbnails/job-123.jpg%253FX-Amz-Algorithm%253D"
        
        # Act
        clean_key = s3_service.clean_s3_key(dirty_key)
        
        # Assert
        assert clean_key == "thumbnails/job-123.jpg"
        assert "?" not in clean_key

    def test_upload_job_thumbnail_stores_clean_key(self, s3_service, mock_s3_client):
        """Test that upload_job_thumbnail generates and uploads thumbnail correctly"""
        # Arrange
        from PIL import Image
        import io
        
        # Create a simple test image
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        image_content = img_bytes.getvalue()
        job_id = "test-job-123"
        
        # Mock presigned URL generation
        mock_s3_client.generate_presigned_url.return_value = "https://presigned-url.com/thumbnails/test-job-123.jpg"
        
        # Act
        result = s3_service.upload_job_thumbnail(image_content, job_id, extension="jpg")
        
        # Assert
        # Verify thumbnail was generated and uploaded
        assert mock_s3_client.put_object.called
        call_args = mock_s3_client.put_object.call_args
        assert call_args[1]['Key'] == "thumbnails/test-job-123.jpg"
        assert call_args[1]['ContentType'] == "image/jpeg"
        # Verify the key is clean (no query parameters)
        assert "?" not in call_args[1]['Key']
        assert result  # Should return a URL


@pytest.mark.integration
@pytest.mark.skipif(
    not os.getenv("RUN_INTEGRATION_TESTS"),
    reason="Set RUN_INTEGRATION_TESTS=1 to run integration tests"
)
class TestS3ServiceIntegration:
    """Integration tests with actual S3 bucket"""

    @pytest.fixture
    def s3_service(self):
        """Create S3 service with real credentials from environment"""
        # This will now use the actual .env file since conftest doesn't override
        return S3Service()

    @pytest.fixture
    def test_job_id(self):
        """Generate a unique job ID for testing"""
        return f"test-job-{uuid.uuid4()}"

    @pytest.fixture
    def cleanup_s3_objects(self, s3_service):
        """Fixture to track and clean up S3 objects after tests"""
        objects_to_delete = []
        
        yield objects_to_delete
        
        # Cleanup after test
        for key in objects_to_delete:
            try:
                s3_service.s3_client.delete_object(
                    Bucket=s3_service.bucket,
                    Key=key
                )
            except Exception as e:
                print(f"Warning: Could not delete {key}: {e}")

    def test_full_job_workflow(self, s3_service, test_job_id, cleanup_s3_objects):
        """Test complete job workflow with actual S3"""
        # 1. Upload uploaded image
        uploaded_content = b"Test uploaded image content"
        uploaded_url = s3_service.upload_processed_image(
            uploaded_content,
            test_job_id,
            extension="jpg"
        )
        cleanup_s3_objects.append(f"uploaded/{test_job_id}.jpg")
        
        assert uploaded_url
        assert s3_service.bucket in uploaded_url
        
        # 2. Upload restored image with timestamp ID
        restore_id = s3_service.generate_timestamp_id()
        restored_content = b"Test restored image content"
        restored_url = s3_service.upload_restored_image(
            restored_content,
            test_job_id,
            restore_id,
            extension="jpg"
        )
        cleanup_s3_objects.append(f"restored/{test_job_id}/{restore_id}.jpg")
        
        assert restored_url
        assert restore_id in restored_url
        
        # 3. Upload animation preview with timestamp ID
        animation_id = s3_service.generate_timestamp_id()
        preview_content = b"Test preview video content"
        preview_url = s3_service.upload_animation(
            preview_content,
            test_job_id,
            animation_id,
            is_preview=True
        )
        cleanup_s3_objects.append(f"animated/{test_job_id}/{animation_id}_preview.mp4")
        
        assert preview_url
        assert "preview" in preview_url
        
        # 4. Upload thumbnail
        thumb_content = b"Test thumbnail content"
        thumb_url = s3_service.upload_thumbnail(
            thumb_content,
            test_job_id,
            animation_id
        )
        cleanup_s3_objects.append(f"thumbnails/{test_job_id}/{animation_id}.jpg")
        
        assert thumb_url
        assert animation_id in thumb_url
        
        # 5. Test downloading
        downloaded = s3_service.download_file(f"restored/{test_job_id}/{restore_id}.jpg")
        assert downloaded == restored_content
        
        # 6. Test URL extraction
        key = s3_service.extract_key_from_url(restored_url)
        assert key == f"restored/{test_job_id}/{restore_id}.jpg"

    def test_presigned_url_generation(self, s3_service, test_job_id, cleanup_s3_objects):
        """Test generating presigned URL for direct upload"""
        key = f"uploaded/{test_job_id}.jpg"
        cleanup_s3_objects.append(key)
        
        # Generate presigned URL
        presigned_url = s3_service.generate_presigned_url(key, expiration=300)
        
        assert presigned_url
        assert "Signature" in presigned_url
        assert s3_service.bucket in presigned_url

    def test_error_handling_with_real_s3(self, s3_service):
        """Test error handling with actual S3"""
        # Try to download non-existent file
        with pytest.raises(ClientError) as exc_info:
            s3_service.download_file("nonexistent/file.jpg")
        
        assert exc_info.value.response["Error"]["Code"] == "NoSuchKey"