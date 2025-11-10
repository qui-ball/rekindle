# Detail Answers

## Q1: Should we upload images to the network volume via S3 API before job submission, or embed them in the request payload?
**Answer:** Upload via S3 API to `/workspace/inputs/` and reference filename in workflow

**Notes:**
- Upload image to `s3://366etpkt4g/inputs/job_{job_id}.jpg` before submitting job
- Update workflow's image filename parameter to reference this path
- Handler reads from `/workspace/inputs/` (mounted network volume)
- Avoids 10MB payload limit
- More reliable for large images

---

## Q2: Should we create a new `backend/app/services/runpod_serverless.py` service or extend the existing `comfyui.py`?
**Answer:** Create new service

**Notes:**
- Create `backend/app/services/runpod_serverless.py`
- Keeps separation of concerns between pod-based ComfyUI and serverless execution
- Different APIs and interaction patterns warrant separate service
- Existing `comfyui.py` remains unchanged for pod-based workflows

---

## Q3: How should users select between pod and serverless modes - environment variable, per-job parameter, or automatic selection?
**Answer:** Environment variable with default to serverless

**Notes:**
- Add `COMFYUI_MODE` environment variable to `backend/app/core/config.py`
- Possible values: `serverless` (default) or `pod`
- Celery task checks this setting and calls appropriate service
- Simple deployment configuration - set once per environment
- Default to `serverless` for cost-effectiveness and auto-scaling

---

## Q4: What should happen if the webhook never arrives - implement fallback status polling or just mark as failed after timeout?
**Answer:** Just rely on webhooks

**Notes:**
- No fallback polling mechanism needed
- Assume webhooks always arrive
- Simpler implementation with no polling overhead
- If webhook fails, job will remain in pending state
- Can manually check RunPod dashboard if issues arise

---

## Q5: Should the workflow JSON be uploaded to the network volume once and referenced, or sent with each job request?
**Answer:** Send with each job request (Option B)

**Notes:**
- Send complete workflow JSON in each request payload
- Follows RunPod's official pattern from `runpod-workers/worker-comfyui`
- Load workflow from `backend/app/workflows/restore.json`
- Modify parameters (denoise, megapixels, filename) before sending
- Send as `{"input": {"workflow_api": {...}}}`
- Self-contained requests, no filesystem coordination needed
- Easy to modify parameters per job

---
