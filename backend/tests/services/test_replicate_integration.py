"""
Simple integration test for Replicate service.

Run with: pytest tests/services/test_replicate_integration.py -v -s
"""

import pytest
from io import BytesIO
from PIL import Image

from app.services.replicate_service import ReplicateService


@pytest.mark.asyncio
async def test_replicate_restore_image():
    """Test that Replicate API restores an image successfully."""
    service = ReplicateService()
    print(f"Replicate API Token: {service.api_token}")

    # Use a public test image
    test_image_url = "https://picsum.photos/id/1/400/300"

    image_bytes, metadata = await service.restore_image(
        image_url=test_image_url,
        prompt="Enhance this image, improve clarity and colors.",
    )

    # Verify we got image bytes
    assert isinstance(image_bytes, bytes)
    assert len(image_bytes) > 1000

    # Verify metadata
    assert metadata["provider"] == "replicate"
    assert "qwen" in metadata["model"].lower()

    # Verify it's a valid image
    img = Image.open(BytesIO(image_bytes))
    assert img.size[0] > 0
    assert img.size[1] > 0

    print(f"\nSuccess! Restored image size: {len(image_bytes)} bytes")
    print(f"Image dimensions: {img.size}")
    print(f"Model used: {metadata['model']}")

    # Show the image
    img.show()
