variable "api_name" {
  description = "API Gateway HTTP API name"
  type        = string
}

variable "environment" {
  description = "Environment name (dev | prod)"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT authorizer"
  type        = string
}

variable "cognito_app_client_id" {
  description = "Cognito App Client ID for JWT audience"
  type        = string
}

variable "aws_region" {
  description = "AWS region (used to construct Cognito issuer URL)"
  type        = string
  default     = "us-east-1"
}

variable "custom_domain" {
  description = "Custom domain for the API (e.g. api.dev.qulene.com)"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN covering the custom domain"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for qulene.com"
  type        = string
}
