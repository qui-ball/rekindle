#!/usr/bin/env python3
import os
import time
import uuid
import socket
import subprocess
import requests
import base64
import runpod

COMFY_DIR = "/app/ComfyUI"
COMFY_PORT = 8188
NETWORK_VOLUME_MOUNT_PATH = "/runpod-volume"
OUT_DIR = f"{NETWORK_VOLUME_MOUNT_PATH}/outputs"
IN_DIR = f"{NETWORK_VOLUME_MOUNT_PATH}/inputs"

_started = False


def wait_port(host, port, timeout=180):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            with socket.create_connection((host, port), timeout=2):
                return True
        except OSError:
            time.sleep(1)
    raise RuntimeError("ComfyUI failed to start")


def start_comfy_once():
    global _started
    if _started:
        return
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(IN_DIR, exist_ok=True)

    print("Starting ComfyUI server...")
    # start ComfyUI (headless, local only)
    cmd = [
        "python3",
        "main.py",
        "--listen",
        "127.0.0.1",
        "--port",
        str(COMFY_PORT),
        "--output-directory",
        OUT_DIR,
        "--input-directory",
        IN_DIR,
        "--disable-auto-launch",
        "--extra-model-paths-config",
        f"{NETWORK_VOLUME_MOUNT_PATH}/extra_model_paths.yaml",
    ]
    # Output to both stdout (for RunPod logs) and a file (for debugging)
    # Using stdout=None, stderr=None means inherit parent's stdout/stderr
    subprocess.Popen(cmd, cwd=COMFY_DIR)
    print(f"ComfyUI starting on port {COMFY_PORT}, waiting for readiness...")
    wait_port("127.0.0.1", COMFY_PORT, timeout=180)
    print("ComfyUI is ready, checking /object_info endpoint...")
    # optional small readiness ping
    requests.get(f"http://127.0.0.1:{COMFY_PORT}/object_info", timeout=10)
    print("ComfyUI fully started and ready!")
    _started = True


def submit_prompt(workflow):
    client_id = str(uuid.uuid4())
    r = requests.post(
        f"http://127.0.0.1:{COMFY_PORT}/prompt",
        json={"prompt": workflow, "client_id": client_id},
        timeout=30,
    )
    if r.status_code != 200:
        error_msg = f"ComfyUI Error Response ({r.status_code}): {r.text}"
        print(error_msg)
        raise RuntimeError(error_msg)
    return r.json()["prompt_id"]


def poll_until_done(prompt_id, poll=1.0):
    while True:
        r = requests.get(
            f"http://127.0.0.1:{COMFY_PORT}/history/{prompt_id}", timeout=30
        )
        r.raise_for_status()
        h = r.json()
        if prompt_id in h and "outputs" in h[prompt_id]:
            return h[prompt_id]["outputs"]
        time.sleep(poll)


def collect_files(outputs):
    files = []
    for node_out in outputs.values():
        for key in ("images", "videos", "audio"):
            for item in node_out.get(key, []):
                fn = item["filename"]
                sub = item.get("subfolder", "")
                p = os.path.join(OUT_DIR, sub, fn) if sub else os.path.join(OUT_DIR, fn)
                if os.path.exists(p):
                    files.append(p)
    return files


def read_output_files(file_paths, include_data=True):
    """
    Read output files and optionally include base64-encoded data

    Args:
        file_paths: List of file paths
        include_data: Whether to include base64-encoded file data in response

    Returns:
        List of file info dicts with optional data
    """
    result = []
    for path in file_paths:
        info = {"path": path}
        if include_data and os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    file_bytes = f.read()
                info["data"] = base64.b64encode(file_bytes).decode("utf-8")
                info["size"] = len(file_bytes)
                print(f"Read output file {path} ({len(file_bytes)} bytes)")
            except Exception as e:
                print(f"Failed to read output file {path}: {e}")
                info["error"] = str(e)
        result.append(info)
    return result


def upload_image_to_comfy(image_bytes, filename):
    """
    Upload image to ComfyUI via its /upload/image endpoint

    Args:
        image_bytes: Raw image bytes
        filename: Desired filename

    Returns:
        The saved filename from ComfyUI
    """
    url = f"http://127.0.0.1:{COMFY_PORT}/upload/image"
    files = {"image": (filename, image_bytes, "image/jpeg")}
    data = {"overwrite": "true"}  # Overwrite if file exists

    r = requests.post(url, files=files, data=data, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"Failed to upload image: {r.status_code} {r.text}")

    result = r.json()
    saved_name = result.get("name", filename)
    print(f"Uploaded image to ComfyUI: {saved_name} ({len(image_bytes)} bytes)")
    return saved_name


def handler(job):
    # expected: {"input": {"workflow_api": {...}, "image_data": "base64...", "image_filename": "...", "include_output_data": true}}
    job_input = job.get("input") or {}
    wf = job_input.get("workflow_api")
    if not wf:
        return {"error": "missing input.workflow_api"}

    # Start ComfyUI first
    start_comfy_once()

    # Handle image upload if provided (for datacenters without S3 API)
    # If image_data is present, the image was sent in the payload and needs to be saved
    # If not present, the image was already uploaded via S3 and is on the volume
    image_data_b64 = job_input.get("image_data")
    image_filename = job_input.get("image_filename")
    if image_data_b64 and image_filename:
        try:
            # Decode base64 image data
            image_bytes = base64.b64decode(image_data_b64)
            # Upload to ComfyUI via its official API (saves to input directory)
            upload_image_to_comfy(image_bytes, image_filename)
        except Exception as e:
            return {"error": f"Failed to upload input image: {str(e)}"}

    pid = submit_prompt(wf)
    outputs = poll_until_done(pid)
    file_paths = collect_files(outputs)

    # Check if caller requested output data in response (for datacenters without S3 API)
    include_output_data = job_input.get("include_output_data", False)

    result = {"prompt_id": pid, "files": file_paths, "file_count": len(file_paths)}

    # Include base64-encoded output files if requested
    if include_output_data:
        result["files_with_data"] = read_output_files(file_paths, include_data=True)

    return result


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
