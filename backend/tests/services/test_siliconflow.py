"""
Unit tests for SiliconFlow service.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx

from app.services.siliconflow import (
    SiliconFlowService,
    SiliconFlowError,
    SiliconFlowErrorType,
    SiliconFlowRequest,
    SiliconFlowResponse,
    DEFAULT_RESTORATION_PROMPT,
    get_siliconflow_service,
)


# Test fixtures
@pytest.fixture
def mock_settings():
    """Mock settings for SiliconFlow service."""
    with patch("app.services.siliconflow.settings") as mock:
        mock.SILICONFLOW_API_KEY = "test-api-key"
        mock.SILICONFLOW_API_URL = "https://api.siliconflow.cn/v1/images/generations"
        mock.SILICONFLOW_MODEL = "Qwen/Qwen-Image-Edit"
        mock.SILICONFLOW_TIMEOUT = 120
        yield mock


@pytest.fixture
def siliconflow_service(mock_settings):
    """Create a SiliconFlow service instance for testing."""
    return SiliconFlowService()


@pytest.fixture
def mock_success_response():
    """Mock successful API response."""
    return {
        "images": [{"url": "https://cdn.siliconflow.cn/generated/test.jpg"}],
        "timings": {"inference": 12.5},
        "seed": 123456,
    }


@pytest.fixture
def mock_image_bytes():
    """Mock image bytes."""
    return b"fake-image-content"


class TestSiliconFlowDataclasses:
    """Tests for SiliconFlow dataclasses."""

    def test_request_dataclass(self):
        """Test SiliconFlowRequest creation."""
        request = SiliconFlowRequest(
            model="Qwen/Qwen-Image-Edit",
            prompt="Test prompt",
            image_url="https://example.com/image.jpg",
            num_inference_steps=30,
            guidance_scale=8.0,
        )

        assert request.model == "Qwen/Qwen-Image-Edit"
        assert request.prompt == "Test prompt"
        assert request.image_url == "https://example.com/image.jpg"
        assert request.num_inference_steps == 30
        assert request.guidance_scale == 8.0

    def test_response_dataclass(self):
        """Test SiliconFlowResponse creation."""
        response = SiliconFlowResponse(
            image_url="https://cdn.example.com/result.jpg",
            inference_time=15.5,
            seed=789,
        )

        assert response.image_url == "https://cdn.example.com/result.jpg"
        assert response.inference_time == 15.5
        assert response.seed == 789


class TestSiliconFlowError:
    """Tests for SiliconFlowError exception."""

    def test_error_creation(self):
        """Test SiliconFlowError creation with all fields."""
        error = SiliconFlowError(
            error_type=SiliconFlowErrorType.RATE_LIMIT_ERROR,
            message="Rate limited",
            status_code=429,
            retry_after=60,
        )

        assert error.error_type == SiliconFlowErrorType.RATE_LIMIT_ERROR
        assert error.message == "Rate limited"
        assert error.status_code == 429
        assert error.retry_after == 60

    def test_error_to_dict(self):
        """Test SiliconFlowError.to_dict() method."""
        error = SiliconFlowError(
            error_type=SiliconFlowErrorType.AUTHENTICATION_ERROR,
            message="Invalid API key",
            status_code=401,
        )

        error_dict = error.to_dict()

        assert error_dict["error_type"] == "authentication_error"
        assert error_dict["message"] == "Invalid API key"
        assert error_dict["status_code"] == 401
        assert error_dict["retry_after"] is None


class TestSiliconFlowServiceInit:
    """Tests for SiliconFlowService initialization."""

    def test_init_with_settings(self, mock_settings):
        """Test initialization with default settings."""
        service = SiliconFlowService()

        assert service.api_key == "test-api-key"
        assert service.api_url == "https://api.siliconflow.cn/v1/images/generations"
        assert service.model == "Qwen/Qwen-Image-Edit"
        assert service.timeout == 120

    def test_init_with_custom_values(self, mock_settings):
        """Test initialization with custom values."""
        service = SiliconFlowService(
            api_key="custom-key",
            api_url="https://custom.api.com",
            model="Custom/Model",
            timeout=60,
        )

        assert service.api_key == "custom-key"
        assert service.api_url == "https://custom.api.com"
        assert service.model == "Custom/Model"
        assert service.timeout == 60

    def test_init_without_api_key_raises_error(self):
        """Test that initialization without API key raises ValueError."""
        with patch("app.services.siliconflow.settings") as mock:
            mock.SILICONFLOW_API_KEY = ""
            mock.SILICONFLOW_API_URL = "https://api.example.com"
            mock.SILICONFLOW_MODEL = "Model"
            mock.SILICONFLOW_TIMEOUT = 120

            with pytest.raises(ValueError, match="SILICONFLOW_API_KEY is required"):
                SiliconFlowService()


class TestSiliconFlowServiceDownloadResult:
    """Tests for SiliconFlowService._download_result method."""

    @pytest.mark.asyncio
    async def test_download_result_success(self, siliconflow_service, mock_image_bytes):
        """Test successful image download."""
        mock_response = MagicMock()
        mock_response.content = mock_image_bytes
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            result = await siliconflow_service._download_result(
                "https://cdn.example.com/image.jpg"
            )

            assert result == mock_image_bytes

    @pytest.mark.asyncio
    async def test_download_result_timeout(self, siliconflow_service):
        """Test timeout during download."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(
                side_effect=httpx.TimeoutException("Timeout")
            )
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with pytest.raises(SiliconFlowError) as exc_info:
                await siliconflow_service._download_result(
                    "https://cdn.example.com/image.jpg"
                )

            assert exc_info.value.error_type == SiliconFlowErrorType.TIMEOUT_ERROR

    @pytest.mark.asyncio
    async def test_download_result_network_error(self, siliconflow_service):
        """Test network error during download."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.get = AsyncMock(
                side_effect=Exception("Connection failed")
            )
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with pytest.raises(SiliconFlowError) as exc_info:
                await siliconflow_service._download_result(
                    "https://cdn.example.com/image.jpg"
                )

            assert exc_info.value.error_type == SiliconFlowErrorType.NETWORK_ERROR


class TestSiliconFlowServiceRestoreImage:
    """Tests for SiliconFlowService.restore_image method."""

    @pytest.mark.asyncio
    async def test_restore_image_success(
        self, siliconflow_service, mock_success_response, mock_image_bytes
    ):
        """Test successful image restoration."""
        mock_api_response = MagicMock()
        mock_api_response.status_code = 200
        mock_api_response.json.return_value = mock_success_response
        mock_api_response.raise_for_status = MagicMock()

        mock_download_response = MagicMock()
        mock_download_response.content = mock_image_bytes
        mock_download_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_api_response)
            mock_client_instance.get = AsyncMock(return_value=mock_download_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            image_bytes, metadata = await siliconflow_service.restore_image(
                image_url="https://s3.example.com/photo.jpg"
            )

            assert image_bytes == mock_image_bytes
            assert metadata["provider"] == "siliconflow"
            assert metadata["inference_time_seconds"] == 12.5
            assert metadata["seed"] == 123456

    @pytest.mark.asyncio
    async def test_restore_image_with_custom_prompt(
        self, siliconflow_service, mock_success_response, mock_image_bytes
    ):
        """Test restoration with custom prompt."""
        mock_api_response = MagicMock()
        mock_api_response.status_code = 200
        mock_api_response.json.return_value = mock_success_response
        mock_api_response.raise_for_status = MagicMock()

        mock_download_response = MagicMock()
        mock_download_response.content = mock_image_bytes
        mock_download_response.raise_for_status = MagicMock()

        custom_prompt = "Enhance this vintage photo"

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_api_response)
            mock_client_instance.get = AsyncMock(return_value=mock_download_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            _, metadata = await siliconflow_service.restore_image(
                image_url="https://s3.example.com/photo.jpg",
                prompt=custom_prompt,
            )

            assert metadata["prompt"] == custom_prompt

    @pytest.mark.asyncio
    async def test_restore_image_with_custom_parameters(
        self, siliconflow_service, mock_success_response, mock_image_bytes
    ):
        """Test restoration with custom inference steps and guidance scale."""
        mock_api_response = MagicMock()
        mock_api_response.status_code = 200
        mock_api_response.json.return_value = mock_success_response
        mock_api_response.raise_for_status = MagicMock()

        mock_download_response = MagicMock()
        mock_download_response.content = mock_image_bytes
        mock_download_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_api_response)
            mock_client_instance.get = AsyncMock(return_value=mock_download_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            _, metadata = await siliconflow_service.restore_image(
                image_url="https://s3.example.com/photo.jpg",
                num_inference_steps=30,
                guidance_scale=8.5,
            )

            assert metadata["num_inference_steps"] == 30
            assert metadata["guidance_scale"] == 8.5

    @pytest.mark.asyncio
    async def test_restore_image_authentication_error(self, siliconflow_service):
        """Test 401 authentication error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with pytest.raises(SiliconFlowError) as exc_info:
                await siliconflow_service.restore_image(
                    image_url="https://s3.example.com/photo.jpg"
                )

            assert exc_info.value.error_type == SiliconFlowErrorType.AUTHENTICATION_ERROR
            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_restore_image_rate_limit_error(self, siliconflow_service):
        """Test 429 rate limit error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "60"}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with pytest.raises(SiliconFlowError) as exc_info:
                await siliconflow_service.restore_image(
                    image_url="https://s3.example.com/photo.jpg"
                )

            assert exc_info.value.error_type == SiliconFlowErrorType.RATE_LIMIT_ERROR
            assert exc_info.value.status_code == 429
            assert exc_info.value.retry_after == 60

    @pytest.mark.asyncio
    async def test_restore_image_invalid_image_error(self, siliconflow_service):
        """Test 400 invalid image error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.json.return_value = {
            "error": {"message": "Invalid image format"}
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with pytest.raises(SiliconFlowError) as exc_info:
                await siliconflow_service.restore_image(
                    image_url="https://s3.example.com/photo.jpg"
                )

            assert exc_info.value.error_type == SiliconFlowErrorType.INVALID_IMAGE_ERROR
            assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_restore_image_timeout_error(self, siliconflow_service):
        """Test timeout error handling."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(
                side_effect=httpx.TimeoutException("Request timed out")
            )
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with pytest.raises(SiliconFlowError) as exc_info:
                await siliconflow_service.restore_image(
                    image_url="https://s3.example.com/photo.jpg"
                )

            assert exc_info.value.error_type == SiliconFlowErrorType.TIMEOUT_ERROR

    @pytest.mark.asyncio
    async def test_restore_image_network_error(self, siliconflow_service):
        """Test network error handling."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(
                side_effect=httpx.RequestError("Connection failed")
            )
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with pytest.raises(SiliconFlowError) as exc_info:
                await siliconflow_service.restore_image(
                    image_url="https://s3.example.com/photo.jpg"
                )

            assert exc_info.value.error_type == SiliconFlowErrorType.NETWORK_ERROR

    @pytest.mark.asyncio
    async def test_restore_image_server_error(self, siliconflow_service):
        """Test 500 server error handling."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with pytest.raises(SiliconFlowError) as exc_info:
                await siliconflow_service.restore_image(
                    image_url="https://s3.example.com/photo.jpg"
                )

            assert exc_info.value.error_type == SiliconFlowErrorType.API_ERROR
            assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_restore_image_no_images_in_response(self, siliconflow_service):
        """Test handling of response with no images."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"images": []}
        mock_response.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client_instance = AsyncMock()
            mock_client_instance.post = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = mock_client_instance

            with pytest.raises(SiliconFlowError) as exc_info:
                await siliconflow_service.restore_image(
                    image_url="https://s3.example.com/photo.jpg"
                )

            assert exc_info.value.error_type == SiliconFlowErrorType.API_ERROR
            assert "No images returned" in exc_info.value.message


