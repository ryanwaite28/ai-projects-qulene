variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "queue_arn" {
  description = "SQS notification queue ARN"
  type        = string
}

variable "appointment_requests_table_name" {
  description = "Appointment requests DynamoDB table name"
  type        = string
}

variable "appointment_requests_table_arn" {
  description = "Appointment requests DynamoDB table ARN"
  type        = string
}

variable "users_table_name" {
  description = "Users DynamoDB table name"
  type        = string
}

variable "users_table_arn" {
  description = "Users DynamoDB table ARN"
  type        = string
}

variable "business_profiles_table_name" {
  description = "Business profiles DynamoDB table name"
  type        = string
}

variable "business_profiles_table_arn" {
  description = "Business profiles DynamoDB table ARN"
  type        = string
}

variable "services_table_name" {
  description = "Services DynamoDB table name"
  type        = string
}

variable "services_table_arn" {
  description = "Services DynamoDB table ARN"
  type        = string
}

variable "waitlist_entries_table_name" {
  description = "Waitlist entries DynamoDB table name"
  type        = string
}

variable "waitlist_entries_table_arn" {
  description = "Waitlist entries DynamoDB table ARN"
  type        = string
}

# Env var cross-reference (Phase 5c implements the real handler):
#   APPOINTMENT_REQUESTS_TABLE → appointment-requests.table.ts TABLE()
#   USERS_TABLE                → users.table.ts TABLE()
#   BUSINESS_PROFILES_TABLE    → business-profiles.table.ts TABLE()
#   SERVICES_TABLE             → services.table.ts TABLE()
#   WAITLIST_ENTRIES_TABLE     → waitlist-entries.table.ts TABLE()
#   SECRETS_NAME               → GetSecretValue at cold start (SES_FROM_EMAIL)
#   AWS_REGION                 → dynamo.client.ts + ses.client.ts
#   DYNAMODB_ENDPOINT          → dynamo.client.ts createDynamoClient()
#   SES_ENDPOINT               → ses.client.ts createSesClient()
module "fn" {
  source = "../lambda"

  function_name = "qulene-${var.environment}-lambda-notification"
  package_path  = "${path.root}/../../../../backend/dist/lambdas/notification/index.zip"
  memory_size   = 256
  timeout       = 120

  environment_variables = {
    APPOINTMENT_REQUESTS_TABLE = var.appointment_requests_table_name
    USERS_TABLE                = var.users_table_name
    BUSINESS_PROFILES_TABLE    = var.business_profiles_table_name
    SERVICES_TABLE             = var.services_table_name
    WAITLIST_ENTRIES_TABLE     = var.waitlist_entries_table_name
    SECRETS_NAME               = "qulene-${var.environment}-secrets"
    AWS_REGION                 = var.aws_region
    DYNAMODB_ENDPOINT          = ""
    SES_ENDPOINT               = ""
  }
}

resource "aws_lambda_event_source_mapping" "sqs" {
  event_source_arn = var.queue_arn
  function_name    = module.fn.function_arn
  batch_size       = 1
  enabled          = true
}

resource "aws_iam_role_policy" "notification_sqs" {
  name = "qulene-${var.environment}-lambda-notification-sqs"
  role = module.fn.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
        ]
        Resource = var.queue_arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "notification_ses" {
  name = "qulene-${var.environment}-lambda-notification-ses"
  role = module.fn.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "notification_dynamodb" {
  name = "qulene-${var.environment}-lambda-notification-dynamodb"
  role = module.fn.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem"]
        Resource = [
          var.appointment_requests_table_arn,
          var.users_table_arn,
          var.business_profiles_table_arn,
          var.services_table_arn,
          var.waitlist_entries_table_arn,
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy" "notification_secrets" {
  name = "qulene-${var.environment}-lambda-notification-secrets"
  role = module.fn.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:*:*:secret:qulene-${var.environment}-secrets*"
      }
    ]
  })
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = module.fn.function_arn
}

output "role_name" {
  description = "Lambda execution role name"
  value       = module.fn.role_name
}
