# Detail Questions

## Q1: Should the script use your existing ComfyUI Docker image from `~/Git/ComfyUI-Rekindle/Dockerfile`?
**Default if unknown:** Yes (you already have a working RunPod-compatible ComfyUI image, makes sense to reuse it)

## Q2: Should the network volume ID be provided as a command-line argument, environment variable, or hardcoded in the script?
**Default if unknown:** Command-line argument (most flexible for standalone script, allows easy switching between volumes)

## Q3: What GPU types should be configurable? Should the script support a predefined list (e.g., RTX 4090, A5000) or accept any GPU type string?
**Default if unknown:** Accept any GPU type string as parameter (maximum flexibility, user can specify based on availability and cost)

## Q4: Should the script wait for the pod to be fully ready before returning, or just launch it and return the pod ID immediately?
**Default if unknown:** Wait for ready (ensures pod is actually running and accessible before script exits, safer for automation)

## Q5: After the job completes and the pod is terminated, should the script also handle downloading/managing any output files from the network volume?
**Default if unknown:** No (network volume persists independently, user can access files through other means, keeps script focused on pod lifecycle only)
