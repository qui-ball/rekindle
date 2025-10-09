"""
Tests for new job models
"""

import pytest
from app.models.jobs import Job, RestoreAttempt, AnimationAttempt


class TestJobModels:
    """Test suite for new job-based models"""

    def test_job_creation(self, job_factory):
        """Test creating a job"""
        job = job_factory(email="test@example.com")
        
        assert job.id is not None
        assert job.email == "test@example.com"
        assert job.created_at is not None
        assert job.selected_restore_id is None
        assert job.latest_animation_id is None

    def test_restore_attempt_creation(self, job_factory, restore_attempt_factory):
        """Test creating a restore attempt"""
        job = job_factory()
        restore = restore_attempt_factory(
            job_id=job.id,
            s3_key="uploaded/test.jpg",
            model="test_model",
            params={"denoise": 0.8}
        )
        
        assert restore.id is not None
        assert restore.job_id == job.id
        assert restore.s3_key == "uploaded/test.jpg"
        assert restore.model == "test_model"
        assert restore.params == {"denoise": 0.8}
        assert restore.created_at is not None

    def test_animation_attempt_creation(self, job_factory, animation_attempt_factory):
        """Test creating an animation attempt"""
        job = job_factory()
        animation = animation_attempt_factory(
            job_id=job.id,
            preview_s3_key="animated/test/preview.mp4",
            result_s3_key="animated/test/result.mp4",
            thumb_s3_key="thumbnails/test/thumb.jpg"
        )
        
        assert animation.id is not None
        assert animation.job_id == job.id
        assert animation.preview_s3_key == "animated/test/preview.mp4"
        assert animation.result_s3_key == "animated/test/result.mp4"
        assert animation.thumb_s3_key == "thumbnails/test/thumb.jpg"
        assert animation.created_at is not None

    def test_job_relationships(self, job_factory, restore_attempt_factory, animation_attempt_factory):
        """Test relationships between job, restore attempts, and animation attempts"""
        job = job_factory()
        
        # Create multiple restore attempts
        restore1 = restore_attempt_factory(job_id=job.id, s3_key="uploaded/img1.jpg")
        restore2 = restore_attempt_factory(job_id=job.id, s3_key="uploaded/img2.jpg")
        
        # Create animation based on restore
        animation = animation_attempt_factory(
            job_id=job.id, 
            restore_id=restore1.id,
            preview_s3_key="animated/test/anim1_preview.mp4"
        )
        
        # Update job to reference selected restore and latest animation
        job.selected_restore_id = restore1.id
        job.latest_animation_id = animation.id
        
        assert len(job.restore_attempts) == 2
        assert len(job.animation_attempts) == 1
        assert job.selected_restore_id == restore1.id
        assert job.latest_animation_id == animation.id

    def test_cascade_delete(self, job_factory, restore_attempt_factory, animation_attempt_factory, test_db_session):
        """Test that deleting a job cascades to restore and animation attempts"""
        job = job_factory()
        restore = restore_attempt_factory(job_id=job.id)
        animation = animation_attempt_factory(job_id=job.id)
        
        job_id = job.id
        restore_id = restore.id
        animation_id = animation.id
        
        # Delete the job
        test_db_session.delete(job)
        test_db_session.commit()
        
        # Verify cascaded deletion
        assert test_db_session.get(Job, job_id) is None
        assert test_db_session.get(RestoreAttempt, restore_id) is None
        assert test_db_session.get(AnimationAttempt, animation_id) is None