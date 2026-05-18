output "function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Lambda invoke ARN (used by API Gateway integration)"
  value       = aws_lambda_function.this.invoke_arn
}

output "role_name" {
  description = "IAM role name (caller attaches additional policies here)"
  value       = aws_iam_role.lambda.name
}

output "role_arn" {
  description = "IAM role ARN"
  value       = aws_iam_role.lambda.arn
}
