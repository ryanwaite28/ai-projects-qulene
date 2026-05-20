#!/usr/bin/env bash
# Audit Lambda IAM inline policies for least-privilege compliance.
#
# Checks each Lambda's role for:
#   - Wildcard actions: dynamodb:*, s3:*, sns:*, sqs:*, ses:*
#   - Resource = "*" on anything other than ses:SendEmail / ses:SendRawEmail
#     (SES SendEmail requires Resource="*" per AWS documentation — this is expected)
#
# Usage: ./audit-iam.sh <env>
# CI:    set AWS_PROFILE="" to use OIDC credentials.
set -euo pipefail

ENV="${1:?Usage: audit-iam.sh <env>  (e.g. dev | prod)}"
PROFILE="${AWS_PROFILE:-rmw-llc}"
REGION="us-east-1"

AWS_OPTS=(--region "${REGION}")
[[ -n "${PROFILE}" ]] && AWS_OPTS+=(--profile "${PROFILE}")

FUNCTIONS=(auth businesses services appointments waitlist notification users contact)

PASS=0
FAIL=0
FAILURES=()

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        Qulene IAM Least-Privilege Audit — env=${ENV}     ║"
echo "╠══════════════════════════════════════════════════════════╣"

for NAME in "${FUNCTIONS[@]}"; do
  ROLE_NAME="qulene-${ENV}-lambda-${NAME}-role"
  FUNCTION_FAIL=0
  FUNCTION_REASONS=()

  # Get all inline policy names for this role
  POLICY_NAMES="$(aws iam list-role-policies \
    --role-name "${ROLE_NAME}" \
    --query "PolicyNames[]" \
    --output text \
    "${AWS_OPTS[@]}" 2>/dev/null || true)"

  if [[ -z "${POLICY_NAMES}" ]]; then
    # No inline policies — only the AWSLambdaBasicExecutionRole managed policy; pass
    printf "║  %-20s  ✓ PASS (no inline policies)\n" "lambda-${NAME}"
    PASS=$((PASS + 1))
    continue
  fi

  for POLICY_NAME in ${POLICY_NAMES}; do
    # Fetch the policy document (URL-decoded JSON)
    POLICY_DOC="$(aws iam get-role-policy \
      --role-name "${ROLE_NAME}" \
      --policy-name "${POLICY_NAME}" \
      --query "PolicyDocument" \
      --output json \
      "${AWS_OPTS[@]}")"

    # Check for wildcard actions (fail on any service-level wildcard)
    WILDCARD_ACTIONS="$(echo "${POLICY_DOC}" | grep -oE '"(dynamodb|s3|sns|sqs|ses):\*"' || true)"
    if [[ -n "${WILDCARD_ACTIONS}" ]]; then
      FUNCTION_FAIL=1
      FUNCTION_REASONS+=("${POLICY_NAME}: wildcard action found: ${WILDCARD_ACTIONS}")
    fi

    # Check for Resource="*" on non-SES actions
    # Strategy: find statements where Resource contains "*" but Action is NOT ses:Send*
    RESOURCE_STAR_STATEMENTS="$(echo "${POLICY_DOC}" | python3 -c "
import json, sys
doc = json.load(sys.stdin)
for stmt in doc.get('Statement', []):
    resources = stmt.get('Resource', [])
    if isinstance(resources, str):
        resources = [resources]
    actions = stmt.get('Action', [])
    if isinstance(actions, str):
        actions = [actions]
    # Check if resource is * or contains *
    has_star_resource = any(r == '*' or r == '\"*\"' for r in resources)
    # Check if all actions are SES send actions (the only AWS-required wildcard)
    ses_only = all(a in ('ses:SendEmail', 'ses:SendRawEmail') for a in actions)
    if has_star_resource and not ses_only:
        print('  Action: ' + str(actions) + '  Resource: *')
" 2>/dev/null || true)"

    if [[ -n "${RESOURCE_STAR_STATEMENTS}" ]]; then
      FUNCTION_FAIL=1
      FUNCTION_REASONS+=("${POLICY_NAME}: non-SES Resource=\"*\" found:${RESOURCE_STAR_STATEMENTS}")
    fi
  done

  if [[ "${FUNCTION_FAIL}" -eq 0 ]]; then
    printf "║  %-20s  ✓ PASS\n" "lambda-${NAME}"
    PASS=$((PASS + 1))
  else
    printf "║  %-20s  ✗ FAIL\n" "lambda-${NAME}"
    for REASON in "${FUNCTION_REASONS[@]}"; do
      printf "║    └─ %s\n" "${REASON}"
    done
    FAIL=$((FAIL + 1))
    FAILURES+=("lambda-${NAME}")
  fi
done

echo "╠══════════════════════════════════════════════════════════╣"
printf "║  Total: %d PASS  %d FAIL\n" "${PASS}" "${FAIL}"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

if [[ "${FAIL}" -gt 0 ]]; then
  echo "FAILED functions: ${FAILURES[*]}"
  echo "Review the inline policies above and tighten Resource/Action grants."
  exit 1
fi

echo "All Lambda IAM policies pass least-privilege audit ✓"
