#!/usr/bin/env bash
# Deploy the Qulene Angular web app to S3 + invalidate CloudFront.
# Usage: ./deploy-web-app.sh <env>
# Locally: set AWS_PROFILE=rmw-llc in your shell before running.
# CI: OIDC credentials are already in the environment — no profile needed.
set -euo pipefail

ENV="${1:?Usage: deploy-web-app.sh <env>  (e.g. dev | prod)}"
REGION="us-east-1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APP_DIR="${REPO_ROOT}/apps/web-app"
DIST_DIR="${APP_DIR}/dist/web-app/browser"
BUCKET="qulene-${ENV}-app"

# prod → --configuration production; dev → --configuration development
BUILD_CONFIG="$([ "${ENV}" = "prod" ] && echo "production" || echo "development")"

echo "==> [deploy-web-app] env=${ENV} bucket=${BUCKET} config=${BUILD_CONFIG}"

echo "==> Building web app (${BUILD_CONFIG})..."
(cd "${APP_DIR}" && npx ng build --configuration "${BUILD_CONFIG}")

echo "==> Reading CloudFront distribution ID from SSM..."
DIST_ID="$(aws ssm get-parameter \
  --name "/qulene/${ENV}/webapp_cloudfront_distribution_id" \
  --query "Parameter.Value" \
  --output text \
  --region "${REGION}")"

echo "==> Syncing ${DIST_DIR}/ → s3://${BUCKET}/..."
aws s3 sync "${DIST_DIR}/" "s3://${BUCKET}/" \
  --delete \
  --region "${REGION}"

echo "==> Creating CloudFront invalidation for distribution ${DIST_ID}..."
aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*"

echo "==> Deploy complete."
