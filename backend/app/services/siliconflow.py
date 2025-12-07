"""
SiliconFlow API service for image restoration using Qwen-Image-Edit.

This service handles API communication with SiliconFlow's image generation endpoint
for photo restoration tasks.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional

import httpx
from loguru import logger

from app.core.config import settings


# Default restoration prompt
DEFAULT_RESTORATION_PROMPT = (
    "Restore this old damaged photo. Enhance clarity, remove scratches and damage, "
    "improve colors while preserving original details and authenticity."
)


class SiliconFlowErrorType(str, Enum):
    """Error types for SiliconFlow API errors."""

    AUTHENTICATION_ERROR = "authentication_error"
    RATE_LIMIT_ERROR = "rate_limit_error"
    INVALID_IMAGE_ERROR = "invalid_image_error"
    TIMEOUT_ERROR = "timeout_error"
    NETWORK_ERROR = "network_error"
    API_ERROR = "api_error"


class SiliconFlowError(Exception):
    """Exception raised for SiliconFlow API errors."""

    def __init__(
        self,
        error_type: SiliconFlowErrorType,
        message: str,
        status_code: Optional[int] = None,
        retry_after: Optional[int] = None,
    ):
        self.error_type = error_type
        self.message = message
        self.status_code = status_code
        self.retry_after = retry_after
        super().__init__(message)

    def to_dict(self) -> dict:
        """Convert error to dictionary for storage."""
        return {
            "error_type": self.error_type.value,
            "message": self.message,
            "status_code": self.status_code,
            "retry_after": self.retry_after,
        }


@dataclass
class SiliconFlowRequest:
    """Request data for SiliconFlow API."""

    model: str
    prompt: str
    image_url: str
    num_inference_steps: int = 20
    guidance_scale: float = 7.5


@dataclass
class SiliconFlowResponse:
    """Response data from SiliconFlow API."""

    image_url: str  # CDN URL (valid for 1 hour)
    inference_time: float  # Seconds
    seed: int


class SiliconFlowService:
    """Service for interacting with SiliconFlow's Qwen-Image-Edit API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        api_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        """
        Initialize SiliconFlow service.

        Args:
            api_key: SiliconFlow API key (defaults to settings.SILICONFLOW_API_KEY)
            api_url: API endpoint URL (defaults to settings.SILICONFLOW_API_URL)
            model: Model identifier (defaults to settings.SILICONFLOW_MODEL)
            timeout: Request timeout in seconds (defaults to settings.SILICONFLOW_TIMEOUT)
        """
        self.api_key = api_key or settings.SILICONFLOW_API_KEY
        self.api_url = api_url or settings.SILICONFLOW_API_URL
        self.model = model or settings.SILICONFLOW_MODEL
        self.timeout = timeout or settings.SILICONFLOW_TIMEOUT

        # Validate required settings
        if not self.api_key:
            raise ValueError(
                "SILICONFLOW_API_KEY is required. "
                "Set it in your .env file or pass it to the constructor."
            )

        logger.info(
            f"SiliconFlow service initialized: model={self.model}, "
            f"timeout={self.timeout}s"
        )

    async def _download_result(self, url: str) -> bytes:
        """
        Download the generated image from SiliconFlow CDN.

        Args:
            url: CDN URL for the generated image

        Returns:
            Image bytes

        Raises:
            SiliconFlowError: If download fails
        """
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.content
        except httpx.TimeoutException as e:
            logger.error(f"Timeout downloading result from {url}: {e}")
            raise SiliconFlowError(
                error_type=SiliconFlowErrorType.TIMEOUT_ERROR,
                message="Timeout downloading restored image",
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error downloading result: {e}")
            raise SiliconFlowError(
                error_type=SiliconFlowErrorType.API_ERROR,
                message=f"Failed to download restored image: {e.response.status_code}",
                status_code=e.response.status_code,
            )
        except Exception as e:
            logger.error(f"Network error downloading result: {e}")
            raise SiliconFlowError(
                error_type=SiliconFlowErrorType.NETWORK_ERROR,
                message=f"Network error downloading restored image: {e}",
            )

    async def restore_image(
        self,
        image_url: str,
        prompt: Optional[str] = None,
        num_inference_steps: int = 20,
        guidance_scale: float = 7.5,
    ) -> tuple[bytes, dict]:
        """
        Restore an image using SiliconFlow's Qwen-Image-Edit API.

        Args:
            image_url: Presigned S3 URL for the source image
            prompt: Custom restoration prompt (defaults to DEFAULT_RESTORATION_PROMPT)
            num_inference_steps: Number of inference steps (default: 20)
            guidance_scale: Guidance scale for generation (default: 7.5)

        Returns:
            Tuple of (restored image bytes, metadata dict)

        Raises:
            SiliconFlowError: If API call or download fails
        """
        prompt = prompt or DEFAULT_RESTORATION_PROMPT

        logger.info(f"Submitting restoration request to SiliconFlow: model={self.model}")
        logger.debug(f"Image URL: {image_url[:100]}...")
        logger.debug(f"Prompt: {prompt[:100]}...")

        # Build request payload
        payload = {
            "model": self.model,
            "prompt": prompt,
            "image": image_url,
            "num_inference_steps": num_inference_steps,
            "guidance_scale": guidance_scale,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.api_url,
                    json=payload,
                    headers=headers,
                )

                # Handle error responses
                if response.status_code == 401:
                    raise SiliconFlowError(
                        error_type=SiliconFlowErrorType.AUTHENTICATION_ERROR,
                        message="Invalid SiliconFlow API key",
                        status_code=401,
                    )
                elif response.status_code == 429:
                    retry_after = response.headers.get("Retry-After")
                    raise SiliconFlowError(
                        error_type=SiliconFlowErrorType.RATE_LIMIT_ERROR,
                        message="SiliconFlow rate limit exceeded",
                        status_code=429,
                        retry_after=int(retry_after) if retry_after else None,
                    )
                elif response.status_code == 400:
                    error_detail = response.json().get("error", {}).get("message", "Bad request")
                    raise SiliconFlowError(
                        error_type=SiliconFlowErrorType.INVALID_IMAGE_ERROR,
                        message=f"Invalid request: {error_detail}",
                        status_code=400,
                    )
                elif response.status_code >= 500:
                    raise SiliconFlowError(
                        error_type=SiliconFlowErrorType.API_ERROR,
                        message=f"SiliconFlow server error: {response.status_code}",
                        status_code=response.status_code,
                    )

                response.raise_for_status()

                # Parse response
                data = response.json()
                images = data.get("images", [])
                if not images:
                    raise SiliconFlowError(
                        error_type=SiliconFlowErrorType.API_ERROR,
                        message="No images returned from SiliconFlow API",
                    )

                result_url = images[0].get("url")
                if not result_url:
                    raise SiliconFlowError(
                        error_type=SiliconFlowErrorType.API_ERROR,
                        message="No URL in SiliconFlow response",
                    )

                inference_time = data.get("timings", {}).get("inference", 0)
                seed = data.get("seed", 0)

                logger.info(
                    f"SiliconFlow restoration completed: "
                    f"inference_time={inference_time}s, seed={seed}"
                )

                # Download the result
                image_bytes = await self._download_result(result_url)

                # Build metadata
                metadata = {
                    "provider": "siliconflow",
                    "model": self.model,
                    "prompt": prompt,
                    "num_inference_steps": num_inference_steps,
                    "guidance_scale": guidance_scale,
                    "inference_time_seconds": inference_time,
                    "seed": seed,
                }

                return image_bytes, metadata

        except httpx.TimeoutException as e:
            logger.error(f"Timeout calling SiliconFlow API: {e}")
            raise SiliconFlowError(
                error_type=SiliconFlowErrorType.TIMEOUT_ERROR,
                message="SiliconFlow API request timed out",
            )
        except httpx.RequestError as e:
            logger.error(f"Network error calling SiliconFlow API: {e}")
            raise SiliconFlowError(
                error_type=SiliconFlowErrorType.NETWORK_ERROR,
                message=f"Network error: {e}",
            )
        except SiliconFlowError:
            # Re-raise our own errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling SiliconFlow API: {e}")
            raise SiliconFlowError(
                error_type=SiliconFlowErrorType.API_ERROR,
                message=f"Unexpected error: {e}",
            )


# Global service instance (lazy initialization)
_siliconflow_service: Optional[SiliconFlowService] = None


def get_siliconflow_service() -> SiliconFlowService:
    """Get or create the SiliconFlow service instance (lazy initialization)."""
    global _siliconflow_service
    if _siliconflow_service is None:
        _siliconflow_service = SiliconFlowService()
    return _siliconflow_service
