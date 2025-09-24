"""
Tests for restoration Celery tasks
"""

import pytest
from unittest.mock import patch, Mock
from uuid import UUID

from app.workers.tasks.restoration import process_restoration
from app.models.restoration import RestorationJob, JobStatus


class TestRestorationTasks:
    """Test suite for restoration Celery tasks"""

    @patch('app.workers.tasks.restoration.SessionLocal')
    @patch('app.workers.tasks.restoration.s3_service')
    @patch('app.workers.tasks.restoration.comfyui_service')
    def test_process_restoration_success(
        self, mock_comfyui, mock_s3, mock_session_local, restoration_job_factory
    ):
        """Test successful restoration processing"""
        # Arrange
        job = restoration_job_factory()
        job_id = str(job.id)
        
        # Setup mocks
        mock_db_session = Mock()
        mock_session_local.return_value = mock_db_session
        mock_db_session.query.return_value.filter.return_value.first.return_value = job
        
        mock_s3.download_file.return_value = b"fake_image_data"
        mock_comfyui.restore_image.return_value = b"processed_image_data"
        mock_s3.upload_image.return_value = "https://test.cloudfront.net/processed/result.jpg"

        # Act
        result = process_restoration(job_id)

        # Assert
        assert result["status"] == "success"
        assert result["job_id"] == job_id
        assert "processed_url" in result
        
        # Verify job status was updated to PROCESSING then COMPLETED
        assert job.status == JobStatus.COMPLETED
        assert job.processed_image_url == "https://test.cloudfront.net/processed/result.jpg"
        
        # Verify services were called correctly
        mock_s3.download_file.assert_called_once()
        mock_comfyui.restore_image.assert_called_once()
        mock_s3.upload_image.assert_called_once()
        mock_db_session.commit.assert_called()

    @patch('app.workers.tasks.restoration.SessionLocal')
    def test_process_restoration_job_not_found(self, mock_session_local):
        """Test handling of non-existent job"""
        # Arrange
        fake_job_id = str(UUID('12345678-1234-5678-9012-123456789012'))
        mock_db_session = Mock()
        mock_session_local.return_value = mock_db_session
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        # Act & Assert
        with pytest.raises(ValueError, match="Job .* not found"):
            process_restoration(fake_job_id)

    @patch('app.workers.tasks.restoration.SessionLocal')
    @patch('app.workers.tasks.restoration.s3_service')
    def test_process_restoration_s3_download_failure(
        self, mock_s3, mock_session_local, restoration_job_factory
    ):
        """Test handling of S3 download failure"""
        # Arrange
        job = restoration_job_factory()
        job_id = str(job.id)
        
        mock_db_session = Mock()
        mock_session_local.return_value = mock_db_session
        mock_db_session.query.return_value.filter.return_value.first.return_value = job
        
        mock_s3.download_file.side_effect = Exception("S3 download failed")

        # Act & Assert
        with pytest.raises(Exception, match="S3 download failed"):
            process_restoration(job_id)
        
        # Verify job status was set to FAILED
        assert job.status == JobStatus.FAILED
        assert job.error_message == "S3 download failed"

    @patch('app.workers.tasks.restoration.SessionLocal')
    @patch('app.workers.tasks.restoration.s3_service')
    @patch('app.workers.tasks.restoration.comfyui_service')
    def test_process_restoration_comfyui_failure(
        self, mock_comfyui, mock_s3, mock_session_local, restoration_job_factory
    ):
        """Test handling of ComfyUI processing failure"""
        # Arrange
        job = restoration_job_factory()
        job_id = str(job.id)
        
        mock_db_session = Mock()
        mock_session_local.return_value = mock_db_session
        mock_db_session.query.return_value.filter.return_value.first.return_value = job
        
        mock_s3.download_file.return_value = b"fake_image_data"
        mock_comfyui.restore_image.side_effect = Exception("ComfyUI processing failed")

        # Act & Assert
        with pytest.raises(Exception, match="ComfyUI processing failed"):
            process_restoration(job_id)
        
        # Verify job status was set to FAILED
        assert job.status == JobStatus.FAILED
        assert job.error_message == "ComfyUI processing failed"

    @patch('app.workers.tasks.restoration.SessionLocal')
    @patch('app.workers.tasks.restoration.s3_service')
    @patch('app.workers.tasks.restoration.comfyui_service')
    def test_process_restoration_s3_upload_failure(
        self, mock_comfyui, mock_s3, mock_session_local, restoration_job_factory
    ):
        """Test handling of S3 upload failure"""
        # Arrange
        job = restoration_job_factory()
        job_id = str(job.id)
        
        mock_db_session = Mock()
        mock_session_local.return_value = mock_db_session
        mock_db_session.query.return_value.filter.return_value.first.return_value = job
        
        mock_s3.download_file.return_value = b"fake_image_data"
        mock_comfyui.restore_image.return_value = b"processed_image_data"
        mock_s3.upload_image.side_effect = Exception("S3 upload failed")

        # Act & Assert
        with pytest.raises(Exception, match="S3 upload failed"):
            process_restoration(job_id)
        
        # Verify job status was set to FAILED
        assert job.status == JobStatus.FAILED
        assert job.error_message == "S3 upload failed"

    @patch('app.workers.tasks.restoration.SessionLocal')
    @patch('app.workers.tasks.restoration.s3_service')
    @patch('app.workers.tasks.restoration.comfyui_service')
    def test_process_restoration_status_transitions(
        self, mock_comfyui, mock_s3, mock_session_local, restoration_job_factory
    ):
        """Test job status transitions during processing"""
        # Arrange
        job = restoration_job_factory(status=JobStatus.PENDING)
        job_id = str(job.id)
        
        mock_db_session = Mock()
        mock_session_local.return_value = mock_db_session
        mock_db_session.query.return_value.filter.return_value.first.return_value = job
        
        mock_s3.download_file.return_value = b"fake_image_data"
        mock_comfyui.restore_image.return_value = b"processed_image_data"
        mock_s3.upload_image.return_value = "https://test.cloudfront.net/processed/result.jpg"

        # Act
        result = process_restoration(job_id)

        # Assert
        # Job should transition: PENDING -> PROCESSING -> COMPLETED
        assert job.status == JobStatus.COMPLETED
        assert result["status"] == "success"

    @patch('app.workers.tasks.restoration.SessionLocal')
    @patch('app.workers.tasks.restoration.s3_service')
    @patch('app.workers.tasks.restoration.comfyui_service')
    def test_process_restoration_denoise_parameter(
        self, mock_comfyui, mock_s3, mock_session_local, restoration_job_factory
    ):
        """Test that denoise parameter is passed correctly to ComfyUI"""
        # Arrange
        job = restoration_job_factory(denoise=0.5)
        job_id = str(job.id)
        
        mock_db_session = Mock()
        mock_session_local.return_value = mock_db_session
        mock_db_session.query.return_value.filter.return_value.first.return_value = job
        
        mock_s3.download_file.return_value = b"fake_image_data"
        mock_comfyui.restore_image.return_value = b"processed_image_data"
        mock_s3.upload_image.return_value = "https://test.cloudfront.net/processed/result.jpg"

        # Act
        process_restoration(job_id)

        # Assert
        mock_comfyui.restore_image.assert_called_once_with(
            image_data=b"fake_image_data",
            filename=f"job_{job_id}.jpg",
            denoise=0.5,
            megapixels=1.0,
        )

    @patch('app.workers.tasks.restoration.SessionLocal')
    @patch('app.workers.tasks.restoration.s3_service')
    @patch('app.workers.tasks.restoration.comfyui_service')
    def test_process_restoration_s3_key_extraction(
        self, mock_comfyui, mock_s3, mock_session_local, restoration_job_factory
    ):
        """Test S3 key extraction from CloudFront URL"""
        # Arrange
        job = restoration_job_factory(
            original_image_url="https://test.cloudfront.net/user123/original/image.jpg"
        )
        job_id = str(job.id)
        
        mock_db_session = Mock()
        mock_session_local.return_value = mock_db_session
        mock_db_session.query.return_value.filter.return_value.first.return_value = job
        
        mock_s3.download_file.return_value = b"fake_image_data"
        mock_comfyui.restore_image.return_value = b"processed_image_data"
        mock_s3.upload_image.return_value = "https://test.cloudfront.net/processed/result.jpg"

        # Act
        process_restoration(job_id)

        # Assert
        # Verify S3 key was extracted correctly from CloudFront URL
        expected_key = "user123/original/image.jpg"
        mock_s3.download_file.assert_called_once_with(expected_key)

    @patch('app.workers.tasks.restoration.SessionLocal')
    def test_process_restoration_database_error_handling(
        self, mock_session_local, restoration_job_factory
    ):
        """Test handling of database errors during status update"""
        # Arrange
        job = restoration_job_factory()
        job_id = str(job.id)
        
        mock_db_session = Mock()
        mock_session_local.return_value = mock_db_session
        
        # First query succeeds, but commit fails
        mock_db_session.query.return_value.filter.return_value.first.return_value = job
        mock_db_session.commit.side_effect = Exception("Database error")

        # Act & Assert
        with pytest.raises(Exception, match="Database error"):
            process_restoration(job_id)

    def test_process_restoration_integration_with_real_celery(
        self, celery_app, restoration_job_factory, mock_s3_service
    ):
        """Test restoration task with real Celery execution"""
        # Arrange
        job = restoration_job_factory()
        job_id = str(job.id)
        
        # Mock ComfyUI service for this integration test
        with patch('app.workers.tasks.restoration.comfyui_service') as mock_comfyui:
            mock_comfyui.restore_image.return_value = b"processed_image_data"
            
            # Act - Execute task with Celery eager mode
            result = process_restoration.apply(args=[job_id])
            
            # Assert
            assert result.successful()
            task_result = result.result
            assert task_result["status"] == "success"
            assert task_result["job_id"] == job_id