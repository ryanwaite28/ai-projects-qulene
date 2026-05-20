###############################################################################
# Qulene — Terraform environment: prod
#
# Same shape as envs/dev/main.tf — see that file for full documentation.
###############################################################################

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }

  backend "s3" {
    bucket         = "qulene-prod-tf-state"
    key            = "envs/prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "qulene-prod-tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = "qulene"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

data "aws_ssm_parameter" "hosted_zone_id" {
  name = "/qulene/hosted_zone_id"
}

data "aws_ssm_parameter" "acm_certificate_arn" {
  name = "/qulene/${var.environment}/acm_certificate_arn"
}

###############################################################################
# Phase 8f — Web app SPA hosting (S3 + CloudFront + Route 53)
###############################################################################

module "webapp" {
  source = "../../modules/webapp"

  environment         = var.environment
  hosted_zone_id      = data.aws_ssm_parameter.hosted_zone_id.value
  acm_certificate_arn = data.aws_ssm_parameter.acm_certificate_arn.value
}

output "environment" {
  value = var.environment
}

output "aws_region" {
  value = var.aws_region
}

output "hosted_zone_id" {
  value     = data.aws_ssm_parameter.hosted_zone_id.value
  sensitive = false
}

output "acm_certificate_arn" {
  value     = data.aws_ssm_parameter.acm_certificate_arn.value
  sensitive = false
}
