variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
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

variable "notifications_table_name" {
  description = "Notifications DynamoDB table name"
  type        = string
}

variable "notifications_table_arn" {
  description = "Notifications DynamoDB table ARN"
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

variable "services_table_name" {
  description = "Services DynamoDB table name"
  type        = string
}

variable "services_table_arn" {
  description = "Services DynamoDB table ARN"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS events topic ARN"
  type        = string
}

module "fn" {
  source = "../lambda"

  function_name = "qulene-${var.environment}-lambda-waitlist"
  package_path  = "${path.root}/../../../../backend/dist/lambdas/waitlist/index.zip"
  memory_size   = 256
  timeout       = 30

  # Env var cross-reference (CLAUDE.md Rule):
  #   WAITLIST_ENTRIES_TABLE → waitlist-entries.table.ts TABLE()
  #   NOTIFICATIONS_TABLE    → notifications.table.ts TABLE()
  #   USERS_TABLE            → users.table.ts TABLE() (incrementUnreadCount)
  #   SERVICES_TABLE         → services.table.ts TABLE() (getServiceById)
  #   SNS_TOPIC_ARN          → sns.client.ts publishEvent()
  #   SNS_ENDPOINT           → sns.client.ts createSnsClient()
  #   DYNAMODB_ENDPOINT      → dynamo.client.ts createDynamoClient()
  #   AWS_REGION             → dynamo.client.ts + sns.client.ts
  environment_variables = {
    WAITLIST_ENTRIES_TABLE = var.waitlist_entries_table_name
    NOTIFICATIONS_TABLE    = var.notifications_table_name
    USERS_TABLE            = var.users_table_name
    SERVICES_TABLE         = var.services_table_name
    SNS_TOPIC_ARN          = var.sns_topic_arn
    SNS_ENDPOINT           = ""
    DYNAMODB_ENDPOINT      = ""
    AWS_REGION             = var.aws_region
  }
}

resource "aws_iam_role_policy" "waitlist_dynamodb" {
  name = "qulene-${var.environment}-lambda-waitlist-dynamodb"
  role = module.fn.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:Query"]
        Resource = [
          var.waitlist_entries_table_arn,
          "${var.waitlist_entries_table_arn}/index/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem"]
        Resource = [var.notifications_table_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:UpdateItem"]
        Resource = [var.users_table_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem"]
        Resource = [var.services_table_arn]
      },
    ]
  })
}

resource "aws_iam_role_policy" "waitlist_sns" {
  name = "qulene-${var.environment}-lambda-waitlist-sns"
  role = module.fn.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = var.sns_topic_arn
      }
    ]
  })
}

output "function_arn" {
  description = "Lambda function ARN"
  value       = module.fn.function_arn
}

output "invoke_arn" {
  description = "Lambda invoke ARN for API Gateway integration"
  value       = module.fn.invoke_arn
}

output "role_name" {
  description = "Lambda execution role name"
  value       = module.fn.role_name
}
