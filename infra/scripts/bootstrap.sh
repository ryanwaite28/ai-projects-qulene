#!/usr/bin/env bash
#
# Qulene infrastructure bootstrap script
#
# Modes:
#   ./bootstrap.sh           Production AWS (default) — uses rmw-llc profile
#   ./bootstrap.sh --local   Local MiniStack — provisions queues, topics, secrets at localhost:4566
#
# This script is idempotent — every operation checks before creating.
# See PROJECT.md Section 9.4 and CLAUDE.md "Bootstrap & Pre-Implementation".

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

AWS_PROFILE="rmw-llc"
AWS_REGION="us-east-1"
GITHUB_ORG="ryanwaite28"
GITHUB_REPO="ryanwaite28/qulene"
CI_ROLE_NAME="GitHubActionsDevOpsDeployRole"
SES_DOMAIN="qulene.com"
SES_SENDER="no-reply@qulene.com"
ENVS=("dev" "prod")
MINISTACK_ENDPOINT="${MINISTACK_ENDPOINT:-http://localhost:4566}"
MINISTACK_ACCOUNT="000000000000"

LOCAL_SNS_TOPIC="qulene-local-events"
LOCAL_NOTIFICATION_QUEUE="qulene-local-notifications"
LOCAL_NOTIFICATION_DLQ="qulene-local-notifications-dlq"
LOCAL_MEDIA_BUCKET="qulene-local-media"
LOCAL_SECRETS_NAME="qulene-dev-secrets"

# ─────────────────────────────────────────────────────────────────────────────
# Output helpers
# ─────────────────────────────────────────────────────────────────────────────

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
dim()     { printf "${COLOR_DIM}%s${COLOR_RESET}\n" "$*"; }

# Track outcome counts
CREATED=()
SKIPPED=()
MANUAL_STEPS=()

# ─────────────────────────────────────────────────────────────────────────────
# Mode parsing
# ─────────────────────────────────────────────────────────────────────────────

MODE="prod"
for arg in "$@"; do
  case "$arg" in
    --local) MODE="local" ;;
    --help|-h) cat <<EOF
Usage: $0 [--local]

  --local    Provision MiniStack resources at \$MINISTACK_ENDPOINT (default: $MINISTACK_ENDPOINT)
  (default)  Provision AWS resources via \$AWS_PROFILE ($AWS_PROFILE) in \$AWS_REGION ($AWS_REGION)

This script is idempotent — re-running it is safe.
EOF
      exit 0
      ;;
    *) error "Unknown argument: $arg"; exit 2 ;;
  esac
done

# ─────────────────────────────────────────────────────────────────────────────
# Common helpers
# ─────────────────────────────────────────────────────────────────────────────

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { error "Required command not found: $1"; exit 1; }
}

aws_local() {
  aws --endpoint-url="$MINISTACK_ENDPOINT" --region "$AWS_REGION" "$@"
}

aws_prod() {
  aws --profile "$AWS_PROFILE" --region "$AWS_REGION" "$@"
}

mark_created() { CREATED+=("$1"); }
mark_skipped() { SKIPPED+=("$1"); }

# ─────────────────────────────────────────────────────────────────────────────
# LOCAL MODE — MiniStack
# ─────────────────────────────────────────────────────────────────────────────

