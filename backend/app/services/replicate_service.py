"""
Replicate API service for image restoration using Qwen-Image-Edit-2511.

This service handles API communication with Replicate's image editing endpoint
for photo restoration tasks.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional

import httpx
import replicate
from loguru import logger

from app.core.config import settings


# Default restoration prompt
DEFAULT_RESTORATION_PROMPT = (
    "Restore this old damaged photo. Enhance clarity, remove scratches and damage, "
    "improve colors while preserving original details and authenticity."
)


class ReplicateErrorType(str, Enum):
    """Error types for Replicate API errors."""

    AUTHENTICATION_ERROR = "authentication_error"
    RATE_LIMIT_ERROR = "rate_limit_error"
    INVALID_IMAGE_ERROR = "invalid_image_error"
    TIMEOUT_ERROR = "timeout_error"
    NETWORK_ERROR = "network_error"
    API_ERROR = "api_error"


class ReplicateError(Exception):
    """Exception raised for Replicate API errors."""

    def __init__(
        self,
        error_type: ReplicateErrorType,
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
class ReplicateRequest:
    """Request data for Replicate API."""

    model: str
    prompt: str
    image_url: str
    seed: Optional[int] = None
    output_format: str = "jpg"
    output_quality: int = 95


@dataclass
class ReplicateResponse:
    """Response data from Replicate API."""

    image_url: str
    seed: Optional[int] = None


class ReplicateService:
    """Service for interacting with Replicate's Qwen-Image-Edit-2511 API."""

    def __init__(
        self,
        api_token: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[int] = None,
    ):
        """
        Initialize Replicate service.

        Args:
            api_token: Replicate API token (defaults to settings.REPLICATE_API_TOKEN)
            model: Model identifier (defaults to settings.REPLICATE_MODEL)
            timeout: Request timeout in seconds (defaults to settings.REPLICATE_TIMEOUT)
        """
        self.api_token = api_token or settings.REPLICATE_API_TOKEN
        self.model = model or settings.REPLICATE_MODEL
        self.timeout = timeout or settings.REPLICATE_TIMEOUT

        # Validate required settings
        if not self.api_token:
            raise ValueError(
                "REPLICATE_API_TOKEN is required. "
                "Set it in your .env file or pass it to the constructor."
            )

        # Set the API token for the replicate library
        replicate.api_token = self.api_token

        # Create a client instance for API calls
        self._client = replicate.Client(api_token=self.api_token)

        logger.info(
            f"Replicate service initialized: model={self.model}, "
            f"timeout={self.timeout}s"
        )

    async def _download_result(self, url: str) -> bytes:
        """
        Download the generated image from Replicate CDN.

        Args:
            url: CDN URL for the generated image

        Returns:
            Image bytes

        Raises:
            ReplicateError: If download fails
        """
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.content
        except httpx.TimeoutException as e:
            logger.error(f"Timeout downloading result from {url}: {e}")
            raise ReplicateError(
                error_type=ReplicateErrorType.TIMEOUT_ERROR,
                message="Timeout downloading restored image",
            )
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error downloading result: {e}")
            raise ReplicateError(
                error_type=ReplicateErrorType.API_ERROR,
                message=f"Failed to download restored image: {e.response.status_code}",
                status_code=e.response.status_code,
            )
        except Exception as e:
            logger.error(f"Network error downloading result: {e}")
            raise ReplicateError(
                error_type=ReplicateErrorType.NETWORK_ERROR,
                message=f"Network error downloading restored image: {e}",
            )

    async def restore_image(
        self,
        image_url: str,
        prompt: Optional[str] = None,
        seed: Optional[int] = None,
        output_format: str = "jpg",
        output_quality: int = 95,
    ) -> tuple[bytes, dict]:
        """
        Restore an image using Replicate's Qwen-Image-Edit-2511 API.

        Args:
            image_url: Presigned S3 URL for the source image
            prompt: Custom restoration prompt (defaults to DEFAULT_RESTORATION_PROMPT)
            seed: Optional random seed for reproducibility
            output_format: Output format (jpg, png, webp)
            output_quality: Output quality 0-100 (default: 95)

        Returns:
            Tuple of (restored image bytes, metadata dict)

        Raises:
            ReplicateError: If API call or download fails
        """
        prompt = prompt or DEFAULT_RESTORATION_PROMPT

        logger.info(f"Submitting restoration request to Replicate: model={self.model}")
        logger.debug(f"Image URL: {image_url[:100]}...")
        logger.debug(f"Prompt: {prompt[:100]}...")

        # Build input payload
        input_params = {
            "prompt": prompt,
            "image": [image_url],
            "output_format": output_format,
            "output_quality": output_quality,
            "aspect_ratio": "match_input_image",
            "go_fast": True,
        }

        if seed is not None:
            input_params["seed"] = seed

        try:
            # Run the model synchronously (replicate.run blocks until complete)
            # We'll run this in a thread pool to avoid blocking the event loop
            import asyncio
            import concurrent.futures

            loop = asyncio.get_event_loop()
            with concurrent.futures.ThreadPoolExecutor() as executor:
                output = await loop.run_in_executor(
                    executor,
                    lambda: replicate.run(
                        self.model,
                        input=input_params,
                    ),
                )

            # The output is typically the URL of the generated image
            # For image models, output is usually a FileOutput or URL string
            if output is None:
                raise ReplicateError(
                    error_type=ReplicateErrorType.API_ERROR,
                    message="No output returned from Replicate API",
                )

            # Handle different output types
            if isinstance(output, str):
                result_url = output
            elif hasattr(output, "url"):
                result_url = output.url
            elif isinstance(output, list) and len(output) > 0:
                # Some models return a list of outputs
                first_output = output[0]
                if isinstance(first_output, str):
                    result_url = first_output
                elif hasattr(first_output, "url"):
                    result_url = first_output.url
                else:
                    result_url = str(first_output)
            else:
                result_url = str(output)

            logger.info(f"Replicate restoration completed, downloading result...")

            # Download the result
            image_bytes = await self._download_result(result_url)

            # Build metadata
            metadata = {
                "provider": "replicate",
                "model": self.model,
                "prompt": prompt,
                "output_format": output_format,
                "output_quality": output_quality,
                "seed": seed,
            }

            return image_bytes, metadata

        except replicate.exceptions.ReplicateError as e:
            error_msg = str(e)
            logger.error(f"Replicate API error: {error_msg}")

            # Classify error type
            if "authentication" in error_msg.lower() or "unauthorized" in error_msg.lower():
                raise ReplicateError(
                    error_type=ReplicateErrorType.AUTHENTICATION_ERROR,
                    message="Invalid Replicate API token",
                    status_code=401,
                )
            elif "rate limit" in error_msg.lower():
                raise ReplicateError(
                    error_type=ReplicateErrorType.RATE_LIMIT_ERROR,
                    message="Replicate rate limit exceeded",
                    status_code=429,
                )
            else:
                raise ReplicateError(
                    error_type=ReplicateErrorType.API_ERROR,
                    message=f"Replicate API error: {error_msg}",
                )
        except ReplicateError:
            # Re-raise our own errors
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling Replicate API: {e}")
            raise ReplicateError(
                error_type=ReplicateErrorType.API_ERROR,
                message=f"Unexpected error: {e}",
            )


    def create_prediction_with_webhook(
        self,
        image_url: str,
        webhook_url: str,
        photo_id: str,
        prompt: Optional[str] = None,
        seed: Optional[int] = None,
        output_format: str = "jpg",
        output_quality: int = 95,
    ) -> str:
        """
        Create an async prediction with webhook notification.

        This method returns immediately after creating the prediction.
        When the prediction completes, Replicate will POST to the webhook URL.

        Args:
            image_url: Presigned S3 URL for the source image
            webhook_url: URL to receive completion notification
            photo_id: Photo ID to include in webhook metadata
            prompt: Custom restoration prompt (defaults to DEFAULT_RESTORATION_PROMPT)
            seed: Optional random seed for reproducibility
            output_format: Output format (jpg, png, webp)
            output_quality: Output quality 0-100 (default: 95)

        Returns:
            Replicate prediction ID

        Raises:
            ReplicateError: If prediction creation fails
        """
        prompt = prompt or DEFAULT_RESTORATION_PROMPT

        logger.info(f"Creating async prediction for photo {photo_id}")
        logger.debug(f"Image URL: {image_url[:100]}...")
        logger.debug(f"Webhook URL: {webhook_url}")

        # Build input payload
        input_params = {
            "prompt": prompt,
            "image": [image_url],
            "output_format": output_format,
            "output_quality": output_quality,
            "aspect_ratio": "match_input_image",
            "go_fast": True,
        }

        if seed is not None:
            input_params["seed"] = seed

        try:
            # Create prediction with webhook (non-blocking)
            prediction = self._client.predictions.create(
                model=self.model,
                input=input_params,
                webhook=webhook_url,
                webhook_events_filter=["completed"],
            )

            prediction_id = prediction.id
            logger.info(
                f"Created Replicate prediction {prediction_id} for photo {photo_id}, "
                f"status: {prediction.status}"
            )

            return prediction_id

        except replicate.exceptions.ReplicateError as e:
            error_msg = str(e)
            logger.error(f"Replicate API error creating prediction: {error_msg}")

            if "authentication" in error_msg.lower() or "unauthorized" in error_msg.lower():
                raise ReplicateError(
                    error_type=ReplicateErrorType.AUTHENTICATION_ERROR,
                    message="Invalid Replicate API token",
                    status_code=401,
                )
            elif "rate limit" in error_msg.lower():
                raise ReplicateError(
                    error_type=ReplicateErrorType.RATE_LIMIT_ERROR,
                    message="Replicate rate limit exceeded",
                    status_code=429,
                )
            else:
                raise ReplicateError(
                    error_type=ReplicateErrorType.API_ERROR,
                    message=f"Replicate API error: {error_msg}",
                )
        except Exception as e:
            logger.error(f"Unexpected error creating prediction: {e}")
            raise ReplicateError(
                error_type=ReplicateErrorType.API_ERROR,
                message=f"Unexpected error: {e}",
            )


# Global service instance (lazy initialization)
_replicate_service: Optional[ReplicateService] = None


def get_replicate_service() -> ReplicateService:
    """Get or create the Replicate service instance (lazy initialization)."""
    global _replicate_service
    if _replicate_service is None:
        _replicate_service = ReplicateService()
    return _replicate_service


async def download_replicate_result(url: str) -> bytes:
    """
    Download image from Replicate CDN URL.

    Standalone function for use by webhook handler.
    """
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.content
    except Exception as e:
        logger.error(f"Error downloading from {url}: {e}")
        raise ReplicateError(
            error_type=ReplicateErrorType.NETWORK_ERROR,
            message=f"Failed to download result: {e}",
        )
