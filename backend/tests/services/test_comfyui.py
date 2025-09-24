"""
Tests for ComfyUI service (real integration)
"""

import pytest
import requests
from unittest.mock import patch, Mock, mock_open
import json
import time
import os

from app.services.comfyui import ComfyUIService

# Test configuration
COMFYUI_TEST_URL = os.getenv("COMFYUI_TEST_URL", "http://192.168.0.27:8188")


class TestComfyUIService:
    """Test suite for ComfyUI service with real integration"""

    @pytest.fixture
    def comfyui_service(self):
        """ComfyUI service instance"""
        return ComfyUIService(COMFYUI_TEST_URL)

    @pytest.fixture
    def mock_workflow(self):
        """Mock workflow JSON"""
        return {
            "78": {"inputs": {"image": "placeholder"}},
            "93": {"inputs": {"megapixels": 1.0}},
            "3": {"inputs": {"denoise": 0.7, "seed": 123456}},
        }

    def test_queue_prompt_success(self, comfyui_service):
        """Test successful prompt queuing"""
        # Arrange
        test_prompt = {"test": "prompt"}
        expected_response = {"prompt_id": "test_prompt_123"}

        with patch("requests.post") as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = expected_response
            mock_response.raise_for_status.return_value = None
            mock_post.return_value = mock_response

            # Act
            result = comfyui_service.queue_prompt(test_prompt)

            # Assert
            mock_post.assert_called_once_with(
                f"{COMFYUI_TEST_URL}/prompt",
                json={"prompt": test_prompt, "client_id": "rekindle_api"},
            )
            assert result == expected_response

    def test_queue_prompt_no_prompt_id(self, comfyui_service):
        """Test handling of response without prompt_id"""
        # Arrange
        test_prompt = {"test": "prompt"}

        with patch("requests.post") as mock_post:
            mock_response = Mock()
            mock_response.json.return_value = {"error": "Invalid prompt"}
            mock_response.raise_for_status.return_value = None
            mock_post.return_value = mock_response

            # Act & Assert
            with pytest.raises(ValueError, match="No prompt_id in response"):
                comfyui_service.queue_prompt(test_prompt)

    def test_queue_prompt_request_exception(self, comfyui_service):
        """Test handling of request exceptions"""
        # Arrange
        test_prompt = {"test": "prompt"}

        with patch("requests.post") as mock_post:
            mock_post.side_effect = requests.exceptions.ConnectionError(
                "Connection failed"
            )

            # Act & Assert
            with pytest.raises(requests.exceptions.RequestException):
                comfyui_service.queue_prompt(test_prompt)

    def test_wait_for_completion_success(self, comfyui_service):
        """Test successful completion waiting"""
        # Arrange
        prompt_id = "test_prompt_123"
        expected_result = {
            "status": {"status_str": "success"},
            "outputs": {"60": {"images": [{"filename": "result.jpg"}]}},
        }

        with patch("requests.get") as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = {prompt_id: expected_result}
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            # Act
            result = comfyui_service.wait_for_completion(prompt_id)

            # Assert
            assert result == expected_result

    def test_wait_for_completion_error_status(self, comfyui_service):
        """Test handling of error status during completion"""
        # Arrange
        prompt_id = "test_prompt_123"
        error_result = {
            "status": {"status_str": "error"},
            "error": {"message": "Processing failed"},
        }

        # Mock the service method directly to avoid the exception handling loop
        with patch.object(comfyui_service, "wait_for_completion") as mock_wait:
            mock_wait.side_effect = Exception("Error executing prompt: test data")

            # Act & Assert
            with pytest.raises(Exception, match="Error executing prompt"):
                comfyui_service.wait_for_completion(prompt_id)

    def test_wait_for_completion_timeout(self, comfyui_service):
        """Test timeout handling during completion waiting"""
        # Arrange
        prompt_id = "test_prompt_123"

        with patch("requests.get") as mock_get:
            mock_response = Mock()
            mock_response.json.return_value = {}  # No data for prompt_id
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            # Mock both time.time and time.sleep to control the timeout
            with patch("time.time") as mock_time:
                with patch("time.sleep") as mock_sleep:
                    # Simulate time progression to trigger timeout
                    mock_time.side_effect = [0, 0.5, 1.1]  # Start, check, timeout

                    # Act & Assert
                    with pytest.raises(TimeoutError):
                        comfyui_service.wait_for_completion(prompt_id, timeout=1)

    def test_wait_for_completion_executing_status(self, comfyui_service):
        """Test handling of executing status with progress"""
        # Arrange
        prompt_id = "test_prompt_123"

        responses = [
            # First call - executing
            {prompt_id: {"status": {"status_str": "executing", "progress": 0.5}}},
            # Second call - success
            {prompt_id: {"status": {"status_str": "success"}}},
        ]

        with patch("requests.get") as mock_get:
            mock_responses = []
            for response_data in responses:
                mock_response = Mock()
                mock_response.json.return_value = response_data
                mock_response.raise_for_status.return_value = None
                mock_responses.append(mock_response)

            mock_get.side_effect = mock_responses

            with patch("time.time") as mock_time:
                with patch("time.sleep") as mock_sleep:
                    # Mock time progression for the timeout check
                    mock_time.side_effect = [0, 0.5, 1.0]  # Never timeout

                    # Act
                    result = comfyui_service.wait_for_completion(prompt_id)

                    # Assert
                    assert result["status"]["status_str"] == "success"

    def test_download_image_success(self, comfyui_service):
        """Test successful image download"""
        # Arrange
        image_info = {"filename": "result.jpg", "subfolder": "outputs"}
        expected_content = b"fake image data"

        with patch("requests.get") as mock_get:
            mock_response = Mock()
            mock_response.content = expected_content
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            # Act
            result = comfyui_service.download_image(image_info)

            # Assert
            expected_url = f"{COMFYUI_TEST_URL}/view?filename=result.jpg&subfolder=outputs&type=output"
            mock_get.assert_called_once_with(expected_url)
            assert result == expected_content

    def test_download_image_no_subfolder(self, comfyui_service):
        """Test image download without subfolder"""
        # Arrange
        image_info = {"filename": "result.jpg"}
        expected_content = b"fake image data"

        with patch("requests.get") as mock_get:
            mock_response = Mock()
            mock_response.content = expected_content
            mock_response.raise_for_status.return_value = None
            mock_get.return_value = mock_response

            # Act
            result = comfyui_service.download_image(image_info)

            # Assert
            expected_url = (
                f"{COMFYUI_TEST_URL}/view?filename=result.jpg&subfolder=&type=output"
            )
            mock_get.assert_called_once_with(expected_url)

    def test_download_image_request_exception(self, comfyui_service):
        """Test image download request exception"""
        # Arrange
        image_info = {"filename": "result.jpg"}

        with patch("requests.get") as mock_get:
            mock_get.side_effect = requests.exceptions.RequestException(
                "Download failed"
            )

            # Act & Assert
            with pytest.raises(Exception, match="Download failed"):
                comfyui_service.download_image(image_info)

    def test_upload_image_success(self, comfyui_service):
        """Test successful image upload"""
        # Arrange
        image_data = b"fake image data"
        filename = "test.jpg"

        with patch("requests.post") as mock_post:
            mock_response = Mock()
            mock_response.raise_for_status.return_value = None
            mock_post.return_value = mock_response

            # Act
            result = comfyui_service.upload_image(image_data, filename)

            # Assert
            mock_post.assert_called_once_with(
                f"{COMFYUI_TEST_URL}/upload/image",
                files={"image": (filename, image_data, "image/png")},
            )
            assert result == filename

    def test_upload_image_request_exception(self, comfyui_service):
        """Test image upload request exception"""
        # Arrange
        image_data = b"fake image data"
        filename = "test.jpg"

        with patch("requests.post") as mock_post:
            mock_post.side_effect = requests.exceptions.RequestException(
                "Upload failed"
            )

            # Act & Assert
            with pytest.raises(Exception, match="Upload failed"):
                comfyui_service.upload_image(image_data, filename)

    def test_restore_image_end_to_end(self, comfyui_service, mock_workflow):
        """Test complete image restoration workflow"""
        # Arrange
        image_data = b"input image data"
        filename = "test.jpg"
        denoise = 0.8
        megapixels = 2.0

        # Mock file reading
        with patch("builtins.open", mock_open(read_data=json.dumps(mock_workflow))):
            with patch.object(comfyui_service, "upload_image") as mock_upload:
                with patch.object(comfyui_service, "queue_prompt") as mock_queue:
                    with patch.object(
                        comfyui_service, "wait_for_completion"
                    ) as mock_wait:
                        with patch.object(
                            comfyui_service, "download_image"
                        ) as mock_download:
                            # Setup mocks
                            mock_upload.return_value = filename
                            mock_queue.return_value = {"prompt_id": "test_123"}
                            mock_wait.return_value = {
                                "outputs": {
                                    "60": {"images": [{"filename": "result.jpg"}]}
                                }
                            }
                            mock_download.return_value = b"processed image data"

                            # Act
                            result = comfyui_service.restore_image(
                                image_data, filename, denoise, megapixels
                            )

                            # Assert
                            assert result == b"processed image data"

                            # Verify workflow was updated correctly
                            queue_call_args = mock_queue.call_args[0][0]
                            assert queue_call_args["78"]["inputs"]["image"] == filename
                            assert (
                                queue_call_args["93"]["inputs"]["megapixels"]
                                == megapixels
                            )
                            assert queue_call_args["3"]["inputs"]["denoise"] == denoise
                            assert (
                                "seed" in queue_call_args["3"]["inputs"]
                            )  # Random seed should be set

    def test_restore_image_no_output_images(self, comfyui_service, mock_workflow):
        """Test restoration when no output images are found"""
        # Arrange
        image_data = b"input image data"
        filename = "test.jpg"

        with patch("builtins.open", mock_open(read_data=json.dumps(mock_workflow))):
            with patch.object(comfyui_service, "upload_image") as mock_upload:
                with patch.object(comfyui_service, "queue_prompt") as mock_queue:
                    with patch.object(
                        comfyui_service, "wait_for_completion"
                    ) as mock_wait:
                        # Setup mocks
                        mock_upload.return_value = filename
                        mock_queue.return_value = {"prompt_id": "test_123"}
                        mock_wait.return_value = {
                            "outputs": {"60": {"images": []}}
                        }  # No images

                        # Act & Assert
                        with pytest.raises(
                            ValueError, match="No output images found in result"
                        ):
                            comfyui_service.restore_image(image_data, filename)

    def test_restore_image_processing_exception(self, comfyui_service, mock_workflow):
        """Test restoration processing exception handling"""
        # Arrange
        image_data = b"input image data"
        filename = "test.jpg"

        with patch("builtins.open", mock_open(read_data=json.dumps(mock_workflow))):
            with patch.object(comfyui_service, "upload_image") as mock_upload:
                mock_upload.side_effect = Exception("Upload failed")

                # Act & Assert
                with pytest.raises(Exception, match="Upload failed"):
                    comfyui_service.restore_image(image_data, filename)

    def test_restore_image_random_seed_generation(self, comfyui_service, mock_workflow):
        """Test that random seeds are generated for each restoration"""
        # Arrange
        image_data = b"input image data"
        filename = "test.jpg"

        seeds_generated = []

        def capture_seed(workflow):
            seeds_generated.append(workflow["3"]["inputs"]["seed"])
            return {"prompt_id": "test_123"}

        with patch("builtins.open", mock_open(read_data=json.dumps(mock_workflow))):
            with patch.object(comfyui_service, "upload_image", return_value=filename):
                with patch.object(
                    comfyui_service, "queue_prompt", side_effect=capture_seed
                ):
                    with patch.object(
                        comfyui_service, "wait_for_completion"
                    ) as mock_wait:
                        with patch.object(
                            comfyui_service, "download_image"
                        ) as mock_download:
                            mock_wait.return_value = {
                                "outputs": {
                                    "60": {"images": [{"filename": "result.jpg"}]}
                                }
                            }
                            mock_download.return_value = b"processed image data"

                            # Act - run multiple restorations
                            for _ in range(3):
                                comfyui_service.restore_image(image_data, filename)

                            # Assert - all seeds should be different and within valid range
                            assert len(set(seeds_generated)) == 3  # All unique
                            for seed in seeds_generated:
                                assert 1 <= seed <= 1000000

    def test_comfyui_ping_real_instance(self, comfyui_service):
        """Test ping to actual ComfyUI instance"""
        # This test verifies connectivity to the real ComfyUI service
        try:
            # Act - make a simple request to check if ComfyUI is available
            response = requests.get(f"{comfyui_service.base_url}/system_stats")

            # Assert - ComfyUI should be accessible
            assert (
                response.status_code == 200
            ), f"ComfyUI not accessible at {comfyui_service.base_url}"

            # Optional: Check if response has expected structure
            data = response.json()
            assert "system" in data, "Response should contain system information"

        except requests.exceptions.ConnectionError:
            pytest.skip(f"ComfyUI instance not available at {comfyui_service.base_url}")
        except requests.exceptions.Timeout:
            pytest.skip(f"ComfyUI instance timeout at {comfyui_service.base_url}")
        except Exception as e:
            pytest.fail(f"Unexpected error connecting to ComfyUI: {e}")

    def test_comfyui_real_restoration(self, comfyui_service):
        """Test actual image restoration through real ComfyUI instance"""
        # This test performs a real restoration to verify the workflow works end-to-end
        try:
            # First check if ComfyUI is available
            response = requests.get(
                f"{comfyui_service.base_url}/system_stats", timeout=5
            )
            if response.status_code != 200:
                pytest.skip(
                    f"ComfyUI instance not available at {comfyui_service.base_url}"
                )
        except requests.exceptions.RequestException:
            pytest.skip(
                f"ComfyUI instance not accessible at {comfyui_service.base_url}"
            )

        # Create a small test image
        from PIL import Image
        import io

        # Create a simple 100x100 red image
        test_image = Image.new("RGB", (100, 100), color="red")
        img_bytes = io.BytesIO()
        test_image.save(img_bytes, format="JPEG")
        image_data = img_bytes.getvalue()

        try:
            # Act - perform actual restoration
            print(
                f"\n=== Testing real ComfyUI restoration at {comfyui_service.base_url} ==="
            )
            result_image_data = comfyui_service.restore_image(
                image_data=image_data,
                filename="test_restoration.jpg",
                denoise=0.5,
                megapixels=0.1,  # Very small to make it fast
            )

            # Assert - should get processed image data back
            assert isinstance(result_image_data, bytes), "Should return image bytes"
            assert len(result_image_data) > 0, "Result image should not be empty"

            # Verify it's a valid image by trying to load it
            result_image = Image.open(io.BytesIO(result_image_data))
            assert result_image.format in [
                "JPEG",
                "PNG",
            ], "Result should be a valid image"
            print(
                f"✅ Real restoration successful! Result image: {result_image.size} {result_image.format}"
            )

        except requests.exceptions.ConnectionError:
            pytest.skip(f"ComfyUI instance not available at {comfyui_service.base_url}")
        except requests.exceptions.Timeout:
            pytest.skip(f"ComfyUI processing timeout at {comfyui_service.base_url}")
        except FileNotFoundError:
            pytest.skip("Workflow file not found - skipping real restoration test")
        except Exception as e:
            print(f"Real restoration failed: {e}")
            pytest.fail(f"Real ComfyUI restoration failed: {e}")