bootstrap_local() {
  info "Bootstrap mode: LOCAL (MiniStack at $MINISTACK_ENDPOINT)"
  require_cmd aws
  require_cmd curl
  require_cmd jq

  # Health check
  info "Checking MiniStack health..."
  if ! curl -fsS "$MINISTACK_ENDPOINT/_ministack/health" >/dev/null 2>&1; then
    error "MiniStack is not reachable at $MINISTACK_ENDPOINT"
    error "Start it with: docker-compose up -d"
    exit 1
  fi
  success "MiniStack is healthy"

  # MiniStack accepts any credentials; export dummies if not set
  export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-test}"
  export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-test}"
  export AWS_DEFAULT_REGION="$AWS_REGION"

  # SNS topic
  info "Provisioning SNS topic: $LOCAL_SNS_TOPIC"
  if aws_local sns list-topics --output json | jq -e ".Topics[] | select(.TopicArn | endswith(\":$LOCAL_SNS_TOPIC\"))" >/dev/null; then
    mark_skipped "SNS topic $LOCAL_SNS_TOPIC (exists)"
  else
    aws_local sns create-topic --name "$LOCAL_SNS_TOPIC" >/dev/null
    mark_created "SNS topic $LOCAL_SNS_TOPIC"
  fi
  TOPIC_ARN="arn:aws:sns:${AWS_REGION}:${MINISTACK_ACCOUNT}:${LOCAL_SNS_TOPIC}"

  # SQS DLQ first
  info "Provisioning SQS DLQ: $LOCAL_NOTIFICATION_DLQ"
  DLQ_URL=$(aws_local sqs get-queue-url --queue-name "$LOCAL_NOTIFICATION_DLQ" --output text 2>/dev/null || true)
  if [ -n "$DLQ_URL" ]; then
    mark_skipped "SQS DLQ $LOCAL_NOTIFICATION_DLQ (exists)"
  else
    aws_local sqs create-queue --queue-name "$LOCAL_NOTIFICATION_DLQ" >/dev/null
    DLQ_URL=$(aws_local sqs get-queue-url --queue-name "$LOCAL_NOTIFICATION_DLQ" --output text)
    mark_created "SQS DLQ $LOCAL_NOTIFICATION_DLQ"
  fi
  DLQ_ARN="arn:aws:sqs:${AWS_REGION}:${MINISTACK_ACCOUNT}:${LOCAL_NOTIFICATION_DLQ}"

  # SQS notification queue with redrive
  info "Provisioning SQS queue: $LOCAL_NOTIFICATION_QUEUE"
  QUEUE_URL=$(aws_local sqs get-queue-url --queue-name "$LOCAL_NOTIFICATION_QUEUE" --output text 2>/dev/null || true)
  if [ -n "$QUEUE_URL" ]; then
    mark_skipped "SQS queue $LOCAL_NOTIFICATION_QUEUE (exists)"
  else
    REDRIVE_JSON=$(jq -n --arg dlq "$DLQ_ARN" '{deadLetterTargetArn:$dlq,maxReceiveCount:"3"}')
    aws_local sqs create-queue \
      --queue-name "$LOCAL_NOTIFICATION_QUEUE" \
      --attributes "{\"RedrivePolicy\":$(echo "$REDRIVE_JSON" | jq -Rs .),\"VisibilityTimeout\":\"120\"}" >/dev/null
    QUEUE_URL=$(aws_local sqs get-queue-url --queue-name "$LOCAL_NOTIFICATION_QUEUE" --output text)
    mark_created "SQS queue $LOCAL_NOTIFICATION_QUEUE (redrive to DLQ, maxReceive=3)"
  fi
  QUEUE_ARN="arn:aws:sqs:${AWS_REGION}:${MINISTACK_ACCOUNT}:${LOCAL_NOTIFICATION_QUEUE}"

  # SNS → SQS subscription
  info "Subscribing SQS queue to SNS topic"
  EXISTING_SUB=$(aws_local sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" --output json \
    | jq -r --arg q "$QUEUE_ARN" '.Subscriptions[] | select(.Endpoint == $q) | .SubscriptionArn' \
    || true)
  if [ -n "$EXISTING_SUB" ] && [ "$EXISTING_SUB" != "PendingConfirmation" ]; then
    mark_skipped "SNS→SQS subscription (exists)"
  else
    aws_local sns subscribe \
      --topic-arn "$TOPIC_ARN" \
      --protocol sqs \
      --notification-endpoint "$QUEUE_ARN" >/dev/null
    mark_created "SNS→SQS subscription ($LOCAL_SNS_TOPIC → $LOCAL_NOTIFICATION_QUEUE)"
  fi

  # S3 media bucket
  info "Provisioning S3 bucket: $LOCAL_MEDIA_BUCKET"
  if aws_local s3api head-bucket --bucket "$LOCAL_MEDIA_BUCKET" 2>/dev/null; then
    mark_skipped "S3 bucket $LOCAL_MEDIA_BUCKET (exists)"
  else
    aws_local s3 mb "s3://$LOCAL_MEDIA_BUCKET" >/dev/null
    mark_created "S3 bucket $LOCAL_MEDIA_BUCKET"
  fi

  # Secrets Manager stub for dev
  info "Provisioning Secrets Manager: $LOCAL_SECRETS_NAME"
  SECRET_VALUE=$(jq -nc \
    --arg sns "$TOPIC_ARN" \
    --arg ses "$SES_SENDER" \
    '{SNS_TOPIC_ARN:$sns,SES_FROM_EMAIL:$ses}')
  if aws_local secretsmanager describe-secret --secret-id "$LOCAL_SECRETS_NAME" >/dev/null 2>&1; then
    aws_local secretsmanager put-secret-value \
      --secret-id "$LOCAL_SECRETS_NAME" \
      --secret-string "$SECRET_VALUE" >/dev/null
    mark_skipped "Secrets Manager $LOCAL_SECRETS_NAME (existed; updated value)"
  else
    aws_local secretsmanager create-secret \
      --name "$LOCAL_SECRETS_NAME" \
      --secret-string "$SECRET_VALUE" >/dev/null
    mark_created "Secrets Manager $LOCAL_SECRETS_NAME"
  fi

  # SES email identity
  info "Provisioning SES email identity: $SES_SENDER"
  if aws_local ses list-identities --output json 2>/dev/null | jq -e --arg i "$SES_SENDER" '.Identities[] | select(. == $i)' >/dev/null; then
    mark_skipped "SES identity $SES_SENDER (exists)"
  else
    aws_local ses verify-email-identity --email-address "$SES_SENDER" >/dev/null
    mark_created "SES identity $SES_SENDER"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# PRODUCTION MODE — AWS
# ─────────────────────────────────────────────────────────────────────────────

bootstrap_prod() {
  info "Bootstrap mode: PRODUCTION (AWS profile $AWS_PROFILE, region $AWS_REGION)"
  require_cmd aws
  require_cmd jq

  # ── Verify pre-provisioned shared infra (Section 9.3) ──
  verify_pre_provisioned

  # ── Per-environment provisioning ──
  for ENV in "${ENVS[@]}"; do
    info "─── Environment: $ENV ───"
    provision_state_bucket "$ENV"
    provision_state_lock_table "$ENV"
    provision_lambda_packages_bucket "$ENV"
    write_ssm_params "$ENV"
    provision_secrets_manager "$ENV"
  done

  # ── GitHub setup ──
  setup_github_secrets_and_envs
}

verify_pre_provisioned() {
  info "Verifying pre-provisioned shared infrastructure..."

  # Route 53 hosted zone
  HZ_ID=$(aws_prod route53 list-hosted-zones-by-name --dns-name "${SES_DOMAIN}." --output json \
    | jq -r ".HostedZones[] | select(.Name == \"${SES_DOMAIN}.\") | .Id" \
    | head -1 | sed 's|/hostedzone/||')
  if [ -z "$HZ_ID" ]; then
    error "Route 53 hosted zone for $SES_DOMAIN not found. This must be pre-provisioned."
    exit 1
  fi
  success "Route 53 hosted zone: $HZ_ID"
  HOSTED_ZONE_ID="$HZ_ID"

  # ACM certs per env
  for ENV in "${ENVS[@]}"; do
    CERT_ARN=$(aws_prod acm list-certificates --certificate-statuses ISSUED --output json \
      | jq -r --arg dom "*.${SES_DOMAIN}" --arg env "$ENV" \
        ".CertificateSummaryList[] | select(.DomainName == \$dom) | .CertificateArn" \
      | head -1)
    if [ -z "$CERT_ARN" ]; then
      warn "ACM cert *.${SES_DOMAIN} not found in $ENV — pre-provisioning required"
    else
      success "ACM cert ($ENV): $CERT_ARN"
      eval "CERT_ARN_${ENV}=$CERT_ARN"
    fi
  done

  # SES identities
  SES_DOMAIN_VERIFIED=$(aws_prod ses get-identity-verification-attributes \
    --identities "$SES_DOMAIN" --output json \
    | jq -r ".VerificationAttributes.\"$SES_DOMAIN\".VerificationStatus // empty")
  if [ "$SES_DOMAIN_VERIFIED" = "Success" ]; then
    success "SES domain identity: $SES_DOMAIN (verified)"
  else
    warn "SES domain $SES_DOMAIN not verified — pre-provisioning required"
  fi

  SES_EMAIL_VERIFIED=$(aws_prod ses get-identity-verification-attributes \
    --identities "$SES_SENDER" --output json \
    | jq -r ".VerificationAttributes.\"$SES_SENDER\".VerificationStatus // empty")
  if [ "$SES_EMAIL_VERIFIED" = "Success" ]; then
    success "SES email identity: $SES_SENDER (verified)"
  else
    warn "SES email $SES_SENDER not verified — pre-provisioning required"
  fi

  # IAM role
  if aws_prod iam get-role --role-name "$CI_ROLE_NAME" >/dev/null 2>&1; then
    CI_ROLE_ARN=$(aws_prod iam get-role --role-name "$CI_ROLE_NAME" --query 'Role.Arn' --output text)
    success "IAM role $CI_ROLE_NAME: $CI_ROLE_ARN"
  else
    error "IAM role $CI_ROLE_NAME not found — this shared role must be pre-provisioned"
    exit 1
  fi
}

provision_state_bucket() {
  local env="$1"
  local bucket="qulene-${env}-tf-state"
  info "Provisioning Terraform state bucket: $bucket"
  if aws_prod s3api head-bucket --bucket "$bucket" 2>/dev/null; then
    mark_skipped "S3 $bucket (exists)"
    return
  fi
  aws_prod s3api create-bucket --bucket "$bucket" --region "$AWS_REGION" \
    $([ "$AWS_REGION" = "us-east-1" ] || echo "--create-bucket-configuration LocationConstraint=$AWS_REGION") >/dev/null
  aws_prod s3api put-bucket-versioning --bucket "$bucket" \
    --versioning-configuration Status=Enabled >/dev/null
  aws_prod s3api put-bucket-encryption --bucket "$bucket" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' >/dev/null
  aws_prod s3api put-public-access-block --bucket "$bucket" \
    --public-access-block-configuration '{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}' >/dev/null
  aws_prod s3api put-bucket-tagging --bucket "$bucket" \
    --tagging "TagSet=[{Key=Project,Value=qulene},{Key=Environment,Value=$env},{Key=ManagedBy,Value=bootstrap}]" >/dev/null
  mark_created "S3 $bucket (versioned, encrypted, public-access-blocked)"
}

provision_state_lock_table() {
  local env="$1"
  local table="qulene-${env}-tf-locks"
  info "Provisioning Terraform lock table: $table"
  if aws_prod dynamodb describe-table --table-name "$table" >/dev/null 2>&1; then
    mark_skipped "DynamoDB $table (exists)"
    return
  fi
  aws_prod dynamodb create-table \
    --table-name "$table" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --tags "Key=Project,Value=qulene" "Key=Environment,Value=$env" "Key=ManagedBy,Value=bootstrap" \
    >/dev/null
  mark_created "DynamoDB $table (PAY_PER_REQUEST)"
}

provision_lambda_packages_bucket() {
  local env="$1"
  local bucket="qulene-${env}-lambda-packages"
  info "Provisioning Lambda packages bucket: $bucket"
  if aws_prod s3api head-bucket --bucket "$bucket" 2>/dev/null; then
    mark_skipped "S3 $bucket (exists)"
    return
  fi
  aws_prod s3api create-bucket --bucket "$bucket" --region "$AWS_REGION" \
    $([ "$AWS_REGION" = "us-east-1" ] || echo "--create-bucket-configuration LocationConstraint=$AWS_REGION") >/dev/null
  aws_prod s3api put-bucket-versioning --bucket "$bucket" \
    --versioning-configuration Status=Enabled >/dev/null
  aws_prod s3api put-bucket-encryption --bucket "$bucket" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' >/dev/null
  aws_prod s3api put-bucket-tagging --bucket "$bucket" \
    --tagging "TagSet=[{Key=Project,Value=qulene},{Key=Environment,Value=$env},{Key=ManagedBy,Value=bootstrap}]" >/dev/null
  mark_created "S3 $bucket (versioned, encrypted)"
}

write_ssm_params() {
  local env="$1"
  info "Writing SSM parameters for $env"

  put_ssm "/qulene/hosted_zone_id" "$HOSTED_ZONE_ID"
  local cert_var="CERT_ARN_${env}"
  local cert_val="${!cert_var:-}"
  if [ -n "$cert_val" ]; then
    put_ssm "/qulene/${env}/acm_certificate_arn" "$cert_val"
  else
    warn "Skipping /qulene/${env}/acm_certificate_arn — cert ARN not discovered"
  fi
}

put_ssm() {
  local key="$1" val="$2"
  local existing
  existing=$(aws_prod ssm get-parameter --name "$key" --output json 2>/dev/null \
    | jq -r '.Parameter.Value // empty' || true)
  if [ "$existing" = "$val" ]; then
    mark_skipped "SSM $key (unchanged)"
    return
  fi
  aws_prod ssm put-parameter --name "$key" --value "$val" --type String --overwrite >/dev/null
  mark_created "SSM $key"
}

provision_secrets_manager() {
  local env="$1"
  local secret="qulene-${env}-secrets"
  info "Provisioning Secrets Manager: $secret"
  local body
  body=$(jq -nc --arg ses "$SES_SENDER" '{SNS_TOPIC_ARN:"PLACEHOLDER",SES_FROM_EMAIL:$ses}')
  if aws_prod secretsmanager describe-secret --secret-id "$secret" >/dev/null 2>&1; then
    mark_skipped "Secrets Manager $secret (exists — not overwriting; Terraform/9c update keys)"
    return
  fi
  aws_prod secretsmanager create-secret --name "$secret" --secret-string "$body" \
    --tags "Key=Project,Value=qulene" "Key=Environment,Value=$env" "Key=ManagedBy,Value=bootstrap" \
    >/dev/null
  mark_created "Secrets Manager $secret"
}

setup_github_secrets_and_envs() {
  info "Configuring GitHub repo secrets + environments..."
  if ! command -v gh >/dev/null 2>&1; then
    warn "gh CLI not installed — skipping GitHub setup"
    MANUAL_STEPS+=("Install gh CLI and run: gh auth login")
    MANUAL_STEPS+=("gh secret set AWS_ROLE_ARN -b \"$CI_ROLE_ARN\" -R $GITHUB_REPO")
    MANUAL_STEPS+=("gh secret set AWS_REGION -b \"$AWS_REGION\" -R $GITHUB_REPO")
    MANUAL_STEPS+=("Create environments 'dev', 'prod', 'prod-approval' in repo Settings → Environments")
    return
  fi
  if ! gh auth status >/dev/null 2>&1; then
    warn "gh CLI present but not authenticated — skipping GitHub setup"
    MANUAL_STEPS+=("Run: gh auth login")
    return
  fi

  if gh secret list -R "$GITHUB_REPO" 2>/dev/null | grep -q "^AWS_ROLE_ARN"; then
    mark_skipped "GitHub secret AWS_ROLE_ARN (exists)"
  else
    echo "$CI_ROLE_ARN" | gh secret set AWS_ROLE_ARN -R "$GITHUB_REPO" --body - >/dev/null
    mark_created "GitHub secret AWS_ROLE_ARN"
  fi
  if gh secret list -R "$GITHUB_REPO" 2>/dev/null | grep -q "^AWS_REGION"; then
    mark_skipped "GitHub secret AWS_REGION (exists)"
  else
    echo "$AWS_REGION" | gh secret set AWS_REGION -R "$GITHUB_REPO" --body - >/dev/null
    mark_created "GitHub secret AWS_REGION"
  fi

  # Environments — gh doesn't have a first-class env command for create-only; use API
  for env_name in dev prod prod-approval; do
    if gh api "repos/$GITHUB_REPO/environments/$env_name" >/dev/null 2>&1; then
      mark_skipped "GitHub environment $env_name (exists)"
    else
      gh api "repos/$GITHUB_REPO/environments/$env_name" -X PUT >/dev/null 2>&1 \
        && mark_created "GitHub environment $env_name" \
        || warn "Could not create GitHub environment $env_name (permissions?)"
    fi
  done

  MANUAL_STEPS+=("In GitHub: Repo → Settings → Environments → prod-approval → add required reviewers")
}

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

print_summary() {
  echo
  printf "${COLOR_INFO}══════════════════════════════════════════════════════${COLOR_RESET}\n"
  printf "${COLOR_INFO}  Bootstrap summary (mode: ${MODE})${COLOR_RESET}\n"
  printf "${COLOR_INFO}══════════════════════════════════════════════════════${COLOR_RESET}\n"

  if [ "${#CREATED[@]}" -gt 0 ]; then
    printf "\n${COLOR_SUCCESS}Created:${COLOR_RESET}\n"
    for item in "${CREATED[@]}"; do printf "  + %s\n" "$item"; done
  fi
  if [ "${#SKIPPED[@]}" -gt 0 ]; then
    printf "\n${COLOR_DIM}Skipped (already existed or unchanged):${COLOR_RESET}\n"
    for item in "${SKIPPED[@]}"; do printf "  · %s\n" "$item"; done
  fi
  if [ "${#MANUAL_STEPS[@]}" -gt 0 ]; then
    printf "\n${COLOR_WARN}Manual steps required:${COLOR_RESET}\n"
    for item in "${MANUAL_STEPS[@]}"; do printf "  → %s\n" "$item"; done
  fi

  printf "\n${COLOR_SUCCESS}Done.${COLOR_RESET}\n"
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

case "$MODE" in
  local) bootstrap_local ;;
  prod)  bootstrap_prod  ;;
esac

print_summary
