###############################################################################
# Qulene — Terraform environment: dev
#
# Per CLAUDE.md "Settled Decisions":
#   - provider uses profile = var.aws_profile (default "rmw-llc"; CI sets to "")
#   - backend points at qulene-dev-tf-state (created by bootstrap.sh)
#   - no hardcoded ARNs or IDs; shared infra values come from SSM via data sources
#
# Phase 0c provisions the provider + backend declaration.
# Phase 1b adds: Cognito, DynamoDB users, lambda module, API Gateway.
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

###############################################################################
# Shared infra values from SSM (written by bootstrap.sh)
###############################################################################

data "aws_ssm_parameter" "hosted_zone_id" {
  name = "/qulene/hosted_zone_id"
}

data "aws_ssm_parameter" "acm_certificate_arn" {
  name = "/qulene/${var.environment}/acm_certificate_arn"
}

###############################################################################
# Phase 1b — Cognito
###############################################################################

module "cognito" {
  source = "../../modules/cognito"

  environment = var.environment
  aws_region  = var.aws_region
}

###############################################################################
# Phase 1b — DynamoDB users table
###############################################################################

module "dynamodb_users" {
  source = "../../modules/dynamodb-users"

  environment = var.environment
}

###############################################################################
# Phase 1b — Lambda: auth
#
# package_path points at the ZIP produced by `npm run build` in backend/.
# The Lambda env block matches exactly what the handler reads via process.env:
#   USERS_TABLE      → users.table.ts
#   DYNAMODB_ENDPOINT → dynamo.client.ts (empty = use AWS endpoint)
#   AWS_REGION        → dynamo.client.ts (Lambda also sets this automatically)
###############################################################################

module "lambda_auth" {
  source = "../../modules/lambda"

  function_name = "qulene-${var.environment}-lambda-auth"
  package_path  = "${path.root}/../../../../backend/dist/lambdas/auth/index.zip"
  memory_size   = 256
  timeout       = 30

  environment_variables = {
    USERS_TABLE       = module.dynamodb_users.table_name
    DYNAMODB_ENDPOINT = ""
    AWS_REGION        = var.aws_region
  }
}

# DynamoDB access for lambda-auth
resource "aws_iam_role_policy" "lambda_auth_dynamodb" {
  name = "qulene-${var.environment}-lambda-auth-dynamodb"
  role = module.lambda_auth.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
        ]
        Resource = [
          module.dynamodb_users.table_arn,
          "${module.dynamodb_users.table_arn}/index/*",
        ]
      }
    ]
  })
}

###############################################################################
# Phase 1b — API Gateway v2
###############################################################################

module "api_gateway" {
  source = "../../modules/api-gateway"

  api_name              = "qulene-${var.environment}-api"
  environment           = var.environment
  cognito_user_pool_id  = module.cognito.user_pool_id
  cognito_app_client_id = module.cognito.app_client_id
  aws_region            = var.aws_region
  custom_domain         = "api.${var.environment}.qulene.com"
  acm_certificate_arn   = data.aws_ssm_parameter.acm_certificate_arn.value
  hosted_zone_id        = data.aws_ssm_parameter.hosted_zone_id.value
}

# Allow API Gateway to invoke lambda-auth
resource "aws_lambda_permission" "api_gw_auth" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_auth.function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# Integration: API Gateway → lambda-auth
resource "aws_apigatewayv2_integration" "lambda_auth" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda_auth.invoke_arn
  payload_format_version = "2.0"
}

# Route: POST /auth/profile → Cognito JWT authorizer → lambda-auth
resource "aws_apigatewayv2_route" "post_auth_profile" {
  api_id             = module.api_gateway.api_id
  route_key          = "POST /auth/profile"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_auth.id}"
}

###############################################################################
# Outputs
###############################################################################

output "environment" {
  value = var.environment
}

output "aws_region" {
  value = var.aws_region
}

output "hosted_zone_id" {
  value = data.aws_ssm_parameter.hosted_zone_id.value
}

output "acm_certificate_arn" {
  value = data.aws_ssm_parameter.acm_certificate_arn.value
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID — written to SSM by post-apply-cognito.sh"
  value       = module.cognito.user_pool_id
}

output "cognito_app_client_id" {
  description = "Cognito App Client ID — written to SSM by post-apply-cognito.sh"
  value       = module.cognito.app_client_id
}

output "api_endpoint" {
  description = "API Gateway execution endpoint"
  value       = module.api_gateway.api_endpoint
}
