# Authentication & Authorization Test Plan

**Last Updated:** 2025-01-XX  
**Status:** Active  
**Related:** Task 6.2a, Task 6.2b

---

## Overview

This document outlines the test plan for authentication and authorization features, with a focus on photo ownership isolation and data segregation by user.

## Test Categories

### 1. Unit Tests (`tests/api/test_photos.py`)

**Purpose:** Test individual components and methods in isolation.

**Coverage:**
- ✅ Photo ownership assertion (`assert_owner()`)
- ✅ Security logging for ownership violations
- ✅ HTTP status code correctness (404 vs 403)
- ✅ List endpoint scoping
- ✅ Limit enforcement

**Run Command:**
```bash
pytest tests/api/test_photos.py -v
```

**Key Test Cases:**
- `test_assert_owner_success` - User owns photo
- `test_assert_owner_photo_not_found` - Photo doesn't exist
- `test_assert_owner_ownership_violation` - Photo belongs to another user
- `test_list_photos_scoped_to_user` - List only returns caller's photos
- `test_get_photo_ownership_violation` - GET returns 404 for other user's photo
- `test_delete_photo_ownership_violation` - DELETE returns 404 for other user's photo

---

### 2. Integration Tests (`tests/integration/test_photo_ownership.py`)

**Purpose:** Test complete workflows with multiple users and real database interactions.

**Coverage:**
- ✅ Complete user isolation (two users with distinct photos)
- ✅ List endpoint isolation
- ✅ All CRUD operations (GET, PUT, DELETE)
- ✅ Presigned URL generation isolation
- ✅ Download URL generation isolation

**Prerequisites:**
- Set `RUN_INTEGRATION_TESTS=1` environment variable
- Database must be accessible (PostgreSQL or SQLite)

**Run Command:**
```bash
RUN_INTEGRATION_TESTS=1 pytest tests/integration/test_photo_ownership.py -v
```

**Key Test Scenarios:**

#### Scenario 1: List Endpoint Isolation
- **Setup:** User1 has 3 photos, User2 has 2 photos
- **Test:** User1 requests `/api/v1/photos/`
- **Expected:** Returns only User1's 3 photos, not User2's photos
- **Test:** User2 requests `/api/v1/photos/`
- **Expected:** Returns only User2's 2 photos, not User1's photos

#### Scenario 2: Cross-User Access Prevention
- **Setup:** User1 and User2 each have photos
- **Test:** User1 attempts to GET User2's photo
- **Expected:** Returns 404 (not 403) to avoid leaking existence
- **Test:** User1 attempts to DELETE User2's photo
- **Expected:** Returns 404, photo remains undeleted
- **Test:** User1 attempts to UPDATE User2's photo
- **Expected:** Returns 404, photo metadata unchanged

#### Scenario 3: Presigned URL Isolation
- **Setup:** User1 and User2 each have photos
- **Test:** User1 requests download URL for User2's photo
- **Expected:** Returns 404 before attempting URL generation
- **Test:** User1 requests upload URL
- **Expected:** Generated URL scoped to User1's prefix only

#### Scenario 4: Complete Isolation
- **Setup:** Multiple users with multiple photos each
- **Test:** Each user can only see their own photos
- **Test:** Each user cannot access any other user's photos
- **Expected:** Complete isolation maintained

---

### 3. Storage Isolation Smoke Tests (`scripts/test_storage_isolation.py`)

**Purpose:** Validate storage service layer enforces user-scoped key structure.

**Coverage:**
- ✅ Key generation with user scoping
- ✅ Key validation prevents cross-user access
- ✅ Presigned URL conditions include user prefix
- ✅ Cross-user access prevention at storage layer

**Run Command:**
```bash
# Python script directly
python3 backend/scripts/test_storage_isolation.py

# Via shell wrapper (recommended)
./backend/scripts/test-presigned-access.sh
```

**Key Test Cases:**
- `test_key_generation` - Keys are user-scoped
- `test_key_validation` - Validation prevents cross-user access
- `test_presigned_url_conditions` - URLs include prefix conditions
- `test_cross_user_access_prevention` - Storage layer blocks cross-user access

