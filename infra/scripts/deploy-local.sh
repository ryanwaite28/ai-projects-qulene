#!/usr/bin/env bash
#
# deploy-local.sh — Build and deploy all Lambda functions to MiniStack,
# then wire API Gateway integrations and routes.
#
# Prerequisites: npm run bootstrap:local must have run first (creates
# DynamoDB tables, Cognito pool, API Gateway shell, .local-stack.json).
#
# Run: npm run deploy:local
# Re-runnable: Lambda functions are created-or-updated; routes are
# created-or-updated by route key.

set -euo pipefail

MINISTACK_ENDPOINT="${MINISTACK_ENDPOINT:-http://localhost:4566}"
AWS_REGION="${AWS_REGION:-us-east-1}"
MINISTACK_ACCOUNT="000000000000"
LAMBDA_ROLE="arn:aws:iam::${MINISTACK_ACCOUNT}:role/lambda-local-role"

# ─── Output helpers ────────────────────────────────────────────────────────────

if [ -t 1 ]; then
  COLOR_RESET="\033[0m"
  COLOR_INFO="\033[1;34m"
  COLOR_SUCCESS="\033[1;32m"
  COLOR_WARN="\033[1;33m"
  COLOR_ERROR="\033[1;31m"
  COLOR_DIM="\033[2m"
else
  COLOR_RESET=""; COLOR_INFO=""; COLOR_SUCCESS=""; COLOR_WARN=""; COLOR_ERROR=""; COLOR_DIM=""
fi

info()    { printf "${COLOR_INFO}[info]${COLOR_RESET}    %s\n" "$*"; }
success() { printf "${COLOR_SUCCESS}[ok]${COLOR_RESET}      %s\n" "$*"; }
warn()    { printf "${COLOR_WARN}[warn]${COLOR_RESET}    %s\n" "$*"; }
error()   { printf "${COLOR_ERROR}[error]${COLOR_RESET}   %s\n" "$*"; }

CREATED=(); UPDATED=(); SKIPPED=()
mark_created() { CREATED+=("$1"); }
mark_updated() { UPDATED+=("$1"); }
mark_skipped() { SKIPPED+=("$1"); }

aws_local() {
  aws --endpoint-url="$MINISTACK_ENDPOINT" --region "$AWS_REGION" \
    --no-sign-request \
    --output text \
    "$@"
}

# ─── Load environment ──────────────────────────────────────────────────────────

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  info "Loaded .env"
fi

# Load local stack state produced by bootstrap:local
if [ ! -f .local-stack.json ]; then
  error ".local-stack.json not found — run 'npm run bootstrap:local' first"
  exit 1
fi

API_ID=$(jq -r '.apiId' .local-stack.json)
AUTHORIZER_ID=$(jq -r '.authorizerId' .local-stack.json)
API_BASE_URL=$(jq -r '.apiBaseUrl' .local-stack.json)

if [ -z "$API_ID" ] || [ "$API_ID" = "null" ]; then
  error "apiId missing from .local-stack.json — re-run 'npm run bootstrap:local'"
  exit 1
fi

info "API ID: $API_ID  |  Authorizer ID: $AUTHORIZER_ID"

# ─── Env var defaults (all pointing at MiniStack) ─────────────────────────────

DYNAMODB_ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:4566}"
SNS_ENDPOINT="${SNS_ENDPOINT:-http://localhost:4566}"
SES_ENDPOINT="${SES_ENDPOINT:-http://localhost:4566}"
S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:4566}"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:-arn:aws:sns:${AWS_REGION}:${MINISTACK_ACCOUNT}:qulene-local-events}"
NOTIFICATION_QUEUE_URL="${NOTIFICATION_QUEUE_URL:-http://localhost:4566/${MINISTACK_ACCOUNT}/qulene-local-notifications}"
NOTIFICATION_QUEUE_ARN="arn:aws:sqs:${AWS_REGION}:${MINISTACK_ACCOUNT}:qulene-local-notifications"

