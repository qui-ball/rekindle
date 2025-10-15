# Detail Answers

## Q1: Should the script use your existing ComfyUI Docker image from `~/Git/ComfyUI-Rekindle/Dockerfile`?
**Answer:** Yes - user already built the image at `bilunsun/comfyuiprod:pod-test-0`

## Q2: Should the network volume ID be provided as a command-line argument, environment variable, or hardcoded in the script?
**Answer:** Hardcoded for now

## Q3: What GPU types should be configurable? Should the script support a predefined list (e.g., RTX 4090, A5000) or accept any GPU type string?
**Answer:** Yes, support filtering/limiting GPU types as parameter. Note: GPU types will be restricted by the network volume's datacenter location

## Q4: Should the script wait for the pod to be fully ready before returning, or just launch it and return the pod ID immediately?
**Answer:** Wait for ready

## Q5: After the job completes and the pod is terminated, should the script also handle downloading/managing any output files from the network volume?
**Answer:** No

