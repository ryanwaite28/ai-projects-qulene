variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

variable "web_signups_table_name" {
  description = "Web signups DynamoDB table name"
  type        = string
}

variable "web_signups_table_arn" {
  description = "Web signups DynamoDB table ARN"
  type        = string
}

variable "admin_email" {
  description = "Admin email address for contact form notifications"
  type        = string
}

# Env var cross-reference:
#   WEB_SIGNUPS_TABLE → web-signups.table.ts TABLE()
#   AWS_REGION        → dynamo.client.ts createDynamoClient()
#   DYNAMODB_ENDPOINT → dynamo.client.ts createDynamoClient()
#   SES_ENDPOINT      → ses.client.ts createSesClient()
#   SES_FROM_EMAIL    → ses.client.ts sendEmail() Source
#   ADMIN_EMAIL       → contact.service.ts submitContact()
module "fn" {
  source = "../lambda"

  function_name = "qulene-${var.environment}-lambda-contact"
  package_path  = "${path.root}/../../../../backend/dist/lambdas/contact/index.zip"
  memory_size   = 128
  timeout       = 10

  environment_variables = {
    WEB_SIGNUPS_TABLE = var.web_signups_table_name
    DYNAMODB_ENDPOINT = ""
    SES_ENDPOINT      = ""
    SES_FROM_EMAIL    = "no-reply@qulene.com"
    ADMIN_EMAIL       = var.admin_email
  }
}

resource "aws_iam_role_policy" "contact_dynamodb" {
  name = "qulene-${var.environment}-lambda-contact-dynamodb"
  role = module.fn.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem"]
        Resource = [var.web_signups_table_arn]
      },
    ]
  })
}

resource "aws_iam_role_policy" "contact_ses" {
  name = "qulene-${var.environment}-lambda-contact-ses"
  role = module.fn.role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
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
