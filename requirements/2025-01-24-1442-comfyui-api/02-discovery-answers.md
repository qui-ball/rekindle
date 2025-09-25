# Discovery Answers

## Q1: Will this API be called directly from the frontend web application?
**Answer:** Yes

## Q2: Should the ComfyUI processing happen synchronously (wait for result) or asynchronously (job queue)?
**Answer:** Asynchronously (async)

## Q3: Will this API need to handle multiple concurrent restoration requests?
**Answer:** Yes

## Q4: Do you want to expose all the restoration parameters (megapixels, denoise, seed, prompt) to the API caller?
**Answer:** No, only denoise parameter

## Q5: Should restored images be stored permanently in cloud storage (S3)?
**Answer:** Yes