# S3 Storage Terraform Module

This Terraform module creates an S3 bucket with user-scoped storage segmentation for Rekindle photo storage.

## Features

- **User-Scoped Access**: IAM policy restricts access to `users/*` prefix only
- **Encryption**: Server-side encryption (AES256) enabled
- **Versioning**: Enabled for recovery and audit trail
- **Lifecycle Rules**: Automatic cleanup of old versions and incomplete uploads
- **Public Access Block**: All public access blocked
- **Bucket Policy**: Explicitly denies public access

## Usage

```hcl
module "s3_storage" {
  source = "./infrastructure/terraform/s3-storage"

  bucket_name              = "rekindle-uploads"
  environment              = "prod"
  enable_versioning        = true
  enable_lifecycle_rules   = true
  lifecycle_expiration_days = 90
  service_role_name        = "rekindle-backend-service-role"
}

# Attach the IAM policy to your service role
resource "aws_iam_role_policy_attachment" "s3_access" {
  role       = aws_iam_role.backend_service.name
  policy_arn = module.s3_storage.iam_policy_arn
}
```

## Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `bucket_name` | Name of the S3 bucket | `rekindle-uploads` | No |
| `environment` | Environment name | `prod` | No |
| `enable_versioning` | Enable S3 versioning | `true` | No |
| `enable_lifecycle_rules` | Enable lifecycle rules | `true` | No |
| `lifecycle_expiration_days` | Days before deleting old versions | `90` | No |
| `service_role_name` | Name of IAM role (for reference) | `rekindle-backend-service-role` | No |

## Outputs

| Output | Description |
|--------|-------------|
| `bucket_name` | Name of the S3 bucket |
| `bucket_arn` | ARN of the S3 bucket |
| `iam_policy_arn` | ARN of the IAM policy |
| `iam_policy_name` | Name of the IAM policy |

## IAM Policy Details

The IAM policy created by this module allows:

- **s3:PutObject** on `users/*` prefix
- **s3:GetObject** on `users/*` prefix
- **s3:DeleteObject** on `users/*` prefix
- **s3:GetObjectVersion** on `users/*` prefix (for versioning)
- **s3:ListBucket** with `users/*` prefix filter

This ensures that:
1. Service role can only access user-scoped keys
2. No access to root-level keys (old flat structure)
3. No access to other users' data

## Applying the Module

1. **Initialize Terraform:**
   ```bash
   cd infrastructure/terraform/s3-storage
   terraform init
   ```

2. **Review the plan:**
   ```bash
   terraform plan
   ```

3. **Apply:**
   ```bash
   terraform apply
   ```

4. **Attach IAM policy to service role:**
   ```bash
   # Get the policy ARN from outputs
   terraform output iam_policy_arn
   
   # Attach to your service role (replace ROLE_NAME with your role name)
   aws iam attach-role-policy \
     --role-name rekindle-backend-service-role \
     --policy-arn $(terraform output -raw iam_policy_arn)
   ```

## Security Notes

- The IAM policy restricts access to `users/*` prefix only
- Public access is completely blocked
- Encryption is enabled by default
- Versioning provides audit trail and recovery
- Lifecycle rules prevent storage bloat

## Migration Notes

If you have existing photos with old flat keys (e.g., `uploaded/{job_id}.jpg`), they will not be accessible through the service role after applying this IAM policy. You must:

1. Run the migration script: `python backend/scripts/migrate_s3_keys_to_user_scoped.py`
2. Or temporarily grant broader access for migration, then restrict again

## Verification

After applying, verify the configuration:

```bash
# Check bucket encryption
aws s3api get-bucket-encryption --bucket rekindle-uploads

# Check versioning
aws s3api get-bucket-versioning --bucket rekindle-uploads

# Check public access block
aws s3api get-public-access-block --bucket rekindle-uploads

# Check IAM policy
aws iam get-policy --policy-arn $(terraform output -raw iam_policy_arn)
```

