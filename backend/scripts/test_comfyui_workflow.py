#!/usr/bin/env python3
"""
Test ComfyUI workflow submission
"""

import json
import argparse
import requests
from pathlib import Path
from loguru import logger


def submit_workflow(
    comfyui_url: str,
    workflow_path: str,
    image_path: str | None = None,
    megapixels: float | None = None,
) -> dict:
    """
    Submit a workflow to ComfyUI and return the prompt ID

    Args:
        comfyui_url: Base URL of ComfyUI instance (e.g., https://pod-id-8188.proxy.runpod.net)
        workflow_path: Path to workflow JSON file

    Returns:
        Response from ComfyUI /prompt endpoint
    """
    # Load workflow
    workflow_file = Path(workflow_path)
    if not workflow_file.exists():
        raise FileNotFoundError(f"Workflow file not found: {workflow_path}")

    with open(workflow_file, 'r') as f:
        workflow_data = json.load(f)

    logger.info(f"Loaded workflow from {workflow_path}")
    logger.info(f"Preparing submission to ComfyUI at {comfyui_url}")

    # Accept both wrapped ({"prompt": {...}}) and raw node-graph JSON
    if isinstance(workflow_data, dict) and "prompt" in workflow_data:
        wrapper = workflow_data
        prompt = workflow_data["prompt"]
        # ensure client_id exists for consistency
        wrapper.setdefault("client_id", "rekindle_cli")
    else:
        prompt = workflow_data
        wrapper = {"prompt": prompt, "client_id": "rekindle_cli"}

    # Optionally upload image and patch the LoadImage node ("78")
    if image_path:
        img_path = Path(image_path)
        if not img_path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Guess a basic content-type from extension
        ext = img_path.suffix.lower().lstrip('.')
        mime = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'webp': 'image/webp',
            'heic': 'image/heic',
        }.get(ext, 'application/octet-stream')

        logger.info(f"Uploading image {img_path.name} to ComfyUI inputs...")
        with open(img_path, 'rb') as fh:
            files = {"image": (img_path.name, fh, mime)}
            resp = requests.post(f"{comfyui_url}/upload/image", files=files, timeout=60)
            resp.raise_for_status()

        # Patch the workflow's LoadImage node id "78"
        try:
            if "78" in prompt and "inputs" in prompt["78"]:
                prompt["78"]["inputs"]["image"] = img_path.name
                logger.info("Patched LoadImage node '78' with uploaded filename: {}", img_path.name)
            else:
                logger.warning("Workflow missing expected LoadImage node '78'; not patching image")
        except Exception:
            logger.warning("Could not patch LoadImage node '78' with image name")

    # Optionally override megapixels in ImageScaleToTotalPixels (node "93")
    if megapixels is not None:
        try:
            if "93" in prompt and "inputs" in prompt["93"]:
                prompt["93"]["inputs"]["megapixels"] = float(megapixels)
                logger.info("Set node '93' megapixels to {}MP", float(megapixels))
            else:
                logger.warning("Workflow missing expected scale node '93'; not setting megapixels")
        except Exception:
            logger.warning("Could not set megapixels on node '93'")

    # Submit to ComfyUI
    logger.info("Submitting workflow graph to /prompt ...")
    response = requests.post(f"{comfyui_url}/prompt", json=wrapper, timeout=60)

    response.raise_for_status()
    result = response.json()

    logger.success(f"Workflow submitted successfully!")
    logger.info(f"Prompt ID: {result.get('prompt_id')}")
    logger.info(f"Response: {json.dumps(result, indent=2)}")

    return result


def check_queue(comfyui_url: str) -> dict:
    """Check ComfyUI queue status"""
    response = requests.get(f"{comfyui_url}/queue", timeout=10)
    response.raise_for_status()
    return response.json()


def get_history(comfyui_url: str, prompt_id: str = None) -> dict:
    """Get execution history"""
    url = f"{comfyui_url}/history"
    if prompt_id:
        url = f"{url}/{prompt_id}"

    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def main():
    parser = argparse.ArgumentParser(
        description="Test ComfyUI workflow submission"
    )
    parser.add_argument(
        "--url",
        required=True,
        help="ComfyUI base URL (e.g., https://pod-id-8188.proxy.runpod.net)"
    )
    parser.add_argument(
        "--workflow",
        default="app/workflows/restore.json",
        help="Path to workflow JSON file (default: app/workflows/restore.json)"
    )
    parser.add_argument(
        "--image",
        default="tests/fixtures/old_photo_example.webp",
        help="Path to input image to upload and patch into workflow (default: tests/fixtures/old_photo_example.webp)"
    )
    parser.add_argument(
        "--megapixels",
        type=float,
        help="Override the workflow's total megapixels (e.g., 2.0)"
    )
    parser.add_argument(
        "--check-queue",
        action="store_true",
        help="Check queue status"
    )
    parser.add_argument(
        "--history",
        help="Get history for specific prompt ID"
    )

    args = parser.parse_args()

    try:
        if args.check_queue:
            logger.info("Checking queue status...")
            queue = check_queue(args.url)
            logger.info(f"Queue status:\n{json.dumps(queue, indent=2)}")

        elif args.history:
            logger.info(f"Getting history for prompt {args.history}...")
            history = get_history(args.url, args.history)
            logger.info(f"History:\n{json.dumps(history, indent=2)}")

        else:
            # Submit workflow, uploading image if provided
            result = submit_workflow(args.url, args.workflow, args.image, args.megapixels)

            logger.info("\nTo check status, run:")
            logger.info(f"  python scripts/test_comfyui_workflow.py --url {args.url} --check-queue")
            logger.info(f"  python scripts/test_comfyui_workflow.py --url {args.url} --history {result.get('prompt_id')}")

    except Exception as e:
        logger.error(f"Error: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit(main())
