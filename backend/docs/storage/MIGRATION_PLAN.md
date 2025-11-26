# S3 Storage Migration Plan: User-Scoped Segmentation

## Overview

This document outlines the migration plan for moving from flat S3 key structure to user-scoped storage segmentation for enhanced security and data isolation.

## Current State

### Current S3 Key Structure (Flat)
- `uploaded/{job_id}.{ext}` - Original uploaded images
- `restored/{job_id}/{restore_id}.{ext}` - Restored images
- `thumbnails/{job_id}.jpg` - Thumbnails
- `animated/{job_id}/{animation_id}_{suffix}.mp4` - Animation videos
- `meta/{job_id}.json` - Metadata files

### Current Database State
- `photos` table exists with `owner_id` field
- Photo records may have keys in old flat format
- Some photos may not have `owner_id` populated (if created before user auth)

## Target State

### New User-Scoped Key Structure
- `users/{user_id}/raw/{photo_id}/original.{ext}` - Original uploaded images
- `users/{user_id}/processed/{photo_id}/restored.{ext}` - Processed/restored images
- `users/{user_id}/thumbs/{photo_id}.jpg` - Thumbnails
- `users/{user_id}/animated/{photo_id}/{animation_id}_{suffix}.mp4` - Animation videos
- `users/{user_id}/meta/{photo_id}.json` - Metadata files

### Benefits
1. **Security**: IAM policies can restrict access to `users/{user_id}/*` prefix
2. **Isolation**: Users cannot access other users' data even with direct S3 access
3. **Compliance**: Easier to implement GDPR data export/deletion
4. **Auditing**: Clear ownership trail in S3 key structure

## Migration Strategy

### Phase 1: Dual-Write (Backward Compatible)
- New uploads use user-scoped keys
- Old keys continue to work for existing data
- Presigned URLs enforce prefix conditions for new uploads
- Duration: 1-2 weeks

### Phase 2: Data Migration (If Needed)
**Only if there are existing photos in the database:**

1. **Identify existing photos**:
   ```sql
   SELECT id, owner_id, original_key, processed_key, thumbnail_key 
   FROM photos 
   WHERE original_key NOT LIKE 'users/%';
   ```

2. **For each photo with owner_id**:
   - Generate new user-scoped keys
   - Copy S3 objects to new location
   - Update database records with new keys
   - Delete old S3 objects after verification

3. **For photos without owner_id**:
   - Mark as `archived` status
   - Document for manual review
   - Optionally delete after retention period

### Phase 3: Cleanup
- Remove old flat key support
- Update all code to use user-scoped keys only
- Verify no references to old key structure remain

## Implementation Steps

### Step 1: Create StorageService
- New service that wraps S3Service
- Enforces user-scoped key generation
- Validates user_id in all operations

### Step 2: Update Presigned URL Generation
- Add prefix conditions: `["starts-with", "$key", "users/{user_id}/"]`
- Add content-length-range conditions
- Enforce user_id validation

### Step 3: Update IAM Policies
- Restrict service role to `users/*` prefix
- Test cross-user access prevention

### Step 4: Migration Script (If Needed)
- Only run if existing photos found
- Batch process with error handling
- Log all operations
- Rollback capability

### Step 5: Testing
- Smoke test: Verify cross-user access fails
- Integration test: Verify user-scoped operations work
- Load test: Verify performance impact

## Rollback Plan

If migration fails:
1. Revert code changes
2. Old flat keys continue to work
3. New user-scoped keys remain in S3 (can be cleaned up later)
4. Database records can be updated back to old keys

## Risk Assessment

### Low Risk
- New uploads use new structure (no impact on existing data)
- Old data continues to work
- Can be rolled back easily

### Medium Risk
- Migration script needs careful testing
- S3 copy operations may take time for large datasets
- Need to verify all code paths updated

### Mitigation
- Test migration script on staging first
- Backup database before migration
- Monitor S3 operations during migration
- Have rollback plan ready

## Timeline

- **Week 1**: Implement StorageService and presigned URL updates
- **Week 2**: Test and verify new uploads work correctly
- **Week 3** (if needed): Run migration script for existing data
- **Week 4**: Cleanup and verification

## Notes

- **If no existing photos exist**: Skip migration script, proceed directly to new structure
- **If existing photos exist**: Run migration script before enabling new structure
- **Always test in staging first**: Never run migration on production without testing

