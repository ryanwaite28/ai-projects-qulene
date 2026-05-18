variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

resource "aws_sns_topic" "events" {
  name = "qulene-${var.environment}-events"
}

output "topic_arn" {
  description = "SNS topic ARN"
  value       = aws_sns_topic.events.arn
}

output "topic_name" {
  description = "SNS topic name"
  value       = aws_sns_topic.events.name
}
