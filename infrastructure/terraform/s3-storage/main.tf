# Terraform module for Rekindle S3 storage with user-scoped segmentation
# This module creates:
# - S3 bucket with encryption, versioning, and lifecycle rules
# - IAM policy restricting access to users/* prefix
# - Bucket policy blocking public access

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "bucket_name" {
  description = "Name of the S3 bucket for photo storage"
  type        = string
  default     = "rekindle-uploads"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "enable_versioning" {
  description = "Enable S3 versioning for the bucket"
  type        = bool
  default     = true
}

variable "enable_lifecycle_rules" {
  description = "Enable lifecycle rules for old versions"
  type        = bool
  default     = true
}

variable "lifecycle_expiration_days" {
  description = "Number of days before deleting old versions"
  type        = number
  default     = 90
}

variable "service_role_name" {
  description = "Name of the IAM role that will access this bucket"
  type        = string
  default     = "rekindle-backend-service-role"
}

# S3 Bucket
resource "aws_s3_bucket" "photo_storage" {
  bucket = var.bucket_name

  tags = {
    Name        = var.bucket_name
    Environment = var.environment
    Purpose     = "User-scoped photo storage"
  }
}

# S3 Bucket Versioning
resource "aws_s3_bucket_versioning" "photo_storage" {
  count  = var.enable_versioning ? 1 : 0
  bucket = aws_s3_bucket.photo_storage.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket Server-Side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "photo_storage" {
  bucket = aws_s3_bucket.photo_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# S3 Bucket Public Access Block
resource "aws_s3_bucket_public_access_block" "photo_storage" {
  bucket = aws_s3_bucket.photo_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets  = true
}

# S3 Bucket Lifecycle Configuration
resource "aws_s3_bucket_lifecycle_configuration" "photo_storage" {
  count  = var.enable_lifecycle_rules ? 1 : 0
  bucket = aws_s3_bucket.photo_storage.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = var.lifecycle_expiration_days
    }
  }

  rule {
    id     = "delete-incomplete-multipart-uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# S3 Bucket Policy - Deny public access
resource "aws_s3_bucket_policy" "photo_storage" {
  bucket = aws_s3_bucket.photo_storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyPublicAccess"
        Effect = "Deny"
        Principal = "*"
        Action = "s3:*"
        Resource = [
          aws_s3_bucket.photo_storage.arn,
          "${aws_s3_bucket.photo_storage.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:PublicAccess" = "true"
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.photo_storage]
}

# IAM Policy for service role - restrict to users/* prefix
resource "aws_iam_policy" "s3_photo_storage_access" {
  name        = "${var.bucket_name}-user-scoped-access"
  description = "Policy allowing access only to user-scoped S3 keys (users/* prefix)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:GetObjectVersion"
        ]
        Resource = "${aws_s3_bucket.photo_storage.arn}/users/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.photo_storage.arn
        Condition = {
          StringLike = {
            "s3:prefix" = "users/*"
          }
        }
      }
    ]
  })
}

# Outputs
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

