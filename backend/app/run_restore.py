import requests
import json
import time
import os
from loguru import logger
from PIL import Image
import io


def queue_prompt(prompt):
    p = {"prompt": prompt, "client_id": "restore_script"}
    try:
        response = requests.post("http://127.0.0.1:8188/prompt", json=p)
        response.raise_for_status()
        data = response.json()
        if "prompt_id" not in data:
            logger.warning("API Response: {}", data)
            raise ValueError("No prompt_id in response")
        return data
    except requests.exceptions.RequestException as e:
        logger.error("Error queuing prompt: {}", e)
        logger.debug("Response content: {}", response.text)
        raise


def wait_for_completion(prompt_id):
    while True:
        try:
            response = requests.get(f"http://127.0.0.1:8188/history/{prompt_id}")
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


def download_and_show_image(image_info):
    """Download and display an image from ComfyUI's output."""
    try:
        # Parse the image info
        if isinstance(image_info, str):
            image_info = json.loads(image_info)

        filename = image_info.get("filename")
        subfolder = image_info.get("subfolder", "")

        # Construct the download URL
        image_url = f"http://127.0.0.1:8188/view?filename={filename}&subfolder={subfolder}&type=output"

        # Download the image
        response = requests.get(image_url)
        response.raise_for_status()

        # Convert to PIL Image and display
        image = Image.open(io.BytesIO(response.content))
        image.show()

        logger.info("Successfully downloaded and displayed image: {}", filename)
        return image
    except Exception as e:
        logger.error("Error downloading/displaying image: {}", e)
        raise


def upload_image(image_path):
    """Upload an image to ComfyUI's input directory."""
    try:
        # Read the image file
        with open(image_path, "rb") as f:
            image_data = f.read()

        # Upload to ComfyUI
        filename = os.path.basename(image_path)
        files = {
            "image": (filename, image_data, "image/png")  # Adjust mime type if needed
        }
        response = requests.post("http://127.0.0.1:8188/upload/image", files=files)
        response.raise_for_status()

        logger.info("Successfully uploaded image: {}", filename)
        return filename
    except Exception as e:
        logger.error("Error uploading image: {}", e)
        raise


def restore_image(
    input_image_path,
    output_prefix="output/restored",
    megapixels=1.0,
    denoise=0.7,
    prompt=None,
    seed=None,
):
    # First, upload the input image
    logger.info("Uploading image {}", input_image_path)
    uploaded_filename = upload_image(input_image_path)

    # Load the workflow
    with open("restore.json", "r") as f:
        workflow = json.load(f)

    # Update input image with the uploaded filename
    workflow["78"]["inputs"]["image"] = uploaded_filename

    # Update megapixels for scaling
    workflow["93"]["inputs"]["megapixels"] = megapixels

    # Update denoising strength
    workflow["3"]["inputs"]["denoise"] = denoise
    if seed is not None:
        workflow["3"]["inputs"]["seed"] = seed

    # Update prompt if provided, otherwise keep the default restoration prompt
    if prompt is not None:
        workflow["76"]["inputs"]["prompt"] = prompt

    # Update output settings
    workflow["60"]["inputs"]["filename_prefix"] = output_prefix

    # Queue the prompt
    logger.info("Starting restoration of {}", uploaded_filename)
    logger.info("Settings: {}MP, {}% denoising", megapixels, denoise * 100)
    if seed is not None:
        logger.info("Seed: {}", seed)

    try:
        response = queue_prompt(workflow)
        prompt_id = response["prompt_id"]

        # Wait for completion
        logger.info("Processing...")
        result = wait_for_completion(prompt_id)

        logger.success("Restoration completed!")
        output_path = (
            result.get("outputs", {}).get("60", {}).get("images", ["unknown"])[0]
        )
        logger.info("Restored image saved to: {}", output_path)
        return output_path
    except Exception as e:
        logger.error("Error during restoration: {}", e)
        raise


if __name__ == "__main__":
    # Configure logger - console only
    logger.remove()  # Remove default handler
    logger.add(
        lambda msg: print(msg),
        colorize=True,
        format="<level>{message}</level>",
        level="INFO",
    )

    # Example usage
    output_info = restore_image(
        input_image_path="old_photo_example.png",  # Change this to your input image
        output_prefix="output/restored_photo",
        megapixels=1.0,  # Adjust based on your needs (higher = more detailed but slower)
        denoise=0.7,  # 0.0 to 1.0, higher = more restoration but less preservation
        seed=12345,  # Optional: set a seed for reproducible results
        # prompt="Your custom restoration prompt here..."
    )

    # Download and display the restored image
    download_and_show_image(output_info)
