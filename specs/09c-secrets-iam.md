## Spec: Phase 9c — Secrets Manager + IAM least-privilege audit
**FR references**: NFR-07 (security)
**Status**: ✅ Implemented
**Prerequisites**: 5a ✅, 1b ✅
**Size check**: 2 files · 0 service functions · 1 layer (Terraform + audit script) · fits one session ✅

### What
Finalize `qulene-{env}-secrets` with all runtime keys, audit every Lambda's IAM role against PROJECT.md Section 5.8 to confirm least-privilege, and remove any wildcard `*` grants discovered in the audit.

### Why
NFR-07 + CLAUDE.md Code Standards (no secrets in code; IAM least-privilege per Lambda): a portfolio-grade project must not ship with overprivileged Lambdas or env-var-leaked secrets.

### New / Modified Files
- `infra/scripts/audit-iam.sh` — reads each Lambda's policy from AWS via `aws iam get-role-policy`, parses, asserts every policy statement's Resource list is restricted to the named tables/topics/queues from Section 5.8; outputs a pass/fail report
- modify each `infra/terraform/modules/lambda*/main.tf` — replace any `Resource = "*"` with specific ARN references; replace any `Action = "dynamodb:*"` with explicit action lists per Section 5.8

### Behavior
**Secrets finalization**: post-Terraform-apply step writes the complete JSON to `qulene-{env}-secrets`:
```json
{
  "SNS_TOPIC_ARN": "<from terraform output>",
  "SES_FROM_EMAIL": "no-reply@qulene.com",
  "ADMIN_EMAIL": "admin@qulene.com",
  "COGNITO_USER_POOL_ID": "<from output>",
  "COGNITO_APP_CLIENT_ID": "<from output>"
}
```
Each Lambda reads the secret at cold start via `GetSecretValue` and caches the parsed values for its lifetime. CLAUDE.md rule: secrets never pass through Terraform outputs or env vars directly.

**IAM audit** (per Section 5.8 — quoting verbatim for the spec):

| Lambda | Required permissions |
| --- | --- |
| lambda-auth | `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem` on `users` table |
| lambda-users | `dynamodb:GetItem`, `dynamodb:UpdateItem`, `dynamodb:Query` on `users` + `notifications`; `s3:PutObject` on media bucket |
| lambda-businesses | `dynamodb:*` on `business-profiles` + `availability-windows`; `s3:PutObject` on media bucket — replace `*` with explicit `GetItem`, `PutItem`, `UpdateItem`, `Query`, `Scan` |
| lambda-services | `dynamodb:*` on `services` — replace with `GetItem`, `PutItem`, `UpdateItem`, `Query`; `sns:Publish` on events topic |
| lambda-appointments | `dynamodb:*` on `appointment-requests` + `notifications` + `users` (for counter increments) — replace; `sns:Publish` on events topic |
| lambda-waitlist | same shape on `waitlist-entries` + `notifications` + `users`; `sns:Publish` |
| lambda-notification | `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` on notification queue; `ses:SendEmail`; `dynamodb:GetItem` on multiple read tables; `dynamodb:UpdateItem` on appointment-requests for the SERVICE_REMOVED cascade |
| lambda-contact | `dynamodb:PutItem`, `dynamodb:GetItem` on web-signups; `ses:SendEmail` |

Audit script confirms each role's policy matches this matrix exactly.

### Done When
- [x] `qulene-{env}-secrets` contains all required keys
- [x] All Lambda IAM roles match Section 5.8 with no wildcards beyond what's listed
- [x] `audit-iam.sh dev` exits 0
- [x] No secrets in `process.env.*` (all reads via `getSecretValue`)
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
