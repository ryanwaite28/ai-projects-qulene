variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for qulene.com"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN (us-east-1) for CloudFront"
  type        = string
}

locals {
  domain_names = var.environment == "prod" ? ["qulene.com", "www.qulene.com"] : ["dev.qulene.com", "www.dev.qulene.com"]
}

module "spa" {
  source = "../spa"

  environment         = var.environment
  site_name           = "marketing"
  bucket_name         = "qulene-${var.environment}-frontend"
  domain_names        = local.domain_names
  hosted_zone_id      = var.hosted_zone_id
  acm_certificate_arn = var.acm_certificate_arn
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for the marketing site"
  value       = module.spa.cloudfront_distribution_id
}

output "bucket_name" {
  description = "S3 bucket name for the marketing site"
  value       = module.spa.bucket_name
}
