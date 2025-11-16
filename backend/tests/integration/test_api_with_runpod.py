"""
Integration test for backend API with RunPod ComfyUI instance

This test makes real HTTP requests to the running Docker backend (http://localhost:8000)
which uses the real Celery workers and RunPod ComfyUI instance.
"""

import pytest
import time
from pathlib import Path
from httpx import AsyncClient


@pytest.mark.skip(reason="Requires external RunPod/ComfyUI services")
@pytest.mark.asyncio
async def test_full_restoration_workflow():
    """
    Test the complete workflow:
    1. Upload image
    2. Create restore attempt
    3. Wait for completion
    4. Retrieve results

    Prerequisites:
    - Docker Compose services must be running (docker compose up -d)
    - RunPod ComfyUI pod must be running
    - COMFYUI_URL must be set in backend/.env
    """
    # Load test image
    test_image_path = Path(__file__).parent.parent / "fixtures" / "old_photo_example.webp"
    assert test_image_path.exists(), f"Test image not found: {test_image_path}"

    async with AsyncClient(
        base_url="http://localhost:8000",
        timeout=600.0  # 10 minute timeout for long-running restoration
    ) as client:
        # Step 1: Upload image and create job
        print("\n1. Uploading image and creating job...")
        with open(test_image_path, "rb") as f:
            files = {"file": ("old_photo_example.webp", f, "image/webp")}
            data = {"email": "test@example.com"}

            upload_response = await client.post(
                "/api/v1/jobs/upload",
                files=files,
                data=data
            )

        assert upload_response.status_code == 200, f"Upload failed: {upload_response.text}"
        upload_data = upload_response.json()
        job_id = upload_data["job_id"]

        print(f"   ✓ Job created: {job_id}")
        print(f"   ✓ Processed image uploaded to: {upload_data['processed_url']}")

        # Step 2: Create restore attempt
        print("\n2. Creating restore attempt...")
        restore_response = await client.post(
            f"/api/v1/jobs/{job_id}/restore",
            json={
                "model": "qwen-image-edit",
                "params": {
                    "denoise": 0.7,
                    "megapixels": 1.0
                }
            }
        )

        assert restore_response.status_code == 200, f"Restore failed: {restore_response.text}"
        restore_data = restore_response.json()
        restore_id = restore_data["id"]

        print(f"   ✓ Restore attempt created: {restore_id}")
        print(f"   ✓ Status: {restore_data['s3_key']}")

        # Step 3: Poll for completion
        print("\n3. Waiting for restoration to complete...")
        max_wait = 600  # 10 minutes
        poll_interval = 5  # 5 seconds
        elapsed = 0

        while elapsed < max_wait:
            job_response = await client.get(f"/api/v1/jobs/{job_id}")
            assert job_response.status_code == 200
            job_data = job_response.json()

            # Check if restore attempt has completed
            restore_attempts = job_data.get("restore_attempts", [])
            if restore_attempts:
                latest_restore = restore_attempts[-1]
                s3_key = latest_restore.get("s3_key", "")

                if s3_key and s3_key not in ["", "pending", "failed"]:
                    print(f"   ✓ Restoration completed!")
                    print(f"   ✓ S3 Key: {s3_key}")

                    if "url" in latest_restore:
                        print(f"   ✓ Download URL: {latest_restore['url']}")

                    # Test successful
                    return {
                        "job_id": job_id,
                        "restore_id": restore_id,
                        "s3_key": s3_key,
                        "url": latest_restore.get("url"),
                        "elapsed_time": elapsed
                    }
                elif s3_key == "failed":
                    pytest.fail(f"Restoration failed: {latest_restore.get('params')}")

            # Wait and update elapsed time
            time.sleep(poll_interval)
            elapsed += poll_interval
            print(f"   ... waiting ({elapsed}s / {max_wait}s)")

        pytest.fail(f"Restoration did not complete within {max_wait} seconds")


if __name__ == "__main__":
    """Run the test directly"""
    import asyncio
    import os

    # Set RunPod ComfyUI URL
    pod_url = os.getenv("COMFYUI_URL", "https://aexnmagjdoqoaj-8188.proxy.runpod.net")
    print(f"Using ComfyUI URL: {pod_url}")

    # Run the test
    result = asyncio.run(test_full_restoration_workflow())
    print("\n" + "="*60)
    print("TEST COMPLETED SUCCESSFULLY!")
    print("="*60)
    print(f"Job ID: {result['job_id']}")
    print(f"Restore ID: {result['restore_id']}")
    print(f"S3 Key: {result['s3_key']}")
    print(f"URL: {result['url']}")
    print(f"Time taken: {result['elapsed_time']} seconds")
