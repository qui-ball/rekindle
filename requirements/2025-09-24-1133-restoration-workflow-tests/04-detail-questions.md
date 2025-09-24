# Detail Questions

## Q6: Should we create a separate test database or use SQLite in-memory for testing?
**Default if unknown:** Use SQLite in-memory (faster, isolated, no setup required)

## Q7: Should we test the Celery task using the eager mode or with a real worker instance?
**Default if unknown:** Use eager mode for unit tests, real worker for integration tests

## Q8: Should we create test fixtures for the ComfyUI workflow JSON in `backend/app/workflows/restore.json`?
**Default if unknown:** Yes (allows testing workflow parameter injection and validation)

## Q9: Should tests include validation of the S3 key generation patterns used in `app/services/s3.py`?
**Default if unknown:** Yes (ensures consistent file organization and prevents key collisions)

## Q10: Should we test the job status transitions in the database model at `app/models/restoration.py`?
**Default if unknown:** Yes (validates the state machine behavior is correct)