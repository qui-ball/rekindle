"""
Image preprocessing utilities for SiliconFlow API integration.

Handles image resize and format conversion before submission to restoration API.
"""

from dataclasses import dataclass
from typing import Tuple
from io import BytesIO

from PIL import Image
from loguru import logger


# Maximum dimension allowed by SiliconFlow API (3584x3584 per API docs)
MAX_DIMENSION = 3584

# Supported input formats that need conversion
FORMATS_NEEDING_CONVERSION = {"HEIC", "HEIF", "WEBP", "TIFF", "TIF", "BMP", "GIF"}


@dataclass
class ImagePreprocessResult:
    """Result of image preprocessing operation."""

    image_bytes: bytes
    resized: bool
    original_dimensions: Tuple[int, int]  # (width, height)
    new_dimensions: Tuple[int, int]  # (width, height)
    format_converted: bool
    original_format: str


def get_image_dimensions(image_bytes: bytes) -> Tuple[int, int]:
    """
    Get the dimensions of an image from its bytes.

    Args:
        image_bytes: Raw image bytes

    Returns:
        Tuple of (width, height)

    Raises:
        ValueError: If image cannot be read
    """
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            return img.size  # (width, height)
    except Exception as e:
        raise ValueError(f"Failed to read image dimensions: {e}")


def needs_preprocessing(
    image_bytes: bytes, max_dimension: int = MAX_DIMENSION
) -> Tuple[bool, bool, str]:
    """
    Check if an image needs preprocessing (resize or format conversion).

    Args:
        image_bytes: Raw image bytes
        max_dimension: Maximum allowed dimension

    Returns:
        Tuple of (needs_resize, needs_format_conversion, original_format)

    Raises:
        ValueError: If image cannot be read
    """
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            width, height = img.size
            original_format = img.format or "UNKNOWN"

            needs_resize = width > max_dimension or height > max_dimension
            needs_format_conversion = original_format.upper() in FORMATS_NEEDING_CONVERSION

            return needs_resize, needs_format_conversion, original_format
    except Exception as e:
        raise ValueError(f"Failed to analyze image: {e}")


def preprocess_image(
    image_bytes: bytes,
    max_dimension: int = MAX_DIMENSION,
    output_quality: int = 95,
) -> ImagePreprocessResult:
    """
    Preprocess an image for SiliconFlow API submission.

    Performs:
    1. Format conversion to JPEG if needed (HEIC, WebP, TIFF, etc.)
    2. Resize if dimensions exceed max_dimension
    3. Convert to RGB mode if needed

    Args:
        image_bytes: Raw image bytes (any supported format)
        max_dimension: Maximum width or height in pixels (default: 3584)
        output_quality: JPEG output quality 1-100 (default: 95)

    Returns:
        ImagePreprocessResult with preprocessed image and metadata

    Raises:
        ValueError: If image cannot be processed
    """
    try:
        with Image.open(BytesIO(image_bytes)) as img:
            original_format = img.format or "UNKNOWN"
            original_dimensions = img.size  # (width, height)
            width, height = original_dimensions

            logger.debug(
                f"Preprocessing image: {width}x{height}, format={original_format}"
            )

            # Track what operations are performed
            resized = False
            format_converted = False

            # Check if format conversion is needed
            if original_format.upper() in FORMATS_NEEDING_CONVERSION:
                format_converted = True
                logger.info(f"Converting image from {original_format} to JPEG")

            # Convert to RGB if needed (handles RGBA, grayscale, palette modes)
            if img.mode != "RGB":
                # Handle transparency by compositing on white background
                if img.mode in ("RGBA", "LA", "P"):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                    img = background
                else:
                    img = img.convert("RGB")
                format_converted = True

            # Resize if needed (maintaining aspect ratio)
            if width > max_dimension or height > max_dimension:
                resized = True
                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                logger.info(
                    f"Resized image from {width}x{height} to {img.size[0]}x{img.size[1]}"
                )

            new_dimensions = img.size

            # Output as JPEG
            output = BytesIO()
            img.save(output, format="JPEG", quality=output_quality, optimize=True)
            output_bytes = output.getvalue()

            logger.debug(
                f"Preprocessing complete: resized={resized}, "
                f"format_converted={format_converted}, "
                f"output_size={len(output_bytes)} bytes"
            )

            return ImagePreprocessResult(
                image_bytes=output_bytes,
                resized=resized,
                original_dimensions=original_dimensions,
                new_dimensions=new_dimensions,
                format_converted=format_converted,
                original_format=original_format,
            )

    except Exception as e:
        logger.error(f"Failed to preprocess image: {e}")
        raise ValueError(f"Image preprocessing failed: {e}")
