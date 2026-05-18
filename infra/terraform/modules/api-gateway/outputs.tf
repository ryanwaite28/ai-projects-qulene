output "api_id" {
  description = "API Gateway v2 API ID"
  value       = aws_apigatewayv2_api.this.id
}

output "api_endpoint" {
  description = "API Gateway default execution endpoint"
  value       = aws_apigatewayv2_api.this.api_endpoint
}

output "jwt_authorizer_id" {
  description = "Cognito JWT authorizer ID (passed to routes)"
  value       = aws_apigatewayv2_authorizer.cognito_jwt.id
}

output "execution_arn" {
  description = "API Gateway execution ARN prefix (used in Lambda permissions)"
  value       = aws_apigatewayv2_api.this.execution_arn
}
