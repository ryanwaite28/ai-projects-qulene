variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Local AWS named profile. Set to empty string in CI to use OIDC environment credentials."
  type        = string
  default     = "rmw-llc"
}

variable "environment" {
  description = "Environment name; used in resource prefix qulene-{env}-*"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be \"dev\" or \"prod\"."
  }
}

variable "admin_email" {
  description = "Admin email address for contact form notifications"
  type        = string
  default     = "ryanwaite28@gmail.com"
}
