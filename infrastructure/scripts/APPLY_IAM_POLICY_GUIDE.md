# Guide: Applying IAM Policy for User-Scoped S3 Access

This guide walks you through applying the IAM policy that restricts S3 access to the `users/*` prefix only.

## Prerequisites

Before applying the IAM policy, ensure you have:

1. **AWS CLI installed and configured**
   ```bash
   # Check if AWS CLI is installed
   aws --version
   
   # If not installed, install it:
   # macOS: brew install awscli
   # Linux: sudo apt-get install awscli  # or use pip: pip install awscli
   ```

2. **AWS credentials configured**
   ```bash
   # Configure AWS credentials (if not already done)
   aws configure
   
   # You'll need:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region (e.g., us-east-1)
   # - Default output format (json)
   ```

3. **Required AWS permissions**
   Your AWS credentials must have permissions to:
   - `iam:CreatePolicy`
   - `iam:GetPolicy`
   - `iam:ListPolicies`
   - `iam:CreatePolicyVersion`
   - `iam:AttachRolePolicy`
   - `iam:ListAttachedRolePolicies`
   
   If you're using an IAM user, ensure they have these permissions. If using an IAM role, ensure the role has these permissions.

4. **Know your IAM role name**
   - Default: `rekindle-backend-service-role`
   - If your role has a different name, you'll need to set the `IAM_ROLE_NAME` environment variable

5. **Know your S3 bucket name**
   - Default: `rekindle-uploads`
   - If your bucket has a different name, you'll need to set the `S3_BUCKET_NAME` environment variable

## Step-by-Step Instructions

### Step 1: Verify AWS CLI Configuration

```bash
# Test AWS CLI access
aws sts get-caller-identity

# This should return your AWS account ID and user/role ARN
# If it fails, check your AWS credentials
```

### Step 2: Verify IAM Role Exists

```bash
# Check if the role exists (using default name)
aws iam get-role --role-name rekindle-backend-service-role

# If you get an error, the role doesn't exist yet
# You'll need to create it first or use a different role name
```

**If the role doesn't exist**, you have two options:

**Option A: Create the role first** (if you have permissions)
```bash
# Create a basic service role (adjust trust policy as needed)
aws iam create-role \
  --role-name rekindle-backend-service-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'
```

**Option B: Use an existing role**
```bash
# Find existing roles
aws iam list-roles --query 'Roles[].RoleName' --output table

# Then set IAM_ROLE_NAME environment variable when running the script
export IAM_ROLE_NAME=your-existing-role-name
```

### Step 3: Verify S3 Bucket Exists

```bash
# Check if the bucket exists (using default name)
aws s3 ls s3://rekindle-uploads

# If you get an error, the bucket doesn't exist
# You may need to create it first or use Terraform module
```

**If the bucket doesn't exist**, you can:
- Create it manually: `aws s3 mb s3://rekindle-uploads`
- Or use the Terraform module: `cd infrastructure/terraform/s3-storage && terraform apply`

### Step 4: Set Environment Variables (Optional)

If your role or bucket names differ from defaults:

```bash
export IAM_ROLE_NAME=your-iam-role-name
export S3_BUCKET_NAME=your-bucket-name
```

### Step 5: Make Script Executable

```bash
# Navigate to project root
cd /home/qui/Development/rekindle

# Make script executable
chmod +x infrastructure/scripts/apply-s3-iam-policy.sh
```

### Step 6: Run the Script

```bash
# Run the script
./infrastructure/scripts/apply-s3-iam-policy.sh
```

The script will:
1. Create or update the IAM policy
2. Attach the policy to your IAM role
3. Display confirmation messages

### Step 7: Verify Policy Applied

```bash
# Check attached policies on the role
aws iam list-attached-role-policies --role-name rekindle-backend-service-role

# You should see: rekindle-uploads-user-scoped-access

# View the policy details
aws iam get-policy --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/rekindle-uploads-user-scoped-access

# View the policy document
aws iam get-policy-version \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/rekindle-uploads-user-scoped-access \
  --version-id v1
```

## What the Policy Does

The IAM policy restricts access to:

✅ **Allowed:**
- `s3:PutObject` on `arn:aws:s3:::rekindle-uploads/users/*`
- `s3:GetObject` on `arn:aws:s3:::rekindle-uploads/users/*`
- `s3:DeleteObject` on `arn:aws:s3:::rekindle-uploads/users/*`
- `s3:ListBucket` on `rekindle-uploads` bucket (only `users/*` prefix)

❌ **Denied:**
- Access to any keys outside `users/*` prefix
- Old flat keys (e.g., `uploaded/{job_id}.jpg`)

## Important Notes

⚠️ **After applying this policy:**
- The service role can **ONLY** access keys under `users/*` prefix
- Old photos with flat keys will **NOT** be accessible
- If you have existing photos, run the migration script:
  ```bash
  python backend/scripts/migrate_s3_keys_to_user_scoped.py
  ```

## Troubleshooting

### Error: "Unable to locate credentials"
- Run `aws configure` to set up credentials
- Or set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables

### Error: "AccessDenied" when creating policy
- Your AWS user/role needs `iam:CreatePolicy` permission
- Contact your AWS administrator to grant permissions

### Error: "NoSuchEntity" for role
- The IAM role doesn't exist
- Create it first (see Step 2) or use an existing role name

### Error: "Bucket does not exist"
- Create the S3 bucket first
- Or use Terraform module: `cd infrastructure/terraform/s3-storage && terraform apply`

### Policy already exists
- The script will automatically update the existing policy
- It creates a new policy version and sets it as default

## Testing the Policy

After applying, test that the policy works:

```bash
# Test script to verify isolation
python backend/scripts/test_storage_isolation.py
```

This script verifies that:
- Users can only access their own `users/{user_id}/*` keys
- Cross-user access attempts fail
- Presigned URLs are properly scoped

## Rollback (if needed)

If you need to remove the policy:

```bash
# Detach policy from role
aws iam detach-role-policy \
  --role-name rekindle-backend-service-role \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/rekindle-uploads-user-scoped-access

# Delete policy (optional - only if you want to remove it completely)
aws iam delete-policy \
  --policy-arn arn:aws:iam::YOUR_ACCOUNT_ID:policy/rekindle-uploads-user-scoped-access
```

## Next Steps

After successfully applying the IAM policy:

1. ✅ Verify policy is attached: `aws iam list-attached-role-policies --role-name rekindle-backend-service-role`
2. ✅ Test storage isolation: `python backend/scripts/test_storage_isolation.py`
3. ✅ Migrate existing photos (if any): `python backend/scripts/migrate_s3_keys_to_user_scoped.py`
4. ✅ Update your backend service to use the role (if using EC2/ECS/Lambda)
5. ✅ Monitor logs for any access denied errors

## Support

If you encounter issues:
1. Check AWS CloudTrail logs for IAM API calls
2. Verify your AWS credentials have sufficient permissions
3. Check the script output for specific error messages
4. Review AWS IAM documentation: https://docs.aws.amazon.com/iam/

