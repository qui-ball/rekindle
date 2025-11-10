# Discovery Answers

## Q1: Do you want to completely replace the pod-based approach with serverless, or support both?
**Answer:** Both

**Notes:** System will support both pod-based and serverless execution modes, providing flexibility to choose based on workload characteristics.

---

## Q2: Will the serverless worker need to access the same network volume that your current pod setup uses?
**Answer:** Yes

**Notes:** Serverless worker must mount the same network volume to access ComfyUI models and maintain data continuity with the pod-based approach.

---

## Q3: Do you need real-time progress updates during image restoration, or can jobs be fully asynchronous?
**Answer:** Fully asynchronous with webhook notification

**Notes:** Using RunPod's webhook functionality:
- Celery task submits job to RunPod serverless with webhook parameter
- RunPod calls backend webhook when job completes
- Webhook handler downloads output from network volume via S3 API
- This decouples output collection from job execution

---

## Q4: Should the existing Celery task structure remain the same, with only the ComfyUI execution changing?
**Answer:** Yes, use webhooks with minimal changes to Celery task

**Notes:** Architecture decision:
- Celery task: Upload image → Submit to RunPod serverless with webhook → Store job ID → Exit
- RunPod: Executes job → Calls webhook on completion
- Webhook handler: Downloads from network volume (S3 API) → Uploads to AWS S3 → Updates database

RunPod network volumes support S3-compatible API (launched July 2025):
- Endpoint: `https://s3api-eu-cz-1.runpod.io/`
- Network volume ID: `366etpkt4g`
- Credentials already configured in `.env`
- Path mapping: `/workspace/outputs/file.jpg` → `s3://366etpkt4g/outputs/file.jpg`

---

## Q5: Do you already have a RunPod serverless endpoint deployed, or do we need to create the worker handler first?
**Answer:** Already have worker handler deployed

**Notes:**
- Worker handler exists at remote location: `~/Git/ComfyUI-Rekindle/rp_handler.py`
- Handler is already deployed as a RunPod serverless endpoint
- Need to integrate backend to call this existing endpoint

---
