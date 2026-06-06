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
# Phase 2a — S3 media bucket
###############################################################################

resource "aws_s3_bucket" "media" {
  bucket = "qulene-${var.environment}-media"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["Content-Type"]
    allowed_methods = ["PUT"]
    allowed_origins = ["*"]
    max_age_seconds = 300
  }
}

###############################################################################
# Phase 2a — DynamoDB business-profiles table
###############################################################################

module "dynamodb_business_profiles" {
  source = "../../modules/dynamodb-business-profiles"

  environment = var.environment
}

###############################################################################
# Phase 2a — Lambda: businesses
#
# Env var cross-reference (CLAUDE.md Rule 12.10):
#   BUSINESS_PROFILES_TABLE → business-profiles.table.ts TABLE()
#   MEDIA_BUCKET            → business.service.ts generateAvatarUploadUrl()
#   S3_ENDPOINT             → s3.client.ts createS3Client() (empty = AWS endpoint)
#   AWS_REGION              → dynamo.client.ts + s3.client.ts (Lambda also sets this)
###############################################################################

module "lambda_businesses" {
  source = "../../modules/lambda"

  function_name = "qulene-${var.environment}-lambda-businesses"
  package_path  = "${path.root}/../../../../backend/dist/lambdas/businesses/index.zip"
  memory_size   = 256
  timeout       = 30

  environment_variables = {
    BUSINESS_PROFILES_TABLE   = module.dynamodb_business_profiles.table_name
    AVAILABILITY_WINDOWS_TABLE = module.dynamodb_availability_windows.table_name
    MEDIA_BUCKET              = aws_s3_bucket.media.bucket
    S3_ENDPOINT               = ""
    AWS_REGION                = var.aws_region
  }
}

# DynamoDB access for lambda-businesses
resource "aws_iam_role_policy" "lambda_businesses_dynamodb" {
  name = "qulene-${var.environment}-lambda-businesses-dynamodb"
  role = module.lambda_businesses.role_name

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
          "dynamodb:Scan",
        ]
        Resource = [
          module.dynamodb_business_profiles.table_arn,
          "${module.dynamodb_business_profiles.table_arn}/index/*",
        ]
      }
    ]
  })
}