USERS_TABLE="${USERS_TABLE:-qulene-local-users}"
BUSINESS_PROFILES_TABLE="${BUSINESS_PROFILES_TABLE:-qulene-local-business-profiles}"
SERVICES_TABLE="${SERVICES_TABLE:-qulene-local-services}"
AVAILABILITY_WINDOWS_TABLE="${AVAILABILITY_WINDOWS_TABLE:-qulene-local-availability-windows}"
APPOINTMENT_REQUESTS_TABLE="${APPOINTMENT_REQUESTS_TABLE:-qulene-local-appointment-requests}"
WAITLIST_ENTRIES_TABLE="${WAITLIST_ENTRIES_TABLE:-qulene-local-waitlist-entries}"
NOTIFICATIONS_TABLE="${NOTIFICATIONS_TABLE:-qulene-local-notifications}"
WEB_SIGNUPS_TABLE="${WEB_SIGNUPS_TABLE:-qulene-local-web-signups}"
MEDIA_BUCKET="${MEDIA_BUCKET:-qulene-local-media}"
SECRETS_NAME="${SECRETS_NAME:-qulene-dev-secrets}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@qulene.com}"
SES_FROM_EMAIL="${SES_FROM_EMAIL:-no-reply@qulene.com}"

# ─── Build backend ─────────────────────────────────────────────────────────────

info "Building backend Lambda bundles..."
npm run build -w backend
success "Build complete"

# ─── Lambda helpers ────────────────────────────────────────────────────────────

