variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

resource "aws_dynamodb_table" "waitlist_entries" {
  name         = "qulene-${var.environment}-waitlist-entries"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "entryId"

  attribute {
    name = "entryId"
    type = "S"
  }

  attribute {
    name = "serviceId"
    type = "S"
  }

  attribute {
    name = "customerId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  # Promotion query — oldest ACTIVE entry per service (ScanIndexForward: true + FilterExpression)
  global_secondary_index {
    name            = "serviceId-status-index"
    hash_key        = "serviceId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Customer view of own waitlist entries
  global_secondary_index {
    name            = "customerId-index"
    hash_key        = "customerId"
    projection_type = "ALL"
  }
}

output "table_name" {
  description = "Waitlist entries table name"
  value       = aws_dynamodb_table.waitlist_entries.name
}

output "table_arn" {
  description = "Waitlist entries table ARN"
  value       = aws_dynamodb_table.waitlist_entries.arn
}
