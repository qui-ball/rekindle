# Discovery Questions

## Q1: Do you want to completely replace the pod-based approach with serverless, or support both?
**Default if unknown:** Replace completely (serverless is more cost-effective and auto-scales)

## Q2: Will the serverless worker need to access the same network volume that your current pod setup uses?
**Default if unknown:** Yes (maintaining data continuity is important)

## Q3: Do you need real-time progress updates during image restoration, or can jobs be fully asynchronous?
**Default if unknown:** Fully asynchronous (serverless works best with async queue-based processing)

## Q4: Should the existing Celery task structure remain the same, with only the ComfyUI execution changing?
**Default if unknown:** Yes (minimize changes to the rest of the system)

## Q5: Do you already have a RunPod serverless endpoint deployed, or do we need to create the worker handler first?
**Default if unknown:** Need to create worker handler (starting from scratch with serverless)
