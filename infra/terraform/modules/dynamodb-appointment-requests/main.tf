variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

resource "aws_dynamodb_table" "appointment_requests" {
  name         = "qulene-${var.environment}-appointment-requests"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "requestId"

  attribute {
    name = "requestId"
    type = "S"
  }

  attribute {
    name = "businessId"
    type = "S"
  }

  attribute {
    name = "status"
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

  attribute {
    name = "serviceId"
    type = "S"
  }

  attribute {
    name = "idempotencyKey"
    type = "S"
  }

  # Business view by status — used by business dashboard
  global_secondary_index {
    name            = "businessId-status-index"
    hash_key        = "businessId"
    range_key       = "status"
    projection_type = "ALL"
  }

  # Customer view of own requests (newest first via ScanIndexForward: false)
  global_secondary_index {
    name            = "customerId-index"
    hash_key        = "customerId"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # Service-level lookup — waitlist promotion and service soft-delete cascades
  global_secondary_index {
    name            = "serviceId-index"
    hash_key        = "serviceId"
    projection_type = "ALL"
  }

  # Idempotency replay check on appointment request creation
  global_secondary_index {
    name            = "idempotencyKey-index"
    hash_key        = "idempotencyKey"
    projection_type = "ALL"
  }
}

output "table_name" {
  description = "Appointment requests table name"
  value       = aws_dynamodb_table.appointment_requests.name
}

output "table_arn" {
  description = "Appointment requests table ARN"
  value       = aws_dynamodb_table.appointment_requests.arn
}