**CI/CD Integration:**
```yaml
# Example GitHub Actions step
- name: Test Storage Isolation
  run: |
    cd backend
    ./scripts/test-presigned-access.sh
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## Test Scenarios

### Scenario A: User Views Their Own Photos

**Given:** User1 is authenticated and has 5 photos  
**When:** User1 requests `GET /api/v1/photos/`  
**Then:**
- Status code: 200 OK
- Response contains exactly 5 photos
- All photos have `owner_id` matching User1's ID
- No photos from other users are included

**Test Files:**
- `tests/api/test_photos.py::TestPhotoEndpointsOwnership::test_list_photos_scoped_to_user`
- `tests/integration/test_photo_ownership.py::TestPhotoOwnershipIsolation::test_list_endpoint_only_returns_caller_assets`

---

### Scenario B: User Attempts to Access Another User's Photo

**Given:** User1 is authenticated, User2 has a photo  
**When:** User1 requests `GET /api/v1/photos/{user2_photo_id}`  
**Then:**
- Status code: 404 Not Found (not 403)
- Error message: "Photo not found"
- Security log entry created with event_type: `photo_ownership_violation`
- Photo remains accessible to User2

**Test Files:**
- `tests/api/test_photos.py::TestPhotoEndpointsOwnership::test_get_photo_ownership_violation`
- `tests/integration/test_photo_ownership.py::TestPhotoOwnershipIsolation::test_get_photo_returns_404_for_other_user`

---

### Scenario C: User Attempts to Download Another User's Photo

**Given:** User1 is authenticated, User2 has a photo  
**When:** User1 requests `GET /api/v1/photos/{user2_photo_id}/download-url`  
**Then:**
- Status code: 404 Not Found
- Presigned URL is NOT generated
- Storage service is NOT called
- Security log entry created

**Test Files:**
- `tests/integration/test_photo_ownership.py::TestPhotoOwnershipIsolation::test_download_url_fails_for_other_user`
- `tests/integration/test_photo_ownership.py::TestPhotoOwnershipIsolation::test_presigned_url_generation_fails_for_mismatched_ownership`

---

### Scenario D: User Attempts to Delete Another User's Photo

**Given:** User1 is authenticated, User2 has a photo  
**When:** User1 requests `DELETE /api/v1/photos/{user2_photo_id}`  
**Then:**
- Status code: 404 Not Found
- Photo status remains unchanged (not deleted)
- Photo still accessible to User2
- Security log entry created

**Test Files:**
- `tests/api/test_photos.py::TestPhotoEndpointsOwnership::test_delete_photo_ownership_violation`
- `tests/integration/test_photo_ownership.py::TestPhotoOwnershipIsolation::test_delete_photo_fails_for_other_user`

---

### Scenario E: Presigned Upload URL Scoping

**Given:** User1 is authenticated  
**When:** User1 requests `POST /api/v1/photos/presigned-upload`  
**Then:**
- Status code: 200 OK
- Generated S3 key starts with `users/{user1_id}/`
- Presigned URL conditions include user prefix
- URL cannot be used to upload to another user's prefix

**Test Files:**
- `tests/integration/test_photo_ownership.py::TestPhotoOwnershipIsolation::test_presigned_upload_url_scoped_to_user`
- `scripts/test_storage_isolation.py::test_presigned_url_conditions`

---

## Regression Tests

### S3 Smoke Script (`scripts/test-presigned-access.sh`)

**Purpose:** Quick validation that storage isolation is working.

**When to Run:**
- Before each deployment
- In CI/CD pipeline
- After storage configuration changes
- After IAM policy updates

**What It Tests:**
- Key generation scoping
- Key validation logic
- Presigned URL conditions
- Cross-user access prevention

**Exit Codes:**
- `0` - All tests passed
- `1` - Tests failed
- `2` - Prerequisites not met

---

## Security Logging Verification

All ownership violation attempts should be logged with:
- Event type: `photo_ownership_violation`
- Requesting user ID
- Photo ID
- Photo owner ID
- IP address
- Timestamp

**Verification:**
```python
# In tests, verify logs are created
with caplog.at_level("WARNING"):
    # Attempt cross-user access
    response = client.get(f"/api/v1/photos/{other_user_photo.id}")
    
    # Verify log was created
    violation_logs = [
        r for r in caplog.records
        if r.extra.get("event_type") == "photo_ownership_violation"
    ]
    assert len(violation_logs) > 0
```

---

## Test Execution

### Local Development

```bash
# Run unit tests (fast, no external dependencies)
pytest tests/api/test_photos.py -v

# Run integration tests (requires database)
RUN_INTEGRATION_TESTS=1 pytest tests/integration/test_photo_ownership.py -v

# Run storage isolation smoke test
cd backend && ./scripts/test-presigned-access.sh
```

### CI/CD Pipeline

```yaml
# Example GitHub Actions workflow
- name: Run Photo Ownership Tests
  run: |
    # Unit tests
    pytest tests/api/test_photos.py -v --cov=app
    
    # Integration tests
    RUN_INTEGRATION_TESTS=1 pytest tests/integration/test_photo_ownership.py -v
    
    # Storage isolation smoke test
    cd backend && ./scripts/test-presigned-access.sh
  env:
    DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Staging Environment

```bash
# Run full test suite
RUN_INTEGRATION_TESTS=1 pytest tests/integration/test_photo_ownership.py -v

# Run smoke test
./backend/scripts/test-presigned-access.sh
```

---

## Test Coverage Goals

- **Unit Tests:** ≥90% coverage for ownership assertion logic
- **Integration Tests:** All critical user flows covered
- **Smoke Tests:** All storage isolation scenarios covered

**Current Coverage:**
- Unit Tests: ✅ Complete
- Integration Tests: ✅ Complete
- Smoke Tests: ✅ Complete

---

## Known Issues & Limitations

### None Currently

All test scenarios are passing and coverage is complete.

---

## Future Enhancements

1. **Performance Tests**
   - Load testing with multiple concurrent users
   - Database query performance under load
   - Presigned URL generation performance

2. **Edge Case Tests**
   - Deleted photos (should they be accessible?)
   - Archived photos
   - Photos with missing keys
   - Concurrent access scenarios

3. **Security Tests**
   - SQL injection attempts
   - Path traversal attempts
   - UUID enumeration attempts
   - Rate limiting under attack

---

## References

- Task 6.2a: Enforce Photo Ownership Guards (Backend)
- Task 6.2b: Ownership Isolation Tests (QA)
- Storage Documentation: `docs/storage/README.md`
- API Documentation: `backend/app/api/v1/photos.py`

---

## Changelog

- **2025-01-XX:** Initial test plan created for Task 6.2b
- **2025-01-XX:** Added integration test scenarios
- **2025-01-XX:** Added smoke test documentation


