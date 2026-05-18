variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS events topic ARN to subscribe from"
  type        = string
}

resource "aws_sqs_queue" "dlq" {
  name = "qulene-${var.environment}-notifications-dlq"
}

resource "aws_sqs_queue" "notifications" {
  name                       = "qulene-${var.environment}-notifications"
  visibility_timeout_seconds = 120

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue_policy" "notifications" {
  queue_url = aws_sqs_queue.notifications.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSNSPublish"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.notifications.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = var.sns_topic_arn
          }
        }
      }
    ]
  })
}

resource "aws_sns_topic_subscription" "sqs" {
  topic_arn            = var.sns_topic_arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.notifications.arn
  raw_message_delivery = false
}

output "queue_arn" {
  description = "Notification SQS queue ARN"
  value       = aws_sqs_queue.notifications.arn
}

output "queue_url" {
  description = "Notification SQS queue URL"
  value       = aws_sqs_queue.notifications.id
}

output "dlq_arn" {
  description = "Dead-letter queue ARN"
  value       = aws_sqs_queue.dlq.arn
}
