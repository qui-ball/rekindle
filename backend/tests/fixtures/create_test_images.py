#!/usr/bin/env python3
"""
Script to create test image fixtures for restoration workflow tests
"""

from PIL import Image
import io
import os
from pathlib import Path


def create_test_images():
    """Create test images for different test scenarios"""

    fixtures_dir = Path(__file__).parent

    # Create small test image (valid JPEG)
    small_img = Image.new("RGB", (100, 100), color="red")
    small_path = fixtures_dir / "small_test_image.jpg"
    small_img.save(small_path, "JPEG", quality=85)
    print(f"Created: {small_path} ({small_path.stat().st_size} bytes)")

    # Create PNG test image
    png_img = Image.new("RGB", (150, 150), color="blue")
    png_path = fixtures_dir / "test_image.png"
    png_img.save(png_path, "PNG")
    print(f"Created: {png_path} ({png_path.stat().st_size} bytes)")

    # Create WebP test image
    webp_img = Image.new("RGB", (120, 120), color="green")
    webp_path = fixtures_dir / "test_image.webp"
    webp_img.save(webp_path, "WEBP")
    print(f"Created: {webp_path} ({webp_path.stat().st_size} bytes)")

    # Create medium size image for testing
    medium_img = Image.new("RGB", (800, 600), color="purple")
    medium_path = fixtures_dir / "medium_test_image.jpg"
    medium_img.save(medium_path, "JPEG", quality=95)
    print(f"Created: {medium_path} ({medium_path.stat().st_size} bytes)")

    # Create corrupted/invalid image file
    invalid_path = fixtures_dir / "invalid_image.txt"
    with open(invalid_path, "w") as f:
        f.write("This is not an image file")
    print(f"Created: {invalid_path} ({invalid_path.stat().st_size} bytes)")

    print(f"\nTest fixtures created in: {fixtures_dir}")


if __name__ == "__main__":
    create_test_images()
