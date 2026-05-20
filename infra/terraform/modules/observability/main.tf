variable "environment" {
  description = "Deployment environment (dev | prod)"
  type        = string
}

variable "dlq_arn" {
  description = "Notification dead-letter queue ARN (from module.sqs.dlq_arn)"
  type        = string
}

variable "admin_email" {
  description = "Email address to receive alarm notifications"
  type        = string
}

variable "lambda_function_names" {
  description = "List of Lambda function names to monitor for error rate (names carry the qulene-{env}-lambda- prefix)"
  type        = list(string)
}

locals {
  # Extract queue name from ARN: arn:aws:sqs:region:account:queue-name → index 5
  dlq_name = split(":", var.dlq_arn)[5]
}

###############################################################################
# SNS alarms topic — dedicated channel; separate from the events topic
###############################################################################

resource "aws_sns_topic" "alarms" {
  name = "qulene-${var.environment}-alarms"

  tags = {
    Name = "qulene-${var.environment}-alarms"
  }
}

# Admin email subscription — requires one-time manual confirmation after first apply
resource "aws_sns_topic_subscription" "admin_email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.admin_email
}

###############################################################################
# DLQ depth alarm
# Fires immediately when any message lands in the notification DLQ.
# treat_missing_data = "notBreaching" — idle queue is healthy, not unknown.
###############################################################################

resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "qulene-${var.environment}-dlq-depth"
  alarm_description   = "Notification DLQ has unprocessed messages — check lambda-notification failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = local.dlq_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = {
    Name = "qulene-${var.environment}-dlq-depth"
  }
}

###############################################################################
# Per-Lambda error rate alarms (metric math)
#
# Fires when: invocations > 10 AND (errors / invocations) * 100 > 1
# The invocation guard prevents alarm noise on idle or infrequently-called
# Lambdas where a single error would otherwise spike the percentage.
#
# evaluation_periods = 2 (10 minutes) — avoids one-off transient errors.
# treat_missing_data = "notBreaching" — no alarm during zero-traffic windows.
###############################################################################

resource "aws_cloudwatch_metric_alarm" "lambda_error_rate" {
  for_each = toset(var.lambda_function_names)

  alarm_name          = "${each.value}-error-rate"
  alarm_description   = "Lambda ${each.value} error rate exceeded 1% (with > 10 invocations)"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 1
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "IF(invocations > 10, (errors / invocations) * 100, 0)"
    label       = "Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = each.value }
    }
  }

  metric_query {
    id = "invocations"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Invocations"
      period      = 300
      stat        = "Sum"
      dimensions  = { FunctionName = each.value }
    }
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = {
    Name = "${each.value}-error-rate"
  }
}

###############################################################################
# Outputs
###############################################################################

output "alarms_topic_arn" {
  description = "SNS alarms topic ARN"
  value       = aws_sns_topic.alarms.arn
}
