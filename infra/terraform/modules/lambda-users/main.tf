variable "environment" {
  description = "Deployment environment (dev | prod)"
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

variable "notifications_table_name" {
  description = "Notifications DynamoDB table name"
  type        = string
}

variable "notifications_table_arn" {
  description = "Notifications DynamoDB table ARN"
  type        = string
}

# Env var cross-reference:
#   USERS_TABLE          → users.table.ts TABLE()
#   NOTIFICATIONS_TABLE  → notifications.table.ts TABLE()
#   DYNAMODB_ENDPOINT    → dynamo.client.ts createDynamoClient()
#   AWS_REGION           → dynamo.client.ts
module "fn" {
  source = "../lambda"

  function_name = "qulene-${var.environment}-lambda-users"
  package_path  = "${path.root}/../../../../backend/dist/lambdas/users/index.zip"
  memory_size   = 256
  timeout       = 30

  environment_variables = {
    USERS_TABLE         = var.users_table_name
    NOTIFICATIONS_TABLE = var.notifications_table_name
    DYNAMODB_ENDPOINT   = ""
  }
}

resource "aws_iam_role_policy" "users_dynamodb" {
  name = "qulene-${var.environment}-lambda-users-dynamodb"
  role = module.fn.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Query"]
        Resource = [
          var.users_table_arn,
          "${var.users_table_arn}/index/*",
        ]
      },
      {
        Effect = "Allow"
        Action = ["dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Query"]
        Resource = [
          var.notifications_table_arn,
          "${var.notifications_table_arn}/index/*",
        ]
      },
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
