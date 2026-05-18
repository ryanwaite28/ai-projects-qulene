variable "environment" {
  description = "Environment name (dev | prod)"
  type        = string
}

resource "aws_dynamodb_table" "users" {
  name         = "qulene-${var.environment}-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  tags = {
    Name = "qulene-${var.environment}-users"
  }
}

output "table_name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.users.name
}

output "table_arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.users.arn
}
