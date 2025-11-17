# Outputs file - already included in main.tf, but kept separate for clarity

output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.photo_storage.id
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.photo_storage.arn
}

output "iam_policy_arn" {
  description = "ARN of the IAM policy for user-scoped access"
  value       = aws_iam_policy.s3_photo_storage_access.arn
}

output "iam_policy_name" {
  description = "Name of the IAM policy"
  value       = aws_iam_policy.s3_photo_storage_access.name
}