# S3 access for lambda-businesses (presigned URL generation)
resource "aws_iam_role_policy" "lambda_businesses_s3" {
  name = "qulene-${var.environment}-lambda-businesses-s3"
  role = module.lambda_businesses.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.media.arn}/business-profiles/*"
      }
    ]
  })
}

# Allow API Gateway to invoke lambda-businesses
resource "aws_lambda_permission" "api_gw_businesses" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_businesses.function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# Integration: API Gateway → lambda-businesses
resource "aws_apigatewayv2_integration" "lambda_businesses" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda_businesses.invoke_arn
  payload_format_version = "2.0"
}

# Route: GET /businesses — public (no JWT required)
resource "aws_apigatewayv2_route" "get_businesses" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /businesses"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_businesses.id}"
}

# Route: GET /businesses/{businessId} — public (no JWT required)
resource "aws_apigatewayv2_route" "get_businesses_by_id" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /businesses/{businessId}"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_businesses.id}"
}

# Route: PATCH /businesses/me — BUSINESS only (JWT required)
resource "aws_apigatewayv2_route" "patch_businesses_me" {
  api_id             = module.api_gateway.api_id
  route_key          = "PATCH /businesses/me"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_businesses.id}"
}

# Route: POST /businesses/me/avatar — BUSINESS only (JWT required)
resource "aws_apigatewayv2_route" "post_businesses_me_avatar" {
  api_id             = module.api_gateway.api_id
  route_key          = "POST /businesses/me/avatar"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_businesses.id}"
}

###############################################################################
# Phase 2c — DynamoDB availability-windows table
###############################################################################

module "dynamodb_availability_windows" {
  source = "../../modules/dynamodb-availability-windows"

  environment = var.environment
}

# DynamoDB access for lambda-businesses — availability-windows table
resource "aws_iam_role_policy" "lambda_businesses_availability_dynamodb" {
  name = "qulene-${var.environment}-lambda-businesses-availability-dynamodb"
  role = module.lambda_businesses.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
        ]
        Resource = [
          module.dynamodb_availability_windows.table_arn,
          "${module.dynamodb_availability_windows.table_arn}/index/*",
        ]
      }
    ]
  })
}

# Route: GET /businesses/{businessId}/availability — public
resource "aws_apigatewayv2_route" "get_business_availability" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /businesses/{businessId}/availability"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_businesses.id}"
}

# Route: POST /businesses/me/availability — BUSINESS only
resource "aws_apigatewayv2_route" "post_businesses_me_availability" {
  api_id             = module.api_gateway.api_id
  route_key          = "POST /businesses/me/availability"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_businesses.id}"
}

# Route: DELETE /businesses/me/availability/{windowId} — BUSINESS only
resource "aws_apigatewayv2_route" "delete_businesses_me_availability" {
  api_id             = module.api_gateway.api_id
  route_key          = "DELETE /businesses/me/availability/{windowId}"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_businesses.id}"
}

###############################################################################
# Phase 3a — DynamoDB appointment-requests table
###############################################################################

module "dynamodb_appointment_requests" {
  source = "../../modules/dynamodb-appointment-requests"

  environment = var.environment
}

###############################################################################
# Phase 3a — DynamoDB notifications table
###############################################################################

module "dynamodb_notifications" {
  source = "../../modules/dynamodb-notifications"

  environment = var.environment
}

###############################################################################
# Phase 2b — SNS events topic
#
# Provisioned here because Phase 2b is the first Lambda that publishes events.
# Phase 5a adds SQS queues + subscriptions + notification Lambda but does not
# re-create this topic.
###############################################################################

resource "aws_sns_topic" "events" {
  name = "qulene-${var.environment}-events"
}

###############################################################################
# Phase 2b — DynamoDB services table
###############################################################################

module "dynamodb_services" {
  source = "../../modules/dynamodb-services"

  environment = var.environment
}

###############################################################################
# Phase 2b — Lambda: services
#
# Env var cross-reference (CLAUDE.md Rule 12.10):
#   SERVICES_TABLE  → services.table.ts TABLE()
#   SNS_TOPIC_ARN   → service.service.ts softDeleteService() (not a secret; IAM controls access)
#   SNS_ENDPOINT    → sns.client.ts createSnsClient() (empty = AWS endpoint)
#   AWS_REGION      → dynamo.client.ts + sns.client.ts
###############################################################################

module "lambda_services" {
  source = "../../modules/lambda"

  function_name = "qulene-${var.environment}-lambda-services"
  package_path  = "${path.root}/../../../../backend/dist/lambdas/services/index.zip"
  memory_size   = 256
  timeout       = 30

  environment_variables = {
    SERVICES_TABLE = module.dynamodb_services.table_name
    SNS_TOPIC_ARN  = aws_sns_topic.events.arn
    SNS_ENDPOINT   = ""
    AWS_REGION     = var.aws_region
  }
}

# DynamoDB access for lambda-services
resource "aws_iam_role_policy" "lambda_services_dynamodb" {
  name = "qulene-${var.environment}-lambda-services-dynamodb"
  role = module.lambda_services.role_name

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
          module.dynamodb_services.table_arn,
          "${module.dynamodb_services.table_arn}/index/*",
        ]
      }
    ]
  })
}

# SNS publish access for lambda-services
resource "aws_iam_role_policy" "lambda_services_sns" {
  name = "qulene-${var.environment}-lambda-services-sns"
  role = module.lambda_services.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = aws_sns_topic.events.arn
      }
    ]
  })
}

# Allow API Gateway to invoke lambda-services
resource "aws_lambda_permission" "api_gw_services" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_services.function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# Integration: API Gateway → lambda-services
resource "aws_apigatewayv2_integration" "lambda_services" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda_services.invoke_arn
  payload_format_version = "2.0"
}

# Route: GET /businesses/{businessId}/services — public
resource "aws_apigatewayv2_route" "get_business_services" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /businesses/{businessId}/services"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_services.id}"
}

# Route: POST /businesses/me/services — BUSINESS only
resource "aws_apigatewayv2_route" "post_businesses_me_services" {
  api_id             = module.api_gateway.api_id
  route_key          = "POST /businesses/me/services"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_services.id}"
}

# Route: PATCH /businesses/me/services/{serviceId} — BUSINESS only
resource "aws_apigatewayv2_route" "patch_businesses_me_services" {
  api_id             = module.api_gateway.api_id
  route_key          = "PATCH /businesses/me/services/{serviceId}"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_services.id}"
}

# Route: DELETE /businesses/me/services/{serviceId} — BUSINESS only
resource "aws_apigatewayv2_route" "delete_businesses_me_services" {
  api_id             = module.api_gateway.api_id
  route_key          = "DELETE /businesses/me/services/{serviceId}"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_services.id}"
}

###############################################################################
# Phase 3b — Lambda: appointments
#
# Env var cross-reference (CLAUDE.md Rule 12.10):
#   APPOINTMENT_REQUESTS_TABLE → appointment-requests.table.ts TABLE()
#   NOTIFICATIONS_TABLE        → notifications.table.ts TABLE()
#   USERS_TABLE                → users.table.ts TABLE()  (for incrementUnreadCount)
#   SERVICES_TABLE             → services.table.ts TABLE() (for getServiceById)
#   SNS_TOPIC_ARN              → sns.client.ts publishEvent()
#   SNS_ENDPOINT               → sns.client.ts createSnsClient()
#   DYNAMODB_ENDPOINT          → dynamo.client.ts createDynamoClient()
#   AWS_REGION                 → dynamo.client.ts + sns.client.ts
###############################################################################

module "lambda_appointments" {
  source = "../../modules/lambda-appointments"

  environment                     = var.environment
  aws_region                      = var.aws_region
  appointment_requests_table_name = module.dynamodb_appointment_requests.table_name
  appointment_requests_table_arn  = module.dynamodb_appointment_requests.table_arn
  notifications_table_name        = module.dynamodb_notifications.table_name
  notifications_table_arn         = module.dynamodb_notifications.table_arn
  users_table_name                = module.dynamodb_users.table_name
  users_table_arn                 = module.dynamodb_users.table_arn
  services_table_name             = module.dynamodb_services.table_name
  services_table_arn              = module.dynamodb_services.table_arn
  sns_topic_arn                   = aws_sns_topic.events.arn
}

# Allow API Gateway to invoke lambda-appointments
resource "aws_lambda_permission" "api_gw_appointments" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_appointments.function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# Integration: API Gateway → lambda-appointments
resource "aws_apigatewayv2_integration" "lambda_appointments" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda_appointments.invoke_arn
  payload_format_version = "2.0"
}

# Route: POST /appointments — CUSTOMER only (JWT required)
resource "aws_apigatewayv2_route" "post_appointments" {
  api_id             = module.api_gateway.api_id
  route_key          = "POST /appointments"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_appointments.id}"
}

# Route: GET /appointments/me — CUSTOMER only (JWT required)
resource "aws_apigatewayv2_route" "get_appointments_me" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /appointments/me"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_appointments.id}"
}

# Route: DELETE /appointments/{requestId} — CUSTOMER only (JWT required)
resource "aws_apigatewayv2_route" "delete_appointments_by_id" {
  api_id             = module.api_gateway.api_id
  route_key          = "DELETE /appointments/{requestId}"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_appointments.id}"
}

###############################################################################
# Phase 4a — DynamoDB waitlist-entries table
###############################################################################

module "dynamodb_waitlist_entries" {
  source = "../../modules/dynamodb-waitlist-entries"

  environment = var.environment
}

###############################################################################
# Phase 4a — Lambda: waitlist
#
# Env var cross-reference (CLAUDE.md Rule):
#   WAITLIST_ENTRIES_TABLE → waitlist-entries.table.ts TABLE()
#   NOTIFICATIONS_TABLE    → notifications.table.ts TABLE()
#   USERS_TABLE            → users.table.ts TABLE()  (incrementUnreadCount)
#   SERVICES_TABLE         → services.table.ts TABLE() (getServiceById)
#   SNS_TOPIC_ARN          → sns.client.ts publishEvent()
#   SNS_ENDPOINT           → sns.client.ts createSnsClient()
#   DYNAMODB_ENDPOINT      → dynamo.client.ts createDynamoClient()
#   AWS_REGION             → dynamo.client.ts + sns.client.ts
###############################################################################

module "lambda_waitlist" {
  source = "../../modules/lambda-waitlist"

  environment                = var.environment
  aws_region                 = var.aws_region
  waitlist_entries_table_name = module.dynamodb_waitlist_entries.table_name
  waitlist_entries_table_arn  = module.dynamodb_waitlist_entries.table_arn
  notifications_table_name   = module.dynamodb_notifications.table_name
  notifications_table_arn    = module.dynamodb_notifications.table_arn
  users_table_name           = module.dynamodb_users.table_name
  users_table_arn            = module.dynamodb_users.table_arn
  services_table_name        = module.dynamodb_services.table_name
  services_table_arn         = module.dynamodb_services.table_arn
  sns_topic_arn              = aws_sns_topic.events.arn
}

# Allow API Gateway to invoke lambda-waitlist
resource "aws_lambda_permission" "api_gw_waitlist" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_waitlist.function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# Integration: API Gateway → lambda-waitlist
resource "aws_apigatewayv2_integration" "lambda_waitlist" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda_waitlist.invoke_arn
  payload_format_version = "2.0"
}

# Route: POST /waitlist — CUSTOMER only (JWT required)
resource "aws_apigatewayv2_route" "post_waitlist" {
  api_id             = module.api_gateway.api_id
  route_key          = "POST /waitlist"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_waitlist.id}"
}

# Route: GET /waitlist/me — CUSTOMER only (JWT required)
resource "aws_apigatewayv2_route" "get_waitlist_me" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /waitlist/me"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_waitlist.id}"
}

# Route: DELETE /waitlist/{entryId} — CUSTOMER only (JWT required)
resource "aws_apigatewayv2_route" "delete_waitlist_entry" {
  api_id             = module.api_gateway.api_id
  route_key          = "DELETE /waitlist/{entryId}"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_waitlist.id}"
}

# Route: GET /businesses/me/waitlist/{serviceId} — BUSINESS only (JWT required)
resource "aws_apigatewayv2_route" "get_businesses_me_waitlist" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /businesses/me/waitlist/{serviceId}"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_waitlist.id}"
}

###############################################################################
# Phase 3c — Business appointment action routes (BUSINESS only, JWT required)
###############################################################################

# Route: GET /businesses/me/appointments — BUSINESS only
resource "aws_apigatewayv2_route" "get_businesses_me_appointments" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /businesses/me/appointments"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_appointments.id}"
}

# Route: PATCH /businesses/me/appointments/{requestId}/accept — BUSINESS only
resource "aws_apigatewayv2_route" "patch_businesses_me_appointments_accept" {
  api_id             = module.api_gateway.api_id
  route_key          = "PATCH /businesses/me/appointments/{requestId}/accept"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_appointments.id}"
}

# Route: PATCH /businesses/me/appointments/{requestId}/decline — BUSINESS only
resource "aws_apigatewayv2_route" "patch_businesses_me_appointments_decline" {
  api_id             = module.api_gateway.api_id
  route_key          = "PATCH /businesses/me/appointments/{requestId}/decline"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_appointments.id}"
}

# Route: PATCH /businesses/me/appointments/{requestId}/complete — BUSINESS only
resource "aws_apigatewayv2_route" "patch_businesses_me_appointments_complete" {
  api_id             = module.api_gateway.api_id
  route_key          = "PATCH /businesses/me/appointments/{requestId}/complete"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_appointments.id}"
}

# Route: PATCH /businesses/me/appointments/{requestId}/noshow — BUSINESS only
resource "aws_apigatewayv2_route" "patch_businesses_me_appointments_noshow" {
  api_id             = module.api_gateway.api_id
  route_key          = "PATCH /businesses/me/appointments/{requestId}/noshow"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_appointments.id}"
}

###############################################################################
# Phase 6a — Lambda: users (notifications list + mark read + user profile)
###############################################################################

module "lambda_users" {
  source = "../../modules/lambda-users"

  environment              = var.environment
  aws_region               = var.aws_region
  users_table_name         = module.dynamodb_users.table_name
  users_table_arn          = module.dynamodb_users.table_arn
  notifications_table_name = module.dynamodb_notifications.table_name
  notifications_table_arn  = module.dynamodb_notifications.table_arn
}

# Allow API Gateway to invoke lambda-users
resource "aws_lambda_permission" "api_gw_users" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_users.function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# Integration: API Gateway → lambda-users
resource "aws_apigatewayv2_integration" "lambda_users" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda_users.invoke_arn
  payload_format_version = "2.0"
}

# Route: GET /notifications — JWT required (any role)
resource "aws_apigatewayv2_route" "get_notifications" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /notifications"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_users.id}"
}

# Route: PATCH /notifications/{notificationId}/read — JWT required (any role)
resource "aws_apigatewayv2_route" "patch_notification_read" {
  api_id             = module.api_gateway.api_id
  route_key          = "PATCH /notifications/{notificationId}/read"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_users.id}"
}

# Route: GET /users/me — JWT required (any role)
resource "aws_apigatewayv2_route" "get_users_me" {
  api_id             = module.api_gateway.api_id
  route_key          = "GET /users/me"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_users.id}"
}

# Route: PATCH /users/me — JWT required (any role)
resource "aws_apigatewayv2_route" "patch_users_me" {
  api_id             = module.api_gateway.api_id
  route_key          = "PATCH /users/me"
  authorization_type = "JWT"
  authorizer_id      = module.api_gateway.jwt_authorizer_id
  target             = "integrations/${aws_apigatewayv2_integration.lambda_users.id}"
}

###############################################################################
# Phase 5a — SQS notification queue + DLQ + SNS subscription
###############################################################################

module "sqs" {
  source = "../../modules/sqs"

  environment   = var.environment
  sns_topic_arn = aws_sns_topic.events.arn
}

###############################################################################
# Phase 5a — Lambda: notification (SQS consumer — stub handler, real in 5c)
###############################################################################

module "lambda_notification" {
  source = "../../modules/lambda-notification"

  environment                     = var.environment
  aws_region                      = var.aws_region
  queue_arn                       = module.sqs.queue_arn
  appointment_requests_table_name = module.dynamodb_appointment_requests.table_name
  appointment_requests_table_arn  = module.dynamodb_appointment_requests.table_arn
  users_table_name                = module.dynamodb_users.table_name
  users_table_arn                 = module.dynamodb_users.table_arn
  business_profiles_table_name    = module.dynamodb_business_profiles.table_name
  business_profiles_table_arn     = module.dynamodb_business_profiles.table_arn
  services_table_name             = module.dynamodb_services.table_name
  services_table_arn              = module.dynamodb_services.table_arn
  waitlist_entries_table_name     = module.dynamodb_waitlist_entries.table_name
  waitlist_entries_table_arn      = module.dynamodb_waitlist_entries.table_arn
}

###############################################################################
# Phase 7a — DynamoDB: web-signups + Lambda: contact (public marketing endpoints)
###############################################################################

module "dynamodb_web_signups" {
  source      = "../../modules/dynamodb-web-signups"
  environment = var.environment
}

module "lambda_contact" {
  source = "../../modules/lambda-contact"

  environment            = var.environment
  aws_region             = var.aws_region
  web_signups_table_name = module.dynamodb_web_signups.table_name
  web_signups_table_arn  = module.dynamodb_web_signups.table_arn
  admin_email            = var.admin_email
}

# Allow API Gateway to invoke lambda-contact
resource "aws_lambda_permission" "api_gw_contact" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_contact.function_arn
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${module.api_gateway.execution_arn}/*/*"
}

