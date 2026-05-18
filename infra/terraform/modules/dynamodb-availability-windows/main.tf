variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

resource "aws_dynamodb_table" "availability_windows" {
  name         = "qulene-${var.environment}-availability-windows"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "windowId"

  attribute {
    name = "windowId"
    type = "S"
  }

  attribute {
    name = "businessId"
    type = "S"
  }

  global_secondary_index {
    name            = "businessId-index"
    hash_key        = "businessId"
    projection_type = "ALL"
  }

  tags = {
    Project     = "qulene"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

output "table_name" {
  description = "Availability windows table name"
  value       = aws_dynamodb_table.availability_windows.name
}

output "table_arn" {
  description = "Availability windows table ARN"
  value       = aws_dynamodb_table.availability_windows.arn
}
