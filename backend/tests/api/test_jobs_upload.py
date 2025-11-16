"""
Tests for jobs upload endpoint - ensuring thumbnail keys are stored correctly
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi import UploadFile, HTTPException
from io import BytesIO

from app.api.v1.jobs import upload_and_process, list_jobs, get_job
from app.models.jobs import Job


class TestJobsUpload:
    """Test suite for job upload endpoint"""

    @pytest.fixture
    def mock_s3_service(self):
        """Mock S3 service"""
        with patch("app.api.v1.jobs.s3_service") as mock:
            mock.bucket = "rekindle-media"
            mock.s3_client = MagicMock()
            mock.upload_processed_image = Mock(return_value="https://s3.amazonaws.com/uploaded/test.jpg")
            mock.generate_thumbnail = Mock(return_value=b"thumbnail_bytes")
            # Use the real clean_s3_key method
            from app.services.s3 import S3Service
            real_service = S3Service()
            mock.clean_s3_key = real_service.clean_s3_key
            yield mock

    @pytest.mark.asyncio
    async def test_upload_stores_clean_thumbnail_key(self, mock_s3_service, test_db_session, test_image_bytes):
        """Test that upload endpoint stores thumbnail key without query parameters"""
        # Arrange
        file = UploadFile(
            filename="test.jpg",
            file=BytesIO(test_image_bytes),
            headers={"content-type": "image/jpeg"}
        )
        email = "test@example.com"

        # Act
        response = await upload_and_process(
            file=file,
            email=email,
            db=test_db_session
        )

        # Assert
        # Verify job was created
        assert response.job_id is not None
        
        # Verify thumbnail was uploaded with clean key
        mock_s3_service.s3_client.put_object.assert_called()
        put_object_calls = [call for call in mock_s3_service.s3_client.put_object.call_args_list]
        
        # Find the thumbnail upload call
        thumbnail_call = None
        for call in put_object_calls:
            if call[1]['Key'].startswith('thumbnails/'):
                thumbnail_call = call
                break
        
        assert thumbnail_call is not None, "Thumbnail should be uploaded"
        
        # Verify the key is clean (no query parameters)
        thumbnail_key = thumbnail_call[1]['Key']
        assert "?" not in thumbnail_key, f"Thumbnail key should not contain query parameters: {thumbnail_key}"
        assert thumbnail_key.startswith("thumbnails/")
        assert thumbnail_key.endswith(".jpg")
        
        # Verify the job in database has clean key
        job = test_db_session.query(Job).filter(Job.id == response.job_id).first()
        assert job is not None
        if job.thumbnail_s3_key:
            assert "?" not in job.thumbnail_s3_key, f"Job thumbnail_s3_key should be clean: {job.thumbnail_s3_key}"

    @pytest.mark.asyncio
    async def test_upload_handles_thumbnail_generation_failure(self, mock_s3_service, test_db_session, test_image_bytes):
        """Test that upload surfaces an error if thumbnail generation fails"""
        # Arrange
        file = UploadFile(
            filename="test.jpg",
            file=BytesIO(test_image_bytes),
            headers={"content-type": "image/jpeg"}
        )
        email = "test@example.com"
        
        # Make thumbnail generation fail
        mock_s3_service.generate_thumbnail.side_effect = Exception("Thumbnail generation failed")

        # Act / Assert - expect HTTP 500 due to required thumbnail
        with pytest.raises(HTTPException) as exc_info:
            await upload_and_process(
                file=file,
                email=email,
                db=test_db_session
            )

        assert exc_info.value.status_code == 500
        # Ensure no job records were persisted
        assert test_db_session.query(Job).count() == 0

    @pytest.mark.asyncio
    async def test_list_jobs_cleans_thumbnail_key(self, mock_s3_service, test_db_session):
        """Test that list_jobs endpoint cleans thumbnail keys before generating presigned URLs"""
        # Arrange - create a job with a dirty thumbnail key (simulating old bug)
        job = Job(email="test@example.com")
        job.thumbnail_s3_key = "thumbnails/test.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256"
        test_db_session.add(job)
        test_db_session.commit()
        
        # Mock presigned URL generation
        mock_s3_service.s3_client.generate_presigned_url.return_value = "https://presigned-url.com/thumbnails/test.jpg?X-Amz-Algorithm=..."

        # Act
        response = await list_jobs(db=test_db_session)

        # Assert
        # Verify clean_s3_key was called (indirectly by checking the key passed to generate_presigned_url)
        assert mock_s3_service.s3_client.generate_presigned_url.called
        
        # Get the key that was passed to generate_presigned_url
        call_args = mock_s3_service.s3_client.generate_presigned_url.call_args
        clean_key = call_args[1]['Params']['Key']
        
        # Verify the key is clean
        assert "?" not in clean_key, f"Key passed to generate_presigned_url should be clean: {clean_key}"
        assert clean_key == "thumbnails/test.jpg"

    @pytest.mark.asyncio
    async def test_get_job_cleans_thumbnail_key(self, mock_s3_service, test_db_session):
        """Test that get_job endpoint cleans thumbnail keys before generating presigned URLs"""
        # Arrange - create a job with a dirty thumbnail key
        job = Job(email="test@example.com")
        job.thumbnail_s3_key = "thumbnails/test.jpg%3FX-Amz-Algorithm%3D"
        test_db_session.add(job)
        test_db_session.commit()
        
        # Mock presigned URL generation
        mock_s3_service.s3_client.generate_presigned_url.return_value = "https://presigned-url.com/thumbnails/test.jpg"

        # Act
        response = await get_job(job_id=job.id, db=test_db_session)

        # Assert
        # Verify clean_s3_key was used
        assert mock_s3_service.s3_client.generate_presigned_url.called
        
        # Get the key that was passed
        call_args = mock_s3_service.s3_client.generate_presigned_url.call_args
        clean_key = call_args[1]['Params']['Key']
        
        # Verify the key is clean
        assert "?" not in clean_key
        assert "%3F" not in clean_key
        assert clean_key == "thumbnails/test.jpg"

