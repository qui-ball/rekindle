# Expert Requirements Questions

## Q6: Should the restoration job status be persisted in the PostgreSQL database for tracking and history?
**Default if unknown:** Yes (enables job tracking, retry logic, and user history)

## Q7: Do you want to implement webhook callbacks to notify the frontend when a restoration job completes?
**Default if unknown:** No (polling is simpler for initial implementation)

## Q8: Should failed restoration jobs automatically retry with exponential backoff?
**Default if unknown:** Yes (improves reliability for transient failures)

## Q9: Do you want to limit the number of concurrent restoration jobs per user?
**Default if unknown:** Yes (prevents resource exhaustion and ensures fair usage)

## Q10: Should the original uploaded images be kept in S3 after processing completes?
**Default if unknown:** Yes (allows users to re-process with different settings)