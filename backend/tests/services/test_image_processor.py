"""
Unit tests for image preprocessing service.
"""

import pytest
from io import BytesIO
from PIL import Image

from app.services.image_processor import (
    ImagePreprocessResult,
    get_image_dimensions,
    needs_preprocessing,
    preprocess_image,
    MAX_DIMENSION,
)


def create_test_image(
    width: int, height: int, format: str = "JPEG", mode: str = "RGB"
) -> bytes:
    """Helper to create test images."""
    img = Image.new(mode, (width, height), color="red")
    buffer = BytesIO()
    if format.upper() == "JPEG" and mode != "RGB":
        img = img.convert("RGB")
    img.save(buffer, format=format)
    return buffer.getvalue()


class TestImagePreprocessResult:
    """Tests for ImagePreprocessResult dataclass."""

    def test_dataclass_creation(self):
        """Test that ImagePreprocessResult can be created with all fields."""
        result = ImagePreprocessResult(
            image_bytes=b"test",
            resized=True,
            original_dimensions=(4000, 3000),
            new_dimensions=(3584, 2688),
            format_converted=True,
            original_format="HEIC",
        )

        assert result.image_bytes == b"test"
        assert result.resized is True
        assert result.original_dimensions == (4000, 3000)
        assert result.new_dimensions == (3584, 2688)
        assert result.format_converted is True
        assert result.original_format == "HEIC"


class TestGetImageDimensions:
    """Tests for get_image_dimensions function."""

    def test_get_dimensions_jpeg(self):
        """Test getting dimensions of a JPEG image."""
        image_bytes = create_test_image(800, 600)
        width, height = get_image_dimensions(image_bytes)

        assert width == 800
        assert height == 600

    def test_get_dimensions_png(self):
        """Test getting dimensions of a PNG image."""
        image_bytes = create_test_image(1024, 768, format="PNG", mode="RGBA")
        width, height = get_image_dimensions(image_bytes)

        assert width == 1024
        assert height == 768

    def test_get_dimensions_invalid_image(self):
        """Test that invalid image data raises ValueError."""
        with pytest.raises(ValueError, match="Failed to read image dimensions"):
            get_image_dimensions(b"not an image")


class TestNeedsPreprocessing:
    """Tests for needs_preprocessing function."""

    def test_small_jpeg_no_preprocessing(self):
        """Test that small JPEG images don't need preprocessing."""
        image_bytes = create_test_image(800, 600)
        needs_resize, needs_convert, original_format = needs_preprocessing(image_bytes)

        assert needs_resize is False
        assert needs_convert is False
        assert original_format == "JPEG"

    def test_large_image_needs_resize(self):
        """Test that images larger than max dimension need resize."""
        image_bytes = create_test_image(4000, 3000)
        needs_resize, needs_convert, original_format = needs_preprocessing(image_bytes)

        assert needs_resize is True
        assert needs_convert is False

    def test_png_needs_conversion(self):
        """Test that PNG images are detected but don't need conversion."""
        # PNG is not in FORMATS_NEEDING_CONVERSION
        image_bytes = create_test_image(800, 600, format="PNG", mode="RGBA")
        needs_resize, needs_convert, original_format = needs_preprocessing(image_bytes)

        assert needs_resize is False
        assert needs_convert is False
        assert original_format == "PNG"

    def test_webp_needs_conversion(self):
        """Test that WebP images need format conversion."""
        image_bytes = create_test_image(800, 600, format="WEBP")
        needs_resize, needs_convert, original_format = needs_preprocessing(image_bytes)

        assert needs_resize is False
        assert needs_convert is True
        assert original_format == "WEBP"

    def test_bmp_needs_conversion(self):
        """Test that BMP images need format conversion."""
        image_bytes = create_test_image(800, 600, format="BMP")
        needs_resize, needs_convert, original_format = needs_preprocessing(image_bytes)

        assert needs_resize is False
        assert needs_convert is True
        assert original_format == "BMP"

    def test_invalid_image_raises_error(self):
        """Test that invalid image data raises ValueError."""
        with pytest.raises(ValueError, match="Failed to analyze image"):
            needs_preprocessing(b"not an image")


