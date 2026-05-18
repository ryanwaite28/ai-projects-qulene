variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

resource "aws_dynamodb_table" "business_profiles" {
  name         = "qulene-${var.environment}-business-profiles"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "businessId"

  attribute {
    name = "businessId"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  global_secondary_index {
    name            = "category-index"
    hash_key        = "category"
    range_key       = "businessId"
    projection_type = "ALL"
  }
}

output "table_name" {
  description = "Business profiles table name"
  value       = aws_dynamodb_table.business_profiles.name
}

output "table_arn" {
  description = "Business profiles table ARN"
  value       = aws_dynamodb_table.business_profiles.arn
}
