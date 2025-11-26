# CA-MTL-3 Setup Guide (No S3 API)

## Problem
The CA-MTL-3 datacenter does NOT support RunPod's S3 API. The endpoint `s3api-ca-mtl-3.runpod.io` does not exist.

## Solution
The system now **automatically detects** if S3 API is available and adapts accordingly:
- ✅ If S3 API works: uploads/downloads via S3 (faster, more efficient)
- ✅ If S3 API fails: sends data in job payload (works everywhere, including CA-MTL-3)

**No manual configuration needed!** The system auto-detects on startup.

## Changes Made

### 1. Updated Handler (`backend/comfyui_files/rp_handler.py`)
- Now accepts base64-encoded image data in the job payload
- Writes images to the network volume's `/runpod-volume/inputs/` directory
- Returns output images as base64-encoded data in the response
- **You MUST upload this to your RunPod serverless endpoint**

### 2. Updated RunPod Service (`backend/app/services/runpod_serverless.py`)
- **Auto-detects S3 API availability** on initialization
- `submit_job()` automatically includes image data in payload if S3 not available
- Sets `include_output_data=true` to request output data when needed

### 3. Updated Celery Task (`backend/app/workers/tasks/jobs.py`)
- Checks `runpod_serverless_service.s3_available` flag
- Automatically uses S3 upload or payload method based on detection

### 4. Updated Webhook Handler (`backend/app/api/v1/webhooks.py`)
- Checks for `files_with_data` in webhook payload
- Decodes base64 output data if present (non-S3 datacenters)
- Falls back to S3 download for supported datacenters

## Setup Instructions

### Step 1: Update Your `.env` File

```bash
# CA-MTL-3 Network Volume Settings
RUNPOD_NETWORK_VOLUME_ID=6lv4t9nr61

# S3 settings (system will auto-detect if these work)
RUNPOD_S3_ENDPOINT=https://s3api-ca-mtl-3.runpod.io/
RUNPOD_S3_REGION=ca-mtl-3
```

**Note:** The system will automatically detect that the S3 endpoint is not available and switch to payload mode. No need for manual configuration!

### Step 2: Deploy Updated Handler to RunPod

You need to upload the updated `rp_handler.py` to your network volume:

```bash
cd backend

# Upload the handler to your network volume
# (This will update the existing handler file)
RUNPOD_NETWORK_VOLUME_ID=6lv4t9nr61 \
  uv run python scripts/runpod_upload.py upload \
  comfyui_files/rp_handler.py \
  --dest rp_handler.py
```

**Alternative:** If you have SSH access to a pod:
1. Launch a pod in CA-MTL-3 with the volume attached
2. Upload via SCP/SFTP
3. Place at `/runpod-volume/rp_handler.py`

### Step 3: Restart Your Serverless Endpoint (if needed)

The handler is loaded when each worker starts, so:
- New requests will automatically use the updated handler
- Or manually restart the endpoint in RunPod dashboard

### Step 4: Restart Your Services

```bash
# Restart Docker services to pick up new environment variables
docker-compose down
docker-compose up -d
```

### Step 5: Test

Submit a restoration job through your frontend and check the logs.

## How It Works

### Upload Flow (CA-MTL-3):
1. User uploads image → Celery worker receives it
2. Worker base64-encodes image data
3. Worker submits job with image data in payload
4. RunPod handler decodes and saves to `/runpod-volume/inputs/`
5. ComfyUI processes the image
6. Handler reads output file and base64-encodes it
7. Handler returns output data in webhook response

### Download Flow (CA-MTL-3):
1. Webhook receives completion with `files_with_data`
2. Backend decodes base64 output data
3. Backend uploads to AWS S3 for user delivery

## File Management on CA-MTL-3

Since S3 API isn't available, you have these options:

### Option A: Launch a Pod
```bash
# 1. Launch a pod in CA-MTL-3 datacenter
# 2. Attach network volume 6lv4t9nr61
# 3. Access files at /workspace/ or /runpod-volume/
# 4. Use the pod's terminal or SSH
```

### Option B: Switch Volume (If Needed)
You also have volume `vw7o2iyjlt` in US-IL-1 which **does** support S3 API:

```bash
# To use US-IL-1 volume instead:
RUNPOD_NETWORK_VOLUME_ID=vw7o2iyjlt
RUNPOD_S3_ENDPOINT=https://s3api-us-il-1.runpod.io/
RUNPOD_S3_REGION=us-il-1
# System will auto-detect S3 is available and use it
```

## Advantages of This Approach

✅ Works in ANY datacenter (S3 API not required)  
✅ No DNS resolution issues  
✅ Simpler architecture  
✅ Direct data transfer  

## Disadvantages

⚠️ Image data is base64-encoded (33% larger in transit)  
⚠️ May hit payload size limits for very large images  
⚠️ Cannot manually browse/manage files via S3 API

## Payload Size Limits

- RunPod serverless has a 10MB request limit
- Base64 encoding adds ~33% overhead
- Max original image size: ~7.5MB
- Your app has 50MB upload limit, so may need to compress before sending

If you need larger images, you'll need to either:
1. Use a datacenter with S3 API support (US-IL-1, EU-CZ-1, etc.)
2. Launch a pod for file management

## Questions?

Check the logs:
```bash
# Backend logs
docker-compose logs -f backend

# Celery worker logs
docker-compose logs -f celery

# Check RunPod endpoint logs in dashboard
```

