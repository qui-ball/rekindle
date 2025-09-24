# Detail Answers

## Q6: Should we create a separate test database or use SQLite in-memory for testing?
**Answer:** Use SQLite in-memory

## Q7: Should we test the Celery task using the eager mode or with a real worker instance?
**Answer:** Use eager mode for unit tests, real worker for integration tests (default)

## Q8: Should we create test fixtures for the ComfyUI workflow JSON in `backend/app/workflows/restore.json`?
**Answer:** No

## Q9: Should tests include validation of the S3 key generation patterns used in `app/services/s3.py`?
**Answer:** Yes

## Q10: Should we test the job status transitions in the database model at `app/models/restoration.py`?
**Answer:** Yes