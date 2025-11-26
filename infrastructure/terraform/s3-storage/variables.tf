# Variables file - already included in main.tf, but kept separate for clarity

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

