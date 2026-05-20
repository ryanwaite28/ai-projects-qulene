#!/usr/bin/env bash
# Populate qulene-{env}-secrets in Secrets Manager after terraform apply.
# Reads the SNS topic ARN from terraform output and Cognito IDs from SSM,
# then writes the complete runtime secret JSON in one atomic put-secret-value.
#
# Usage: ./post-apply-secrets.sh <env>
# CI:    set AWS_PROFILE="" to use OIDC credentials instead of a named profile.
set -euo pipefail

ENV="${1:?Usage: post-apply-secrets.sh <env>  (e.g. dev | prod)}"
PROFILE="${AWS_PROFILE:-rmw-llc}"
REGION="us-east-1"
SECRET_NAME="qulene-${ENV}-secrets"
ADMIN_EMAIL="${ADMIN_EMAIL:-ryanwaite28@gmail.com}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TF_DIR="${REPO_ROOT}/infra/terraform/envs/${ENV}"

AWS_OPTS=(--region "${REGION}")
[[ -n "${PROFILE}" ]] && AWS_OPTS+=(--profile "${PROFILE}")

echo "==> [post-apply-secrets] env=${ENV} secret=${SECRET_NAME}"

echo "==> Reading SNS topic ARN from terraform output..."
SNS_TOPIC_ARN="$(terraform -chdir="${TF_DIR}" output -raw sns_events_topic_arn)"
[[ -n "${SNS_TOPIC_ARN}" ]] || { echo "ERROR: sns_events_topic_arn output is empty"; exit 1; }

echo "==> Reading Cognito User Pool ID from SSM..."
COGNITO_USER_POOL_ID="$(aws ssm get-parameter \
  --name "/qulene/${ENV}/cognito_user_pool_id" \
  --query "Parameter.Value" \
  --output text \
  "${AWS_OPTS[@]}")"
[[ -n "${COGNITO_USER_POOL_ID}" ]] || { echo "ERROR: /qulene/${ENV}/cognito_user_pool_id is empty or missing"; exit 1; }

echo "==> Reading Cognito App Client ID from SSM..."
COGNITO_APP_CLIENT_ID="$(aws ssm get-parameter \
  --name "/qulene/${ENV}/cognito_app_client_id" \
  --query "Parameter.Value" \
  --output text \
  "${AWS_OPTS[@]}")"
[[ -n "${COGNITO_APP_CLIENT_ID}" ]] || { echo "ERROR: /qulene/${ENV}/cognito_app_client_id is empty or missing"; exit 1; }

SECRET_JSON="$(cat <<JSON
{
  "SNS_TOPIC_ARN": "${SNS_TOPIC_ARN}",
  "SES_FROM_EMAIL": "no-reply@qulene.com",
  "ADMIN_EMAIL": "${ADMIN_EMAIL}",
  "COGNITO_USER_POOL_ID": "${COGNITO_USER_POOL_ID}",
  "COGNITO_APP_CLIENT_ID": "${COGNITO_APP_CLIENT_ID}"
}
JSON
)"

echo "==> Writing secret to ${SECRET_NAME}..."
aws secretsmanager put-secret-value \
  --secret-id "${SECRET_NAME}" \
  --secret-string "${SECRET_JSON}" \
  "${AWS_OPTS[@]}"

echo "==> Done. Verify with:"
echo "    aws secretsmanager get-secret-value --secret-id ${SECRET_NAME} --query SecretString --output text ${PROFILE:+--profile ${PROFILE}}"