lambda_env_json() {
  # Usage: lambda_env_json KEY1 VAL1 KEY2 VAL2 ...
  local vars="{}"
  while [ $# -ge 2 ]; do
    local key="$1" val="$2"; shift 2
    vars=$(echo "$vars" | jq --arg k "$key" --arg v "$val" '.[$k] = $v')
  done
  echo "{\"Variables\": $vars}"
}

deploy_lambda() {
  local name="$1" zip="$2" timeout="${3:-30}" memory="${4:-256}"
  shift 4
  # Remaining args are KEY VAL pairs for env vars
  local env_json
  env_json=$(lambda_env_json "$@")
  local zip_path="${REPO_ROOT}/backend/dist/lambdas/${zip}/index.zip"

  if [ ! -f "$zip_path" ]; then
    warn "Bundle not found: $zip_path — skipping $name"
    return 1
  fi

  if aws_local lambda get-function --function-name "$name" >/dev/null 2>&1; then
    aws_local lambda update-function-code \
      --function-name "$name" \
      --zip-file "fileb://${zip_path}" >/dev/null
    aws_local lambda update-function-configuration \
      --function-name "$name" \
      --environment "$env_json" >/dev/null
    mark_updated "Lambda $name"
  else
    aws_local lambda create-function \
      --function-name "$name" \
      --runtime nodejs20.x \
      --role "$LAMBDA_ROLE" \
      --handler index.handler \
      --zip-file "fileb://${zip_path}" \
      --timeout "$timeout" \
      --memory-size "$memory" \
      --environment "$env_json" >/dev/null
    mark_created "Lambda $name"
  fi
  # Return the function ARN
  aws_local lambda get-function-configuration \
    --function-name "$name" \
    --query 'FunctionArn' 2>/dev/null || \
    echo "arn:aws:lambda:${AWS_REGION}:${MINISTACK_ACCOUNT}:function:${name}"
}

# ─── Deploy Lambda functions ───────────────────────────────────────────────────

info "Deploying Lambda functions..."

ARN_AUTH=$(deploy_lambda "qulene-local-lambda-auth" "auth" 30 256 \
  USERS_TABLE "$USERS_TABLE" \
  DYNAMODB_ENDPOINT "$DYNAMODB_ENDPOINT" \
  AWS_REGION "$AWS_REGION")

ARN_BUSINESSES=$(deploy_lambda "qulene-local-lambda-businesses" "businesses" 30 256 \
  BUSINESS_PROFILES_TABLE "$BUSINESS_PROFILES_TABLE" \
  AVAILABILITY_WINDOWS_TABLE "$AVAILABILITY_WINDOWS_TABLE" \
  MEDIA_BUCKET "$MEDIA_BUCKET" \
  S3_ENDPOINT "$S3_ENDPOINT" \
  DYNAMODB_ENDPOINT "$DYNAMODB_ENDPOINT" \
  AWS_REGION "$AWS_REGION")

ARN_SERVICES=$(deploy_lambda "qulene-local-lambda-services" "services" 30 256 \
  SERVICES_TABLE "$SERVICES_TABLE" \
  SNS_TOPIC_ARN "$SNS_TOPIC_ARN" \
  SNS_ENDPOINT "$SNS_ENDPOINT" \
  DYNAMODB_ENDPOINT "$DYNAMODB_ENDPOINT" \
  AWS_REGION "$AWS_REGION")

ARN_APPOINTMENTS=$(deploy_lambda "qulene-local-lambda-appointments" "appointments" 30 256 \
  APPOINTMENT_REQUESTS_TABLE "$APPOINTMENT_REQUESTS_TABLE" \
  NOTIFICATIONS_TABLE "$NOTIFICATIONS_TABLE" \
  USERS_TABLE "$USERS_TABLE" \
  SERVICES_TABLE "$SERVICES_TABLE" \
  SNS_TOPIC_ARN "$SNS_TOPIC_ARN" \
  SNS_ENDPOINT "$SNS_ENDPOINT" \
  DYNAMODB_ENDPOINT "$DYNAMODB_ENDPOINT" \
  AWS_REGION "$AWS_REGION")

ARN_WAITLIST=$(deploy_lambda "qulene-local-lambda-waitlist" "waitlist" 30 256 \
  WAITLIST_ENTRIES_TABLE "$WAITLIST_ENTRIES_TABLE" \
  NOTIFICATIONS_TABLE "$NOTIFICATIONS_TABLE" \
  USERS_TABLE "$USERS_TABLE" \
  SERVICES_TABLE "$SERVICES_TABLE" \
  SNS_TOPIC_ARN "$SNS_TOPIC_ARN" \
  SNS_ENDPOINT "$SNS_ENDPOINT" \
  DYNAMODB_ENDPOINT "$DYNAMODB_ENDPOINT" \
  AWS_REGION "$AWS_REGION")

ARN_USERS=$(deploy_lambda "qulene-local-lambda-users" "users" 30 256 \
  USERS_TABLE "$USERS_TABLE" \
  NOTIFICATIONS_TABLE "$NOTIFICATIONS_TABLE" \
  DYNAMODB_ENDPOINT "$DYNAMODB_ENDPOINT" \
  AWS_REGION "$AWS_REGION")

ARN_NOTIFICATION=$(deploy_lambda "qulene-local-lambda-notification" "notification" 120 256 \
  APPOINTMENT_REQUESTS_TABLE "$APPOINTMENT_REQUESTS_TABLE" \
  USERS_TABLE "$USERS_TABLE" \
  BUSINESS_PROFILES_TABLE "$BUSINESS_PROFILES_TABLE" \
  SERVICES_TABLE "$SERVICES_TABLE" \
  WAITLIST_ENTRIES_TABLE "$WAITLIST_ENTRIES_TABLE" \
  SECRETS_NAME "$SECRETS_NAME" \
  AWS_REGION "$AWS_REGION" \
  DYNAMODB_ENDPOINT "$DYNAMODB_ENDPOINT" \
  SES_ENDPOINT "$SES_ENDPOINT")

ARN_CONTACT=$(deploy_lambda "qulene-local-lambda-contact" "contact" 10 128 \
  WEB_SIGNUPS_TABLE "$WEB_SIGNUPS_TABLE" \
  AWS_REGION "$AWS_REGION" \
  DYNAMODB_ENDPOINT "$DYNAMODB_ENDPOINT" \
  SES_ENDPOINT "$SES_ENDPOINT" \
  SES_FROM_EMAIL "$SES_FROM_EMAIL" \
  ADMIN_EMAIL "$ADMIN_EMAIL")

# ─── API Gateway integration helpers ──────────────────────────────────────────

make_integration_uri() {
  local fn_arn="$1"
  echo "arn:aws:apigateway:${AWS_REGION}:lambda:path/2015-03-31/functions/${fn_arn}/invocations"
}

create_integration() {
  local api_id="$1" fn_arn="$2"
  local uri
  uri=$(make_integration_uri "$fn_arn")
  aws_local apigatewayv2 create-integration \
    --api-id "$api_id" \
    --integration-type AWS_PROXY \
    --integration-uri "$uri" \
    --payload-format-version "2.0" \
    --query 'IntegrationId' 2>/dev/null
}

upsert_route() {
  local api_id="$1" route_key="$2" auth_type="$3" integration_id="$4"
  local target="integrations/${integration_id}"

  local existing_id
  existing_id=$(aws_local apigatewayv2 get-routes \
    --api-id "$api_id" \
    --query "Items[?RouteKey==\`${route_key}\`].RouteId" \
    --output text 2>/dev/null | head -1 || true)

  if [ -n "$existing_id" ] && [ "$existing_id" != "None" ]; then
    if [ "$auth_type" = "JWT" ]; then
      aws_local apigatewayv2 update-route \
        --api-id "$api_id" \
        --route-id "$existing_id" \
        --authorization-type JWT \
        --authorizer-id "$AUTHORIZER_ID" \
        --target "$target" >/dev/null
    else
      aws_local apigatewayv2 update-route \
        --api-id "$api_id" \
        --route-id "$existing_id" \
        --authorization-type NONE \
        --target "$target" >/dev/null
    fi
    mark_updated "Route $route_key"
  else
    if [ "$auth_type" = "JWT" ]; then
      aws_local apigatewayv2 create-route \
        --api-id "$api_id" \
        --route-key "$route_key" \
        --authorization-type JWT \
        --authorizer-id "$AUTHORIZER_ID" \
        --target "$target" >/dev/null
    else
      aws_local apigatewayv2 create-route \
        --api-id "$api_id" \
        --route-key "$route_key" \
        --authorization-type NONE \
        --target "$target" >/dev/null
    fi
    mark_created "Route $route_key"
  fi
}

# ─── Wire API Gateway routes ───────────────────────────────────────────────────

info "Wiring API Gateway integrations and routes..."

# lambda-auth
INTEG_AUTH=$(create_integration "$API_ID" "$ARN_AUTH")
upsert_route "$API_ID" "POST /auth/profile"  JWT  "$INTEG_AUTH"

# lambda-businesses
INTEG_BUSINESSES=$(create_integration "$API_ID" "$ARN_BUSINESSES")
upsert_route "$API_ID" "GET /businesses"                                  NONE "$INTEG_BUSINESSES"
upsert_route "$API_ID" "GET /businesses/{businessId}"                     NONE "$INTEG_BUSINESSES"
upsert_route "$API_ID" "PATCH /businesses/me"                             JWT  "$INTEG_BUSINESSES"
upsert_route "$API_ID" "POST /businesses/me/avatar"                       JWT  "$INTEG_BUSINESSES"
upsert_route "$API_ID" "GET /businesses/{businessId}/availability"        NONE "$INTEG_BUSINESSES"
upsert_route "$API_ID" "POST /businesses/me/availability"                 JWT  "$INTEG_BUSINESSES"
upsert_route "$API_ID" "DELETE /businesses/me/availability/{windowId}"    JWT  "$INTEG_BUSINESSES"

# lambda-services
INTEG_SERVICES=$(create_integration "$API_ID" "$ARN_SERVICES")
upsert_route "$API_ID" "GET /businesses/{businessId}/services"            NONE "$INTEG_SERVICES"
upsert_route "$API_ID" "POST /businesses/me/services"                     JWT  "$INTEG_SERVICES"
upsert_route "$API_ID" "PATCH /businesses/me/services/{serviceId}"        JWT  "$INTEG_SERVICES"
upsert_route "$API_ID" "DELETE /businesses/me/services/{serviceId}"       JWT  "$INTEG_SERVICES"

# lambda-appointments
INTEG_APPOINTMENTS=$(create_integration "$API_ID" "$ARN_APPOINTMENTS")
upsert_route "$API_ID" "POST /appointments"                                               JWT  "$INTEG_APPOINTMENTS"
upsert_route "$API_ID" "GET /appointments/me"                                             JWT  "$INTEG_APPOINTMENTS"
upsert_route "$API_ID" "DELETE /appointments/{requestId}"                                 JWT  "$INTEG_APPOINTMENTS"
upsert_route "$API_ID" "GET /businesses/me/appointments"                                  JWT  "$INTEG_APPOINTMENTS"
upsert_route "$API_ID" "PATCH /businesses/me/appointments/{requestId}/accept"             JWT  "$INTEG_APPOINTMENTS"
upsert_route "$API_ID" "PATCH /businesses/me/appointments/{requestId}/decline"            JWT  "$INTEG_APPOINTMENTS"
upsert_route "$API_ID" "PATCH /businesses/me/appointments/{requestId}/complete"           JWT  "$INTEG_APPOINTMENTS"
upsert_route "$API_ID" "PATCH /businesses/me/appointments/{requestId}/noshow"             JWT  "$INTEG_APPOINTMENTS"

# lambda-waitlist
INTEG_WAITLIST=$(create_integration "$API_ID" "$ARN_WAITLIST")
upsert_route "$API_ID" "POST /waitlist"                                    JWT  "$INTEG_WAITLIST"
upsert_route "$API_ID" "GET /waitlist/me"                                  JWT  "$INTEG_WAITLIST"
upsert_route "$API_ID" "DELETE /waitlist/{entryId}"                        JWT  "$INTEG_WAITLIST"
upsert_route "$API_ID" "GET /businesses/me/waitlist/{serviceId}"           JWT  "$INTEG_WAITLIST"

# lambda-users
INTEG_USERS=$(create_integration "$API_ID" "$ARN_USERS")
upsert_route "$API_ID" "GET /notifications"                                JWT  "$INTEG_USERS"
upsert_route "$API_ID" "PATCH /notifications/{notificationId}/read"        JWT  "$INTEG_USERS"
upsert_route "$API_ID" "GET /users/me"                                     JWT  "$INTEG_USERS"
upsert_route "$API_ID" "PATCH /users/me"                                   JWT  "$INTEG_USERS"

# lambda-contact (public — no JWT)
INTEG_CONTACT=$(create_integration "$API_ID" "$ARN_CONTACT")
upsert_route "$API_ID" "POST /web/contact"                                 NONE "$INTEG_CONTACT"
upsert_route "$API_ID" "POST /web/signup"                                  NONE "$INTEG_CONTACT"

# ─── SQS event source mapping (notification Lambda) ───────────────────────────

info "Wiring SQS event source mapping for lambda-notification..."

EXISTING_ESM=$(aws_local lambda list-event-source-mappings \
  --function-name "qulene-local-lambda-notification" \
  --query "EventSourceMappings[?EventSourceArn==\`${NOTIFICATION_QUEUE_ARN}\`].UUID" \
  --output text 2>/dev/null | head -1 || true)

if [ -n "$EXISTING_ESM" ] && [ "$EXISTING_ESM" != "None" ]; then
  mark_skipped "SQS event source mapping for lambda-notification (exists)"
else
  aws_local lambda create-event-source-mapping \
    --function-name "qulene-local-lambda-notification" \
    --event-source-arn "$NOTIFICATION_QUEUE_ARN" \
    --batch-size 1 \
    --enabled >/dev/null
  mark_created "SQS event source mapping → lambda-notification"
fi

# ─── Summary ───────────────────────────────────────────────────────────────────

echo
printf "${COLOR_INFO}══════════════════════════════════════════════════════${COLOR_RESET}\n"
printf "${COLOR_INFO}  deploy:local summary${COLOR_RESET}\n"
printf "${COLOR_INFO}══════════════════════════════════════════════════════${COLOR_RESET}\n"

if [ "${#CREATED[@]}" -gt 0 ]; then
  printf "\n${COLOR_SUCCESS}Created:${COLOR_RESET}\n"
  for item in "${CREATED[@]}"; do printf "  + %s\n" "$item"; done
fi
if [ "${#UPDATED[@]}" -gt 0 ]; then
  printf "\n${COLOR_INFO}Updated:${COLOR_RESET}\n"
  for item in "${UPDATED[@]}"; do printf "  ↺ %s\n" "$item"; done
fi
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  printf "\n${COLOR_DIM}Skipped:${COLOR_RESET}\n"
  for item in "${SKIPPED[@]}"; do printf "  · %s\n" "$item"; done
fi

printf "\n${COLOR_SUCCESS}API base URL:${COLOR_RESET} %s\n" "$API_BASE_URL"
printf "\n${COLOR_SUCCESS}Done.${COLOR_RESET}\n"
