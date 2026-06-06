#!/usr/bin/env bash
# Deploy the Qulene marketing SPA to S3 + invalidate CloudFront.
# Usage: ./deploy-marketing.sh <env>
# CI: set AWS_PROFILE="" to use OIDC credentials instead of a named profile.
set -euo pipefail

ENV="${1:?Usage: deploy-marketing.sh <env>  (e.g. dev | prod)}"
PROFILE="${AWS_PROFILE-rmw-llc}"
unset AWS_PROFILE   # prevent the CLI from auto-reading a stale/empty env var
REGION="us-east-1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
MARKETING_DIR="${REPO_ROOT}/apps/marketing"
DIST_DIR="${MARKETING_DIR}/dist/marketing/browser"
BUCKET="qulene-${ENV}-frontend"

echo "==> [deploy-marketing] env=${ENV} bucket=${BUCKET}"

echo "==> Building marketing SPA (production)..."
(cd "${MARKETING_DIR}" && npx ng build --configuration production)

echo "==> Reading CloudFront distribution ID from SSM..."
DIST_ID="$(aws ssm get-parameter \
  --name "/qulene/${ENV}/marketing_cloudfront_distribution_id" \
  --query "Parameter.Value" \
  --output text \
  --region "${REGION}" \
  ${PROFILE:+--profile "${PROFILE}"})"

echo "==> Syncing ${DIST_DIR}/ → s3://${BUCKET}/..."
aws s3 sync "${DIST_DIR}/" "s3://${BUCKET}/" \
  --delete \
  --region "${REGION}" \
  ${PROFILE:+--profile "${PROFILE}"}

echo "==> Creating CloudFront invalidation for distribution ${DIST_ID}..."
aws cloudfront create-invalidation \
  --distribution-id "${DIST_ID}" \
  --paths "/*" \
  ${PROFILE:+--profile "${PROFILE}"}

echo "==> Deploy complete."