# Integration: API Gateway → lambda-contact
resource "aws_apigatewayv2_integration" "lambda_contact" {
  api_id                 = module.api_gateway.api_id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda_contact.invoke_arn
  payload_format_version = "2.0"
}

# Route: POST /web/contact — no auth (public marketing endpoint)
resource "aws_apigatewayv2_route" "post_web_contact" {
  api_id             = module.api_gateway.api_id
  route_key          = "POST /web/contact"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_contact.id}"
}

# Route: POST /web/signup — no auth (public marketing endpoint)
resource "aws_apigatewayv2_route" "post_web_signup" {
  api_id             = module.api_gateway.api_id
  route_key          = "POST /web/signup"
  authorization_type = "NONE"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_contact.id}"
}

###############################################################################
# Phase 7d — Marketing SPA hosting (S3 + CloudFront + Route 53)
###############################################################################

module "marketing" {
  source = "../../modules/marketing"

  environment         = var.environment
  hosted_zone_id      = data.aws_ssm_parameter.hosted_zone_id.value
  acm_certificate_arn = data.aws_ssm_parameter.acm_certificate_arn.value
}

###############################################################################
# Phase 9b — Observability: DLQ alarm + per-Lambda error rate alarms
###############################################################################

module "observability" {
  source = "../../modules/observability"

  environment   = var.environment
  dlq_arn       = module.sqs.dlq_arn
  admin_email   = var.admin_email
  lambda_function_names = [
    "qulene-${var.environment}-lambda-auth",
    "qulene-${var.environment}-lambda-businesses",
    "qulene-${var.environment}-lambda-services",
    "qulene-${var.environment}-lambda-appointments",
    "qulene-${var.environment}-lambda-waitlist",
    "qulene-${var.environment}-lambda-notification",
    "qulene-${var.environment}-lambda-users",
    "qulene-${var.environment}-lambda-contact",
  ]
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
  value     = data.aws_ssm_parameter.hosted_zone_id.value
  sensitive = true
}

output "acm_certificate_arn" {
  value     = data.aws_ssm_parameter.acm_certificate_arn.value
  sensitive = true
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

output "sns_events_topic_arn" {
  description = "SNS events topic ARN (used by Phase 5a to wire SQS subscriptions)"
  value       = aws_sns_topic.events.arn
}
