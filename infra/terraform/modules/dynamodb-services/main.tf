variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

resource "aws_dynamodb_table" "services" {
  name         = "qulene-${var.environment}-services"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "serviceId"

  attribute {
    name = "serviceId"
    type = "S"
  }

  attribute {
    name = "businessId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  global_secondary_index {
    name            = "businessId-index"
    hash_key        = "businessId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }
}

output "table_name" {
  description = "Services table name"
  value       = aws_dynamodb_table.services.name
}

output "table_arn" {
  description = "Services table ARN"
  value       = aws_dynamodb_table.services.arn
}
