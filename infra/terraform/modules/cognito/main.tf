###############################################################################
# Cognito User Pool + App Client
#
# custom:role is immutable after creation — enforced via mutable = false on the
# schema attribute. The App Client has no client secret so the mobile app can
# safely hold the client ID in plain config.
###############################################################################

resource "aws_cognito_user_pool" "this" {
  name = "qulene-${var.environment}-user-pool"

  # Users sign in with email.
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  schema {
    name                     = "role"
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = false
    required                 = false

    string_attribute_constraints {
      min_length = 1
      max_length = 16
    }
  }

  # Cognito sends its own auth emails (verification, reset).
  # Application notification emails go through SES (Phase 5b).
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  tags = {
    Name = "qulene-${var.environment}-user-pool"
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name         = "qulene-${var.environment}-app-client"
  user_pool_id = aws_cognito_user_pool.this.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"

  read_attributes  = ["email", "custom:role"]
  write_attributes = ["email", "custom:role"]

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}
