### Test s3
`RUN_INTEGRATION_TESTS=1 uv run pytest tests/services/test_s3.py -v`

### Test DB
`uv run pytest tests/models/ tests/api/ tests/workers/ -v --tb=short`