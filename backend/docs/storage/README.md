# Storage Configuration & User Segmentation

## Overview

Rekindle uses AWS S3 for photo storage with **user-scoped key segmentation** to ensure data privacy and security. All photos are stored under user-specific prefixes, preventing cross-user access even with direct S3 access.

## S3 Key Structure

All S3 keys follow the pattern: `users/{user_id}/{category}/{photo_id}/{filename}`

### Categories

- **`raw/`** - Original uploaded photos
  - Format: `users/{user_id}/raw/{photo_id}/original.{ext}`
  - Example: `users/abc123/raw/550e8400-e29b-41d4-a716-446655440000/original.jpg`

- **`processed/`** - Processed/restored photos
  - Format: `users/{user_id}/processed/{photo_id}/restored.{ext}`
  - Example: `users/abc123/processed/550e8400-e29b-41d4-a716-446655440000/restored.jpg`

- **`thumbs/`** - Thumbnails
  - Format: `users/{user_id}/thumbs/{photo_id}.jpg`
  - Example: `users/abc123/thumbs/550e8400-e29b-41d4-a716-446655440000.jpg`

- **`animated/`** - Animation videos
  - Format: `users/{user_id}/animated/{photo_id}/{animation_id}_{suffix}.mp4`
  - Example: `users/abc123/animated/550e8400-e29b-41d4-a716-446655440000/anim123_preview.mp4`

- **`meta/`** - Metadata JSON files
  - Format: `users/{user_id}/meta/{photo_id}.json`
  - Example: `users/abc123/meta/550e8400-e29b-41d4-a716-446655440000.json`

## Security Features

### 1. User-Scoped Keys
- All keys include `user_id` in the path
- Prevents users from accessing other users' data
- Enables IAM policy restrictions

### 2. Presigned URL Conditions
Presigned POST URLs include conditions that enforce:
- **Prefix restriction**: `["starts-with", "$key", "users/{user_id}/"]`
- **Exact key match**: `{"key": "users/{user_id}/..."}`
- **Content type**: `{"Content-Type": "image/jpeg"}` (if specified)
- **Size limits**: `["content-length-range", 1, max_bytes]` (if specified)

### 3. Key Validation
All download/delete operations validate that the S3 key belongs to the requesting user:
```python
if not storage_service.validate_user_key(key, user_id):
    raise ValueError("Access denied")
```

### 4. IAM Policy (Recommended)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::rekindle-uploads/users/*"
    }
  ]
}
```

## Usage

### StorageService API

```python
from app.services.storage_service import storage_service
from uuid import UUID

# Generate user-scoped key
key = storage_service.generate_original_key(
    user_id="abc123",
    photo_id=UUID("550e8400-e29b-41d4-a716-446655440000"),
    extension="jpg"
)
# Returns: "users/abc123/raw/550e8400-e29b-41d4-a716-446655440000/original.jpg"

# Generate presigned upload URL
presigned_data = storage_service.generate_presigned_upload_url(
    user_id="abc123",
    photo_id=UUID("550e8400-e29b-41d4-a716-446655440000"),
    category="raw",
    filename="original.jpg",
    content_type="image/jpeg",
    max_size_bytes=50 * 1024 * 1024,  # 50MB
)
# Returns: {
#   "url": "https://s3.amazonaws.com/rekindle-uploads/...",
#   "fields": {"key": "...", "Content-Type": "image/jpeg", ...},
#   "key": "users/abc123/raw/..."
# }

# Upload file
url = storage_service.upload_file(
    file_content=b"...",
    user_id="abc123",
    photo_id=UUID("550e8400-e29b-41d4-a716-446655440000"),
    category="raw",
    filename="original.jpg",
    content_type="image/jpeg",
)

# Generate presigned download URL (validates ownership)
url = storage_service.generate_presigned_download_url(
    key="users/abc123/raw/.../original.jpg",
    user_id="abc123",
)

# Download file (validates ownership)
content = storage_service.download_file(
    key="users/abc123/raw/.../original.jpg",
    user_id="abc123",
)

# Delete file (validates ownership)
storage_service.delete_file(
    key="users/abc123/raw/.../original.jpg",
    user_id="abc123",
)
```

## Bucket Configuration

### Required Settings

1. **Encryption**: Enable server-side encryption (SSE-S3 or SSE-KMS)
2. **Versioning**: Enable versioning for recovery
3. **Lifecycle Rules**: Configure lifecycle rules for old versions
4. **Access Logging**: Enable access logging for audit trail
5. **Public Access**: Block all public access

### Example Bucket Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::rekindle-uploads",
        "arn:aws:s3:::rekindle-uploads/*"
      ],
      "Condition": {
        "Bool": {
          "aws:PublicAccess": "true"
        }
      }
    }
  ]
}
```

## Migration

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for details on migrating existing data.

## Testing

Run the smoke test to verify cross-user access prevention:

```bash
python scripts/test-presigned-access.sh
```

Or use the Python test:

```bash
python scripts/test_storage_isolation.py
```

## Incident Response

If a security incident occurs:

1. **Immediate**: Review CloudTrail logs for unauthorized access
2. **Investigation**: Check S3 access logs for cross-user access attempts
3. **Remediation**: Rotate IAM credentials, review IAM policies
4. **Prevention**: Update IAM policies, add additional monitoring

## Monitoring

Monitor the following metrics:

- S3 access patterns (CloudTrail)
- Presigned URL generation (application logs)
- Cross-user access attempts (application logs with `event_type: ownership_violation`)
- Storage usage per user (S3 inventory reports)

## Related Documentation

- [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) - Migration plan for existing data
- [../authentication-authorization/tasks.md](../../.kiro/specs/authentication-authorization/tasks.md) - Task 5.10 details