class TestPreprocessImage:
    """Tests for preprocess_image function."""

    def test_small_jpeg_passthrough(self):
        """Test that small JPEG images are processed without resize."""
        image_bytes = create_test_image(800, 600)
        result = preprocess_image(image_bytes)

        assert result.resized is False
        assert result.original_dimensions == (800, 600)
        assert result.new_dimensions == (800, 600)
        assert result.original_format == "JPEG"
        assert len(result.image_bytes) > 0

    def test_large_image_resized(self):
        """Test that large images are resized."""
        image_bytes = create_test_image(4000, 3000)
        result = preprocess_image(image_bytes)

        assert result.resized is True
        assert result.original_dimensions == (4000, 3000)
        # Check that new dimensions are within MAX_DIMENSION
        assert result.new_dimensions[0] <= MAX_DIMENSION
        assert result.new_dimensions[1] <= MAX_DIMENSION

    def test_aspect_ratio_preserved(self):
        """Test that aspect ratio is preserved during resize."""
        image_bytes = create_test_image(4000, 2000)  # 2:1 aspect ratio
        result = preprocess_image(image_bytes)

        width, height = result.new_dimensions
        original_ratio = 4000 / 2000
        new_ratio = width / height

        # Allow small tolerance for rounding
        assert abs(original_ratio - new_ratio) < 0.01

    def test_webp_converted_to_jpeg(self):
        """Test that WebP images are converted to JPEG."""
        image_bytes = create_test_image(800, 600, format="WEBP")
        result = preprocess_image(image_bytes)

        assert result.format_converted is True
        assert result.original_format == "WEBP"
        # Verify output is valid JPEG
        with Image.open(BytesIO(result.image_bytes)) as img:
            assert img.format == "JPEG"

    def test_rgba_converted_to_rgb(self):
        """Test that RGBA images are converted to RGB."""
        image_bytes = create_test_image(800, 600, format="PNG", mode="RGBA")
        result = preprocess_image(image_bytes)

        # Verify output is RGB JPEG
        with Image.open(BytesIO(result.image_bytes)) as img:
            assert img.format == "JPEG"
            assert img.mode == "RGB"

    def test_grayscale_converted_to_rgb(self):
        """Test that grayscale images are converted to RGB."""
        # Create grayscale image
        img = Image.new("L", (800, 600), color=128)
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        image_bytes = buffer.getvalue()

        result = preprocess_image(image_bytes)

        # Verify output is RGB JPEG
        with Image.open(BytesIO(result.image_bytes)) as img:
            assert img.format == "JPEG"
            assert img.mode == "RGB"

    def test_custom_max_dimension(self):
        """Test preprocessing with custom max dimension."""
        image_bytes = create_test_image(2000, 1500)
        result = preprocess_image(image_bytes, max_dimension=1000)

        assert result.resized is True
        assert result.new_dimensions[0] <= 1000
        assert result.new_dimensions[1] <= 1000

    def test_custom_output_quality(self):
        """Test preprocessing with custom output quality."""
        image_bytes = create_test_image(800, 600)

        # Lower quality should produce smaller file
        result_low = preprocess_image(image_bytes, output_quality=50)
        result_high = preprocess_image(image_bytes, output_quality=95)

        # Low quality should generally be smaller (not always guaranteed)
        # Just verify both produce valid output
        assert len(result_low.image_bytes) > 0
        assert len(result_high.image_bytes) > 0

    def test_invalid_image_raises_error(self):
        """Test that invalid image data raises ValueError."""
        with pytest.raises(ValueError, match="Image preprocessing failed"):
            preprocess_image(b"not an image")

    def test_very_wide_image_resize(self):
        """Test resizing a very wide image."""
        image_bytes = create_test_image(5000, 500)  # 10:1 aspect ratio
        result = preprocess_image(image_bytes)

        assert result.resized is True
        assert result.new_dimensions[0] <= MAX_DIMENSION
        # Height should be much smaller due to aspect ratio
        assert result.new_dimensions[1] < result.new_dimensions[0]

    def test_very_tall_image_resize(self):
        """Test resizing a very tall image."""
        image_bytes = create_test_image(500, 5000)  # 1:10 aspect ratio
        result = preprocess_image(image_bytes)

        assert result.resized is True
        assert result.new_dimensions[1] <= MAX_DIMENSION
        # Width should be much smaller due to aspect ratio
        assert result.new_dimensions[0] < result.new_dimensions[1]
