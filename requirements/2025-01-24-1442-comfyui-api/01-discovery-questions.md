# Discovery Questions

## Q1: Will this API be called directly from the frontend web application?
**Default if unknown:** Yes (typical for web applications to call backend APIs)

## Q2: Should the ComfyUI processing happen synchronously (wait for result) or asynchronously (job queue)?
**Default if unknown:** No (async processing is better for long-running image tasks)

## Q3: Will this API need to handle multiple concurrent restoration requests?
**Default if unknown:** Yes (production systems typically need to handle concurrent requests)

## Q4: Do you want to expose all the restoration parameters (megapixels, denoise, seed, prompt) to the API caller?
**Default if unknown:** Yes (flexibility is usually preferred for image processing APIs)

## Q5: Should restored images be stored permanently in cloud storage (S3)?
**Default if unknown:** Yes (typical for production systems to persist processed images)