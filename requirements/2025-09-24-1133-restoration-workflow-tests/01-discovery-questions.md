# Discovery Questions

## Q1: Should the tests include integration tests that interact with real S3 and ComfyUI services?
**Default if unknown:** No (unit tests with mocks are more reliable and faster for CI/CD)

## Q2: Do you want tests to cover error handling scenarios like network failures and timeouts?
**Default if unknown:** Yes (error handling is critical for production reliability)

## Q3: Should the tests include performance and load testing for the restoration workflow?
**Default if unknown:** No (functional correctness is the primary concern for now)

## Q4: Do you want to test the entire async workflow including Celery task processing?
**Default if unknown:** Yes (the workflow is inherently async and needs end-to-end validation)

## Q5: Should the tests validate the actual image processing quality and output formats?
**Default if unknown:** No (focus on workflow logic rather than ComfyUI output quality)