class TestGetSiliconFlowService:
    """Tests for get_siliconflow_service function."""

    def test_get_service_singleton(self, mock_settings):
        """Test that get_siliconflow_service returns singleton."""
        # Reset global instance
        import app.services.siliconflow as module
        module._siliconflow_service = None

        service1 = get_siliconflow_service()
        service2 = get_siliconflow_service()

        assert service1 is service2

        # Clean up
        module._siliconflow_service = None


@pytest.mark.integration
class TestSiliconFlowIntegration:
    """Integration tests that call the real SiliconFlow API.

    These tests are skipped by default. To run them:
    1. Set SILICONFLOW_API_KEY in your .env file
    2. Run: pytest tests/services/test_siliconflow.py -v -m integration

    Note: These tests will consume API credits.
    """

    @pytest.fixture
    def real_service(self):
        """Create a real SiliconFlow service using actual credentials."""
        import os
        api_key = os.environ.get("SILICONFLOW_API_KEY")
        if not api_key or api_key == "sk-placeholder":
            pytest.skip("SILICONFLOW_API_KEY not configured for integration tests")

        return SiliconFlowService(
            api_key=api_key,
            api_url="https://api.siliconflow.com/v1/images/generations",
            model="Qwen/Qwen-Image-Edit",
            timeout=120,
        )

    @pytest.fixture
    def test_image_url(self):
        """Provide a publicly accessible test image URL.

        Note: For real integration tests, you should use a presigned S3 URL
        to a test image that you control.
        """
        # Using picsum.photos which provides reliable test images
        # In production, use a presigned S3 URL to your own test image
        return "https://picsum.photos/id/1/400/300"

    @pytest.mark.asyncio
    async def test_restore_image_real_api(self, real_service, test_image_url):
        """Test restoration with real SiliconFlow API.

        This test verifies:
        1. API connection works
        2. Image is successfully restored
        3. Response contains expected metadata
        """
        image_bytes, metadata = await real_service.restore_image(
            image_url=test_image_url,
            prompt="Enhance this image clarity and colors.",
            num_inference_steps=10,  # Lower for faster test
            guidance_scale=7.5,
        )

        # Verify we got image bytes back
        assert isinstance(image_bytes, bytes)
        assert len(image_bytes) > 1000  # Should be a real image

        # Verify metadata
        assert metadata["provider"] == "siliconflow"
        assert metadata["model"] == "Qwen/Qwen-Image-Edit"
        assert "inference_time_seconds" in metadata
        assert "seed" in metadata

        # Verify it's a valid image
        from PIL import Image
        from io import BytesIO
        img = Image.open(BytesIO(image_bytes))
        assert img.size[0] > 0
        assert img.size[1] > 0
