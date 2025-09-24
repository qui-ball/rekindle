"""
Tests for restoration API endpoints
"""

import pytest
import pytest_asyncio
from unittest.mock import patch, Mock
from httpx import AsyncClient
from uuid import uuid4
import io

from app.models.restoration import RestorationJob, JobStatus


@pytest.mark.anyio
class TestRestorationAPI:
    """Test suite for restoration API endpoints"""

    async def test_create_restoration_job_success(
        self,
        async_client: AsyncClient,
        mock_s3_service,
        mock_celery_task,
        test_image_bytes,
    ):
        """Test successful restoration job creation"""
        # Arrange
        files = {"file": ("test.jpg", test_image_bytes, "image/jpeg")}
        data = {"denoise": 0.8}

        # Act
        response = await async_client.post(
            "/api/v1/restoration/restore", files=files, data=data
        )

        # Assert
        assert response.status_code == 200
        result = response.json()
        assert "job_id" in result
        assert result["status"] == "pending"
        assert result["message"] == "Restoration job created and queued for processing"

        # Verify S3 upload was called
        mock_s3_service.upload_image.assert_called_once()
        # Verify Celery task was queued
        mock_celery_task.delay.assert_called_once()

    async def test_create_restoration_job_invalid_file_type(
        self, async_client: AsyncClient, test_image_bytes
    ):
        """Test rejection of invalid file types"""
        # Arrange
        files = {"file": ("test.txt", b"not an image", "text/plain")}

        # Act
        response = await async_client.post("/api/v1/restoration/restore", files=files)

        # Assert
        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]

    async def test_create_restoration_job_file_too_large(
        self, async_client: AsyncClient, test_large_image_bytes
    ):
        """Test rejection of files exceeding size limit"""
        # Arrange
        files = {"file": ("large.jpg", test_large_image_bytes, "image/jpeg")}

        # Act
        response = await async_client.post("/api/v1/restoration/restore", files=files)

        # Assert
        assert response.status_code == 413
        assert "File size exceeds 50MB limit" in response.json()["detail"]

    @pytest.mark.parametrize(
        "file_type",
        [
            ("image/jpeg", "test.jpg"),
            ("image/png", "test.png"),
            ("image/heic", "test.heic"),
            ("image/webp", "test.webp"),
        ],
    )
    async def test_create_restoration_job_supported_formats(
        self,
        async_client: AsyncClient,
        mock_s3_service,
        mock_celery_task,
        test_image_bytes,
        file_type,
    ):
        """Test all supported image formats are accepted"""
        # Arrange
        mime_type, filename = file_type
        files = {"file": (filename, test_image_bytes, mime_type)}

        # Act
        response = await async_client.post("/api/v1/restoration/restore", files=files)

        # Assert
        assert response.status_code == 200

    async def test_create_restoration_job_custom_denoise(
        self,
        async_client: AsyncClient,
        mock_s3_service,
        mock_celery_task,
        test_image_bytes,
    ):
        """Test restoration job creation with custom denoise parameter"""
        # Arrange
        files = {"file": ("test.jpg", test_image_bytes, "image/jpeg")}
        data = {"denoise": 0.5}

        # Act
        response = await async_client.post(
            "/api/v1/restoration/restore", files=files, data=data
        )

        # Assert
        assert response.status_code == 200

    async def test_create_restoration_job_denoise_validation(
        self, async_client: AsyncClient, test_image_bytes
    ):
        """Test denoise parameter validation"""
        # Arrange
        files = {"file": ("test.jpg", test_image_bytes, "image/jpeg")}

        # Test invalid denoise values
        for invalid_value in [-0.1, 1.1, "invalid"]:
            data = {"denoise": invalid_value}

            # Act
            response = await async_client.post(
                "/api/v1/restoration/restore", files=files, data=data
            )

            # Assert
            assert response.status_code == 422

    async def test_create_restoration_job_s3_upload_failure(
        self, async_client: AsyncClient, mock_celery_task, test_image_bytes
    ):
        """Test handling of S3 upload failures"""
        # Arrange
        with patch("app.services.s3.s3_service") as mock_s3:
            mock_s3.upload_image.side_effect = Exception("S3 upload failed")
            files = {"file": ("test.jpg", test_image_bytes, "image/jpeg")}

            # Act
            response = await async_client.post(
                "/api/v1/restoration/restore", files=files
            )

            # Assert
            assert response.status_code == 500
            assert "Error creating restoration job" in response.json()["detail"]

    async def test_get_job_status_success(
        self, async_client: AsyncClient, restoration_job_factory
    ):
        """Test successful job status retrieval"""
        # Arrange
        job = restoration_job_factory(status=JobStatus.PROCESSING)

        # Act
        response = await async_client.get(f"/api/v1/restoration/jobs/{job.id}")

        # Assert
        assert response.status_code == 200
        result = response.json()
        assert result["id"] == str(job.id)
        assert result["status"] == "processing"
        assert result["original_image_url"] == job.original_image_url

    async def test_get_job_status_not_found(self, async_client: AsyncClient):
        """Test job status retrieval for non-existent job"""
        # Arrange
        fake_job_id = uuid4()

        # Act
        response = await async_client.get(f"/api/v1/restoration/jobs/{fake_job_id}")

        # Assert
        assert response.status_code == 404
        assert "Job not found" in response.json()["detail"]

    async def test_get_job_status_unauthorized(
        self, async_client: AsyncClient, restoration_job_factory
    ):
        """Test job status retrieval for job belonging to another user"""
        # Arrange
        job = restoration_job_factory(user_id="other_user")

        # Act
        response = await async_client.get(f"/api/v1/restoration/jobs/{job.id}")

        # Assert
        assert response.status_code == 404
        assert "Job not found" in response.json()["detail"]

    async def test_list_user_jobs_success(
        self, async_client: AsyncClient, restoration_job_factory
    ):
        """Test successful listing of user jobs"""
        # Arrange
        job1 = restoration_job_factory(status=JobStatus.COMPLETED)
        job2 = restoration_job_factory(status=JobStatus.PROCESSING)
        # Create job for another user (should not be returned)
        restoration_job_factory(user_id="other_user")

        # Act
        response = await async_client.get("/api/v1/restoration/jobs")

        # Assert
        assert response.status_code == 200
        jobs = response.json()
        assert len(jobs) == 2

        # Should be ordered by created_at desc
        job_ids = [job["id"] for job in jobs]
        assert str(job2.id) in job_ids
        assert str(job1.id) in job_ids

    async def test_list_user_jobs_pagination(
        self, async_client: AsyncClient, restoration_job_factory
    ):
        """Test job listing with pagination"""
        # Arrange
        jobs = [restoration_job_factory() for _ in range(5)]

        # Act
        response = await async_client.get("/api/v1/restoration/jobs?limit=2&offset=1")

        # Assert
        assert response.status_code == 200
        result_jobs = response.json()
        assert len(result_jobs) == 2

    async def test_list_user_jobs_empty(self, async_client: AsyncClient):
        """Test job listing when user has no jobs"""
        # Act
        response = await async_client.get("/api/v1/restoration/jobs")

        # Assert
        assert response.status_code == 200
        jobs = response.json()
        assert jobs == []

    async def test_authentication_required(self):
        """Test that authentication is required for all endpoints"""
        # Remove authentication override
        from app.main import app
        from app.api.deps import get_current_user

        if get_current_user in app.dependency_overrides:
            del app.dependency_overrides[get_current_user]

        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            # Test all endpoints require auth
            endpoints = [
                ("POST", "/api/v1/restoration/restore"),
                ("GET", f"/api/v1/restoration/jobs/{uuid4()}"),
                ("GET", "/api/v1/restoration/jobs"),
            ]

            for method, endpoint in endpoints:
                if method == "POST":
                    response = await client.post(
                        endpoint, files={"file": ("test.jpg", b"data", "image/jpeg")}
                    )
                else:
                    response = await client.get(endpoint)

                assert response.status_code == 403
