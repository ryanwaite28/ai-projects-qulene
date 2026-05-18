variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

resource "aws_dynamodb_table" "notifications" {
  name         = "qulene-${var.environment}-notifications"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "notificationId"

  attribute {
    name = "notificationId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # Paginated notification inbox per user, sorted newest-first
  global_secondary_index {
    name            = "userId-createdAt-index"
    hash_key        = "userId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }
}

output "table_name" {
  description = "Notifications table name"
  value       = aws_dynamodb_table.notifications.name
}

output "table_arn" {
  description = "Notifications table ARN"
  value       = aws_dynamodb_table.notifications.arn
}
