###############################################################################
# Qulene — Terraform environment: dev
#
# Per CLAUDE.md "Settled Decisions":
#   - provider uses profile = var.aws_profile (default "rmw-llc"; CI sets to "")
#   - backend points at qulene-dev-tf-state (created by bootstrap.sh)
#   - no hardcoded ARNs or IDs; shared infra values come from SSM via data sources
#
# Phase 0c provisions only the provider + backend declaration. Subsequent phases
# instantiate modules (Cognito in 1b, DynamoDB tables in 2a/2b/etc, etc.).
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
    bucket         = "qulene-dev-tf-state"
    key            = "envs/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "qulene-dev-tf-locks"
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

# Shared infra values read from SSM (written by bootstrap.sh in production mode).
# These data sources will fail until bootstrap.sh has been run — that's expected
# and gated by the bootstrap dependency.

data "aws_ssm_parameter" "hosted_zone_id" {
  name = "/qulene/hosted_zone_id"
}

data "aws_ssm_parameter" "acm_certificate_arn" {
  name = "/qulene/${var.environment}/acm_certificate_arn"
}

# Phase 0c outputs only the resolved environment + region so subsequent module
# wiring has a stable surface to read from.

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
