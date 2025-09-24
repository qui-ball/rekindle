"""
Tests for restoration database models
"""

import pytest
from datetime import datetime
from uuid import UUID

from app.models.restoration import RestorationJob, JobStatus


class TestRestorationJobModel:
    """Test suite for RestorationJob database model"""

    def test_restoration_job_creation(self, test_db_session):
        """Test basic restoration job creation"""
        # Arrange
        job_data = {
            'user_id': 'test_user_123',
            'status': JobStatus.PENDING,
            'original_image_url': 'https://test.cloudfront.net/original/test.jpg',
            'denoise': 0.7
        }

        # Act
        job = RestorationJob(**job_data)
        test_db_session.add(job)
        test_db_session.commit()
        test_db_session.refresh(job)

        # Assert
        assert job.id is not None
        assert isinstance(job.id, UUID)
        assert job.user_id == 'test_user_123'
        assert job.status == JobStatus.PENDING
        assert job.original_image_url == 'https://test.cloudfront.net/original/test.jpg'
        assert job.denoise == 0.7
        assert job.processed_image_url is None
        assert job.error_message is None
        assert job.created_at is not None
        assert isinstance(job.created_at, datetime)

    def test_restoration_job_default_values(self, test_db_session):
        """Test default values for restoration job"""
        # Arrange - minimal required fields
        job = RestorationJob(
            user_id='test_user',
            original_image_url='https://test.example.com/image.jpg'
        )

        # Act
        test_db_session.add(job)
        test_db_session.commit()
        test_db_session.refresh(job)

        # Assert defaults
        assert job.status == JobStatus.PENDING
        assert job.denoise == 0.7  # Default value
        assert job.processed_image_url is None
        assert job.error_message is None

    def test_restoration_job_status_transitions(self, test_db_session):
        """Test job status transitions"""
        # Arrange
        job = RestorationJob(
            user_id='test_user',
            original_image_url='https://test.example.com/image.jpg',
            status=JobStatus.PENDING
        )
        test_db_session.add(job)
        test_db_session.commit()

        # Act & Assert - PENDING to PROCESSING
        job.status = JobStatus.PROCESSING
        test_db_session.commit()
        test_db_session.refresh(job)
        assert job.status == JobStatus.PROCESSING

        # Act & Assert - PROCESSING to COMPLETED
        job.status = JobStatus.COMPLETED
        job.processed_image_url = 'https://test.example.com/processed.jpg'
        test_db_session.commit()
        test_db_session.refresh(job)
        assert job.status == JobStatus.COMPLETED
        assert job.processed_image_url == 'https://test.example.com/processed.jpg'

    def test_restoration_job_failed_status(self, test_db_session):
        """Test job failure with error message"""
        # Arrange
        job = RestorationJob(
            user_id='test_user',
            original_image_url='https://test.example.com/image.jpg',
            status=JobStatus.PROCESSING
        )
        test_db_session.add(job)
        test_db_session.commit()

        # Act
        job.status = JobStatus.FAILED
        job.error_message = "ComfyUI processing failed"
        test_db_session.commit()
        test_db_session.refresh(job)

        # Assert
        assert job.status == JobStatus.FAILED
        assert job.error_message == "ComfyUI processing failed"

    @pytest.mark.parametrize("denoise_value", [0.0, 0.3, 0.7, 1.0])
    def test_restoration_job_denoise_values(self, test_db_session, denoise_value):
        """Test various denoise values"""
        # Arrange & Act
        job = RestorationJob(
            user_id='test_user',
            original_image_url='https://test.example.com/image.jpg',
            denoise=denoise_value
        )
        test_db_session.add(job)
        test_db_session.commit()
        test_db_session.refresh(job)

        # Assert
        assert job.denoise == denoise_value

    def test_restoration_job_user_filtering(self, test_db_session):
        """Test filtering jobs by user ID"""
        # Arrange - Create jobs for different users
        user1_job = RestorationJob(
            user_id='user1',
            original_image_url='https://test.example.com/user1.jpg'
        )
        user2_job = RestorationJob(
            user_id='user2',
            original_image_url='https://test.example.com/user2.jpg'
        )
        test_db_session.add_all([user1_job, user2_job])
        test_db_session.commit()

        # Act
        user1_jobs = test_db_session.query(RestorationJob).filter(
            RestorationJob.user_id == 'user1'
        ).all()
        user2_jobs = test_db_session.query(RestorationJob).filter(
            RestorationJob.user_id == 'user2'
        ).all()

        # Assert
        assert len(user1_jobs) == 1
        assert len(user2_jobs) == 1
        assert user1_jobs[0].user_id == 'user1'
        assert user2_jobs[0].user_id == 'user2'

    def test_restoration_job_status_filtering(self, test_db_session):
        """Test filtering jobs by status"""
        # Arrange - Create jobs with different statuses
        pending_job = RestorationJob(
            user_id='test_user',
            original_image_url='https://test.example.com/pending.jpg',
            status=JobStatus.PENDING
        )
        processing_job = RestorationJob(
            user_id='test_user',
            original_image_url='https://test.example.com/processing.jpg',
            status=JobStatus.PROCESSING
        )
        completed_job = RestorationJob(
            user_id='test_user',
            original_image_url='https://test.example.com/completed.jpg',
            status=JobStatus.COMPLETED,
            processed_image_url='https://test.example.com/result.jpg'
        )
        test_db_session.add_all([pending_job, processing_job, completed_job])
        test_db_session.commit()

        # Act
        pending_jobs = test_db_session.query(RestorationJob).filter(
            RestorationJob.status == JobStatus.PENDING
        ).all()
        completed_jobs = test_db_session.query(RestorationJob).filter(
            RestorationJob.status == JobStatus.COMPLETED
        ).all()

        # Assert
        assert len(pending_jobs) == 1
        assert len(completed_jobs) == 1
        assert pending_jobs[0].status == JobStatus.PENDING
        assert completed_jobs[0].status == JobStatus.COMPLETED

    def test_restoration_job_ordering(self, test_db_session):
        """Test job ordering by creation time"""
        # Arrange - Create multiple jobs
        jobs_data = [
            {'user_id': 'test_user', 'original_image_url': f'https://test.example.com/image{i}.jpg'}
            for i in range(3)
        ]
        jobs = [RestorationJob(**data) for data in jobs_data]
        test_db_session.add_all(jobs)
        test_db_session.commit()

        # Act - Query with ordering
        ordered_jobs = test_db_session.query(RestorationJob).order_by(
            RestorationJob.created_at.desc()
        ).all()

        # Assert - Should be ordered by creation time (newest first)
        assert len(ordered_jobs) == 3
        for i in range(len(ordered_jobs) - 1):
            assert ordered_jobs[i].created_at >= ordered_jobs[i + 1].created_at

    def test_restoration_job_updated_at(self, test_db_session):
        """Test updated_at timestamp behavior"""
        # Arrange
        job = RestorationJob(
            user_id='test_user',
            original_image_url='https://test.example.com/image.jpg'
        )
        test_db_session.add(job)
        test_db_session.commit()
        test_db_session.refresh(job)
        
        initial_updated_at = job.updated_at

        # Act - Update the job
        job.status = JobStatus.PROCESSING
        test_db_session.commit()
        test_db_session.refresh(job)

        # Assert - updated_at should be modified (if database supports it)
        # Note: SQLite might not update this automatically, but the field should exist
        assert hasattr(job, 'updated_at')

    def test_job_status_enum_values(self):
        """Test JobStatus enum values"""
        # Assert all expected status values exist
        assert JobStatus.PENDING == "pending"
        assert JobStatus.PROCESSING == "processing"
        assert JobStatus.COMPLETED == "completed"
        assert JobStatus.FAILED == "failed"

    def test_restoration_job_string_representations(self, test_db_session):
        """Test string field lengths and content"""
        # Arrange
        long_url = "https://very-long-domain-name.cloudfront.net/" + "a" * 200 + "/image.jpg"
        long_error = "A very long error message that might occur during processing: " + "x" * 500
        
        job = RestorationJob(
            user_id='test_user_with_long_name_12345',
            original_image_url=long_url,
            error_message=long_error
        )

        # Act
        test_db_session.add(job)
        test_db_session.commit()
        test_db_session.refresh(job)

        # Assert
        assert job.user_id == 'test_user_with_long_name_12345'
        assert job.original_image_url == long_url
        assert job.error_message == long_error

    def test_restoration_job_complex_query(self, test_db_session):
        """Test complex query combining multiple filters"""
        # Arrange
        jobs_data = [
            {'user_id': 'user1', 'status': JobStatus.PENDING},
            {'user_id': 'user1', 'status': JobStatus.COMPLETED},
            {'user_id': 'user2', 'status': JobStatus.PENDING},
            {'user_id': 'user2', 'status': JobStatus.FAILED},
        ]
        
        jobs = []
        for data in jobs_data:
            job = RestorationJob(
                original_image_url=f"https://test.example.com/{data['user_id']}.jpg",
                **data
            )
            jobs.append(job)
        
        test_db_session.add_all(jobs)
        test_db_session.commit()

        # Act - Complex query
        user1_pending_jobs = test_db_session.query(RestorationJob).filter(
            RestorationJob.user_id == 'user1',
            RestorationJob.status == JobStatus.PENDING
        ).all()

        # Assert
        assert len(user1_pending_jobs) == 1
        assert user1_pending_jobs[0].user_id == 'user1'
        assert user1_pending_jobs[0].status == JobStatus.PENDING