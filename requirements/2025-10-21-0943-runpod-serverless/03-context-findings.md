# Context Findings

## Existing RunPod Handler Analysis

From `bilunsun@bilunsun-desktop-internal:~/Git/ComfyUI-Rekindle/rp_handler.py`:

### Handler Contract
- **Input format**: `{"input": {"workflow_api": {...}}}`
- **Output format**: `{"prompt_id": "...", "files": [...], "file_count": N}`
- **File paths returned**: Absolute paths on network volume (e.g., `/workspace/outputs/...`)

### Key Behaviors
1. Starts ComfyUI on first invocation (warm start pattern)
2. Uses `/workspace/outputs` for output files (network volume)
3. Uses `/workspace/inputs` for input files (network volume)
4. Polls ComfyUI synchronously until completion
5. Returns list of output file paths

### Integration Implications
- Backend must provide workflow in `workflow_api` format (JSON)
- Handler returns file paths, but files remain on network volume
- Backend webhook must download files via S3 API using returned paths

---

## Current Backend Architecture

### ComfyUI Service (`backend/app/services/comfyui.py`)
**Current behavior** (pod-based):
- Connects to single ComfyUI instance at `COMFYUI_URL`
- Uploads images via POST `/upload/image`
- Queues prompts via POST `/prompt`
- Polls history via GET `/history/{prompt_id}`
- Downloads images via GET `/view?filename=...`

**Key methods**:
- `upload_image(image_data, filename)` → Returns filename
- `queue_prompt(workflow)` → Returns `{prompt_id: ...}`
- `wait_for_completion(prompt_id)` → Returns completion data
- `download_image(image_info)` → Returns image bytes
- `restore_image(image_data, filename, denoise, megapixels)` → Orchestrates full workflow

### Celery Task (`backend/app/workers/tasks/jobs.py`)
**Current `process_restoration` task flow**:
1. Download uploaded image from S3
2. Call `comfyui_service.restore_image()` which:
   - Uploads image to ComfyUI
   - Loads workflow from `/app/workflows/restore.json`
   - Updates workflow parameters (filename, megapixels, denoise)
   - Queues prompt and waits for completion
   - Downloads result
3. Upload restored image to S3
4. Create RestoreAttempt record
5. Update Job record

**Key observations**:
- Task blocks waiting for ComfyUI completion (synchronous)
- Workflow loaded from file: `backend/app/workflows/restore.json`
- Parameters: `denoise` (0.7 default), `megapixels` (1.0 default)

---

## Network Volume Configuration

**Volume ID**: `366etpkt4g`
**Datacenter**: EU-CZ-1
**Mount paths**:
- Pods: `/workspace/`
- Serverless: `/runpod-volume/` (may differ - need to verify)

**S3 API access**:
- Endpoint: `https://s3api-eu-cz-1.runpod.io/`
- Access key: `user_2fT6qL16CnUzEMTJcOkhp85cRtU` (from `.env`)
- Secret key: `rps_XOGVF70PZ1552WAPYRWO7YJSMA89MHK2D5DIDXA11tct0s` (from `.env`)

**Path mapping**:
```
Pod/Serverless:  /workspace/outputs/restored.jpg
S3 API:         s3://366etpkt4g/outputs/restored.jpg
```

---

## Workflow File Analysis

Location: `backend/app/workflows/restore.json`

**Parameters updated by current code** (from `comfyui.py:133-135`):
- Node 78: `inputs.image` → Uploaded filename
- Node 93: `inputs.megapixels` → Target megapixels
- Node 3: `inputs.denoise` → Denoising strength
- Node 3: `inputs.seed` → Random seed

**Output node**: Node 60 (`outputs.60.images[]`)

---

## Configuration Files

### `backend/app/core/config.py`
Current RunPod-related settings:
- `RUNPOD_API_KEY` (line 36) - For serverless API calls
- `RUNPOD_S3_ACCESS_KEY` (line 37) - For network volume S3 access
- `RUNPOD_S3_SECRET_KEY` (line 38) - For network volume S3 access
- `COMFYUI_URL` (line 60) - Currently points to local/pod instance

**Missing settings needed**:
- `RUNPOD_ENDPOINT_ID` - Serverless endpoint identifier
- `RUNPOD_NETWORK_VOLUME_ID` - Network volume for S3 operations
- `RUNPOD_S3_ENDPOINT_URL` - S3 API endpoint URL
- `RUNPOD_S3_REGION` - Datacenter region

---

## Files That Need Modification

### 1. `backend/app/core/config.py`
Add serverless configuration settings

### 2. `backend/app/services/comfyui.py` OR create new `backend/app/services/runpod.py`
Create service to interact with RunPod serverless endpoint

### 3. `backend/app/workers/tasks/jobs.py`
Modify `process_restoration` task to:
- Support both pod and serverless modes
- Upload image to network volume via S3
- Submit job to serverless with webhook
- Exit without waiting

### 4. `backend/app/api/v1/webhooks.py` (NEW)
Create webhook endpoint to receive RunPod completion notifications

### 5. Database models (possibly)
May need to track RunPod job IDs in RestoreAttempt model

---

## Technical Constraints & Considerations

### Image Upload Strategy
**Current approach**: Upload via ComfyUI HTTP API
**Serverless approach options**:
1. Upload to network volume via S3 API before job submission
2. Pass image as base64 in job input (limited by 10MB payload size)
3. Upload to AWS S3, pass URL, have handler download

**Recommendation**: Option 1 (S3 API upload) for consistency

### Webhook Security
- No authentication mechanism mentioned in RunPod docs
- Should validate webhook source (check job ID exists in DB)
- Consider adding webhook secret/signature verification

### Error Handling
- What if webhook never arrives? (job failed, network issue)
- Need timeout mechanism to check job status
- Consider implementing status polling as fallback

### Dual Mode Support
To support both pod and serverless:
- Add mode configuration (environment variable or per-job setting)
- Abstract ComfyUI interaction behind common interface
- Keep existing pod launcher for large batch jobs

---

## Related Features & Patterns

### Similar webhook implementation needed
Reference: Stripe webhook handler pattern (if exists in codebase)

### Similar S3 service pattern
From `backend/app/services/s3.py`:
- Already has boto3 S3 client setup
- Can extend or create separate RunPod S3 client

### Job state management
From `backend/app/models/jobs.py`:
- Job status tracking
- RestoreAttempt for each restoration
- May need additional fields for RunPod job IDs

---

## Questions for Detail Phase

Based on this analysis, need to clarify:

1. How to handle image upload (S3 vs embedded)?
2. Should we modify existing comfyui.py or create separate runpod.py service?
3. How to configure mode selection (pod vs serverless)?
4. Fallback mechanism if webhook fails?
5. How to handle the workflow file - send it or reference network volume path?
