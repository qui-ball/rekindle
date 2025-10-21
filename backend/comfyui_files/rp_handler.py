#!/usr/bin/env python3
import os, time, uuid, socket, subprocess, requests
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
    # Enable logging to see ComfyUI startup errors
    log_file = open(f"{NETWORK_VOLUME_MOUNT_PATH}/comfyui_startup.log", "w")
    subprocess.Popen(cmd, cwd=COMFY_DIR, stdout=log_file, stderr=subprocess.STDOUT)
    wait_port("127.0.0.1", COMFY_PORT, timeout=180)
    # optional small readiness ping
    requests.get(f"http://127.0.0.1:{COMFY_PORT}/object_info", timeout=10)
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


def handler(job):
    # expected: {"input": {"workflow_api": {...}}}
    wf = (job.get("input") or {}).get("workflow_api")
    if not wf:
        return {"error": "missing input.workflow_api"}

    start_comfy_once()
    pid = submit_prompt(wf)
    outputs = poll_until_done(pid)
    files = collect_files(outputs)

    return {"prompt_id": pid, "files": files, "file_count": len(files)}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
