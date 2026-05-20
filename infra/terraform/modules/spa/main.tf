variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

variable "site_name" {
  description = "Short identifier for this site ('marketing' or 'app') — used in resource names and SSM keys"
  type        = string
}

variable "bucket_name" {
  description = "S3 bucket name for static assets"
  type        = string
}

variable "domain_names" {
  description = "CloudFront aliases (e.g. ['qulene.com', 'www.qulene.com'])"
  type        = list(string)
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for qulene.com"
  type        = string
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN — must be in us-east-1 for CloudFront"
  type        = string
}

###############################################################################
# S3 — private bucket; public access fully blocked
###############################################################################

resource "aws_s3_bucket" "spa" {
  bucket = var.bucket_name

  tags = {
    Name = var.bucket_name
  }
}

resource "aws_s3_bucket_public_access_block" "spa" {
  bucket                  = aws_s3_bucket.spa.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

###############################################################################
# CloudFront OAC + distribution
#
# Origin must use bucket_regional_domain_name (not bucket_domain_name) —
# the regional endpoint is required for OAC request signing to work.
###############################################################################

resource "aws_cloudfront_origin_access_control" "spa" {
  name                              = "qulene-${var.environment}-${var.site_name}-oac"
  description                       = "OAC for ${var.bucket_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "spa" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "qulene-${var.environment}-${var.site_name}"
  default_root_object = "index.html"
  aliases             = var.domain_names
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.spa.bucket_regional_domain_name
    origin_id                = "s3-${var.bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.spa.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-${var.bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  # SPA routing: S3 returns 403/404 for unknown paths — rewrite to index.html
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name = "qulene-${var.environment}-${var.site_name}-cdn"
  }
}

###############################################################################
# S3 bucket policy — allow CloudFront OAC to read objects
###############################################################################

resource "aws_s3_bucket_policy" "spa" {
  bucket = aws_s3_bucket.spa.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontOAC"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.spa.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.spa.arn
          }
        }
      }
    ]
  })
}

###############################################################################
# Route 53 — ALIAS A-records for all CloudFront aliases
# Apex domains require ALIAS (not CNAME); for_each handles apex + www together
###############################################################################

resource "aws_route53_record" "aliases" {
  for_each = toset(var.domain_names)

  zone_id = var.hosted_zone_id
  name    = each.value
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.spa.domain_name
    zone_id                = aws_cloudfront_distribution.spa.hosted_zone_id
    evaluate_target_health = false
  }
}

###############################################################################
# SSM — write distribution ID so deploy scripts can read it without hardcoding
###############################################################################

resource "aws_ssm_parameter" "distribution_id" {
  name  = "/qulene/${var.environment}/${var.site_name}_cloudfront_distribution_id"
  type  = "String"
  value = aws_cloudfront_distribution.spa.id

  tags = {
    Name = "qulene-${var.environment}-${var.site_name}-distribution-id"
  }
}

###############################################################################
# Outputs
###############################################################################

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.spa.id
}

output "bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.spa.bucket
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name (used for Route 53 alias targets)"
  value       = aws_cloudfront_distribution.spa.domain_name
}
