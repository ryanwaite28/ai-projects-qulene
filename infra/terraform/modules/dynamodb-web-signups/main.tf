variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

resource "aws_dynamodb_table" "web_signups" {
  name         = "qulene-${var.environment}-web-signups"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "email"

  attribute {
    name = "email"
    type = "S"
  }

  tags = {
    Name        = "qulene-${var.environment}-web-signups"
    Project     = "qulene"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

output "table_name" {
  description = "Web signups table name"
  value       = aws_dynamodb_table.web_signups.name
}

output "table_arn" {
  description = "Web signups table ARN"
  value       = aws_dynamodb_table.web_signups.arn
}
