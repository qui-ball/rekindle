#!/bin/bash
# Script to apply IAM policy for user-scoped S3 access
# This restricts the service role to only access users/* prefix

set -e

BUCKET_NAME="${S3_BUCKET_NAME:-rekindle-uploads}"
ROLE_NAME="${IAM_ROLE_NAME:-rekindle-backend-service-role}"
POLICY_NAME="${BUCKET_NAME}-user-scoped-access"

echo "🔐 Applying IAM policy for user-scoped S3 access"
echo "Bucket: $BUCKET_NAME"
echo "Role: $ROLE_NAME"
echo "Policy Name: $POLICY_NAME"
echo ""

# Create IAM policy JSON
POLICY_JSON=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/users/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}",
      "Condition": {
        "StringLike": {
          "s3:prefix": "users/*"
        }
      }
    }
  ]
}
EOF
)

# Check if policy already exists
EXISTING_POLICY=$(aws iam list-policies --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" --output text 2>/dev/null || echo "")

if [ -n "$EXISTING_POLICY" ]; then
    echo "⚠️  Policy already exists: $EXISTING_POLICY"
    echo "Updating existing policy..."
    aws iam create-policy-version \
        --policy-arn "$EXISTING_POLICY" \
        --policy-document "$POLICY_JSON" \
        --set-as-default
    POLICY_ARN="$EXISTING_POLICY"
else
    echo "Creating new policy..."
    POLICY_ARN=$(aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document "$POLICY_JSON" \
        --description "Policy allowing access only to user-scoped S3 keys (users/* prefix)" \
        --query 'Policy.Arn' \
        --output text)
    echo "✅ Policy created: $POLICY_ARN"
fi

# Attach policy to role
echo ""
echo "Attaching policy to role: $ROLE_NAME"
aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "$POLICY_ARN"

echo "✅ Policy attached successfully!"
echo ""
echo "Policy ARN: $POLICY_ARN"
echo ""
echo "⚠️  IMPORTANT: After applying this policy, the service role can ONLY access:"
echo "   - arn:aws:s3:::${BUCKET_NAME}/users/*"
echo ""
echo "   Old flat keys (e.g., uploaded/{job_id}.jpg) will NOT be accessible."
echo "   Run migration script if you have existing photos:"
echo "   python backend/scripts/migrate_s3_keys_to_user_scoped.py"

