"""
ComfyUI service for image restoration
"""

import requests
import json
import time
import os
from loguru import logger
from typing import Dict, Any, Optional
from pathlib import Path

from app.core.config import settings


class ComfyUIService:
    def __init__(self, base_url: str = None):
        if base_url is None:
            from app.core.config import settings
            base_url = settings.COMFYUI_URL
        self.base_url = base_url
        self.workflow_path = Path(__file__).parent.parent / "workflows" / "restore.json"

    def queue_prompt(self, prompt: Dict[str, Any]) -> Dict[str, Any]:
        """Queue a prompt for processing"""
        payload = {"prompt": prompt, "client_id": "rekindle_api"}
        try:
            response = requests.post(f"{self.base_url}/prompt", json=payload)
            response.raise_for_status()
            data = response.json()
            if "prompt_id" not in data:
                logger.warning("API Response: {}", data)
                raise ValueError("No prompt_id in response")
            return data
        except requests.exceptions.RequestException as e:
            logger.error("Error queuing prompt: {}", e)
            raise

    def wait_for_completion(self, prompt_id: str, timeout: int = 300) -> Dict[str, Any]:
        """Wait for prompt completion with timeout"""
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                response = requests.get(f"{self.base_url}/history/{prompt_id}")
                response.raise_for_status()
                data = response.json()

                if not data or prompt_id not in data:
                    logger.debug("No data for prompt_id yet...")
                    time.sleep(1.0)
                    continue

                prompt_data = data[prompt_id]
                status = prompt_data.get("status", {})
                status_str = status.get("status_str", "")

                if status_str == "success":
                    return prompt_data
                elif status_str == "error":
                    logger.error("Full error data: {}", prompt_data)
                    raise Exception(f"Error executing prompt: {prompt_data}")
                elif status_str == "executing":
                    progress = status.get("progress", 0)
                    logger.info("Progress: {:.1f}%", progress * 100)

                time.sleep(1.0)
            except Exception as e:
                logger.error("Error checking status: {}", e)
                time.sleep(1.0)

        raise TimeoutError(
            f"Prompt {prompt_id} did not complete within {timeout} seconds"
        )

    def download_image(self, image_info: Dict[str, Any]) -> bytes:
        """Download image from ComfyUI output"""
        try:
            filename = image_info.get("filename")
            subfolder = image_info.get("subfolder", "")

            image_url = f"{self.base_url}/view?filename={filename}&subfolder={subfolder}&type=output"

            response = requests.get(image_url)
            response.raise_for_status()

            logger.info("Successfully downloaded image: {}", filename)
            return response.content
        except Exception as e:
            logger.error("Error downloading image: {}", e)
            raise

    def upload_image(self, image_data: bytes, filename: str) -> str:
        """Upload image to ComfyUI input directory"""
        try:
            files = {"image": (filename, image_data, "image/png")}
            response = requests.post(f"{self.base_url}/upload/image", files=files)
            response.raise_for_status()

            logger.info("Successfully uploaded image: {}", filename)
            return filename
        except Exception as e:
            logger.error("Error uploading image: {}", e)
            raise

    def restore_image(
        self,
        image_data: bytes,
        filename: str,
        denoise: float = 0.7,
        megapixels: float = 1.0,
    ) -> bytes:
        """
        Restore an image using ComfyUI

        Args:
            image_data: Raw image bytes
            filename: Original filename for reference
            denoise: Denoising strength (0.0 to 1.0)
            megapixels: Target megapixels for upscaling

        Returns:
            Processed image bytes
        """
        # Upload the input image
        logger.info("Uploading image {}", filename)
        uploaded_filename = self.upload_image(image_data, filename)

        # Load the workflow
        with open(self.workflow_path, "r") as f:
            workflow = json.load(f)

        # Update workflow parameters
        workflow["78"]["inputs"]["image"] = uploaded_filename
        workflow["93"]["inputs"]["megapixels"] = megapixels
        workflow["3"]["inputs"]["denoise"] = denoise

        # Generate random seed
        import random

        workflow["3"]["inputs"]["seed"] = random.randint(1, 1000000)

        # Queue the prompt
        logger.info("Starting restoration of {}", uploaded_filename)
        logger.info("Settings: {}MP, {}% denoising", megapixels, denoise * 100)

        try:
            response = self.queue_prompt(workflow)
            prompt_id = response["prompt_id"]

            # Wait for completion
            logger.info("Processing...")
            result = self.wait_for_completion(prompt_id)

            logger.success("Restoration completed!")

            # Get the output image info
            output_images = result.get("outputs", {}).get("60", {}).get("images", [])
            if not output_images:
                raise ValueError("No output images found in result")

            # Download the processed image
            image_info = output_images[0]
            return self.download_image(image_info)

        except Exception as e:
            logger.error("Error during restoration: {}", e)
            raise


# Global instance
comfyui_service = ComfyUIService()
