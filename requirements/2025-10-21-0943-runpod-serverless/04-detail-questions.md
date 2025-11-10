# Detail Questions

## Q1: Should we upload images to the network volume via S3 API before job submission, or embed them in the request payload?
**Default if unknown:** Upload via S3 API (more reliable for large images, avoids 10MB payload limit)

## Q2: Should we create a new `backend/app/services/runpod_serverless.py` service or extend the existing `comfyui.py`?
**Default if unknown:** Create new service (separation of concerns, pod vs serverless are different execution modes)

## Q3: How should users select between pod and serverless modes - environment variable, per-job parameter, or automatic selection?
**Default if unknown:** Environment variable (simpler deployment configuration, easier to switch modes globally)

## Q4: What should happen if the webhook never arrives - implement fallback status polling or just mark as failed after timeout?
**Default if unknown:** Implement fallback polling (more robust, ensures jobs don't get stuck)

## Q5: Should the workflow JSON be uploaded to the network volume once and referenced, or sent with each job request?
**Default if unknown:** Send with each job request (allows dynamic parameter updates without filesystem coordination)
