#!/usr/bin/env bash
###############################################################################
# post-apply-cognito.sh
#
# Run after `terraform apply` to write Cognito pool/client IDs to SSM.
# These SSM params are consumed by Phase 1c (mobile) and Phase 8a (web app)
# without hardcoding the values.
#
# Usage:
#   ./infra/scripts/post-apply-cognito.sh [env] [aws-profile]
#   ./infra/scripts/post-apply-cognito.sh dev rmw-llc    # local
#   TF_VAR_aws_profile="" ./infra/scripts/post-apply-cognito.sh dev  # CI
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV="${1:-dev}"
AWS_PROFILE="${2:-}"
REGION="us-east-1"
TF_DIR="${SCRIPT_DIR}/../terraform/envs/${ENV}"

cd "${TF_DIR}"

echo "[info] Reading Terraform outputs for environment: ${ENV}"

USER_POOL_ID=$(terraform output -raw cognito_user_pool_id)
APP_CLIENT_ID=$(terraform output -raw cognito_app_client_id)

if [[ -z "${USER_POOL_ID}" || -z "${APP_CLIENT_ID}" ]]; then
  echo "[error] Terraform outputs cognito_user_pool_id or cognito_app_client_id are empty"
  exit 1
fi

PROFILE_ARGS=()
if [[ -n "${AWS_PROFILE}" ]]; then
  PROFILE_ARGS=(--profile "${AWS_PROFILE}")
fi

aws ssm put-parameter \
  "${PROFILE_ARGS[@]}" \
  --region "${REGION}" \
  --name "/qulene/${ENV}/cognito_user_pool_id" \
  --type String \
  --value "${USER_POOL_ID}" \
  --overwrite

aws ssm put-parameter \
  "${PROFILE_ARGS[@]}" \
  --region "${REGION}" \
  --name "/qulene/${ENV}/cognito_app_client_id" \
  --type String \
  --value "${APP_CLIENT_ID}" \
  --overwrite

echo "[ok]   SSM updated for environment: ${ENV}"
echo "       /qulene/${ENV}/cognito_user_pool_id  = ${USER_POOL_ID}"
echo "       /qulene/${ENV}/cognito_app_client_id = ${APP_CLIENT_ID}"
