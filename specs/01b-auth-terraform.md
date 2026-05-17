## Spec: Phase 1b — Terraform Cognito + API Gateway + lambda-auth deploy
**FR references**: FR-AUTH-01, FR-AUTH-04, FR-AUTH-06, FR-AUTH-07
**Status**: ⬜ Not Started
**Prerequisites**: 0c ✅, 1a ✅
**Size check**: 7 files · 0 service functions · 1 layer (Terraform) · 6 Terraform resource groups (Cognito pool + client + users table + API GW + lambda + authorizer) — at limit ✅ · fits one session ✅

### What
Provision Cognito User Pool + App Client with the `custom:role` attribute, the `users` DynamoDB table, API Gateway v2 with the Cognito JWT authorizer, the reusable `lambda` Terraform module, and the `lambda-auth` deploy that wires `POST /auth/profile`. Write Cognito IDs back to SSM via a post-apply script so subsequent phases and clients read them without hardcoding.

### Why
PROJECT.md Section 5.4 + CLAUDE.md "Settled Decisions" mandate Cognito as the JWT issuer with `custom:role` set at registration. The User Pool must exist before any mobile/web client can register users, so this phase comes before Phase 1c.

### New / Modified Files
- `infra/terraform/modules/cognito/{main.tf,variables.tf,outputs.tf}` — User Pool (`qulene-{env}-user-pool`) with `custom:role` attribute (string, mutable=false at user-edit-time), email as alias; App Client with `ALLOW_USER_PASSWORD_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`, no client secret (mobile app cannot keep it secret)
- `infra/terraform/modules/dynamodb-users/main.tf` — `qulene-{env}-users` table (PAY_PER_REQUEST, PK: `userId`); GSI `email-index` (PK: `email`, projection: ALL)
- `infra/terraform/modules/lambda/main.tf` — reusable module: `aws_lambda_function`, IAM role, log group with 14-day retention, environment block injected from caller
- `infra/terraform/modules/api-gateway/main.tf` — API Gateway v2 HTTP API (`qulene-{env}-api`), Cognito JWT authorizer using User Pool JWKS URI, custom domain `api.{env}.qulene.com` mapped to wildcard ACM cert from SSM
- `infra/terraform/envs/dev/main.tf` (modify) — instantiate modules: cognito, dynamodb-users, lambda (for `auth` Lambda referencing `dist/lambdas/auth/`), api-gateway, integration + route for `POST /auth/profile` with authorizer
- `infra/scripts/post-apply-cognito.sh` — after `terraform apply`, reads outputs (User Pool ID + App Client ID) and writes them to SSM at `/qulene/{env}/cognito_user_pool_id` and `/qulene/{env}/cognito_app_client_id`

### Behavior
`terraform apply` from `infra/terraform/envs/dev/` provisions Cognito + the users table + API Gateway + the lambda-auth deploy. The Lambda is deployed from the bundle at `dist/lambdas/auth/index.js` produced by Phase 1a's esbuild. Environment variables on the Lambda: `USERS_TABLE`, `DYNAMODB_ENDPOINT` (empty in AWS, set to `http://localhost:4566` in local), `AWS_REGION`. The API Gateway route `POST /auth/profile` uses the Cognito JWT authorizer; unauthenticated requests return 401 without invoking the Lambda.

Post-apply script reads `terraform output -json cognito_user_pool_id` and writes the value via `aws ssm put-parameter --name /qulene/dev/cognito_user_pool_id --type String --overwrite`. Same for `cognito_app_client_id`. These are read by Phase 1c mobile setup and by Phase 8a web-app setup.

Lambda env var cross-reference (CLAUDE.md Rule 12.10): handler reads only `USERS_TABLE`, `DYNAMODB_ENDPOINT`, `AWS_REGION` → Terraform env block sets exactly those, nothing else.

### Done When
- [ ] `terraform apply` succeeds; outputs show User Pool ID + App Client ID
- [ ] `custom:role` attribute declared in User Pool schema
- [ ] App Client has `ALLOW_USER_PASSWORD_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH` flows, no client secret
- [ ] API Gateway JWT authorizer wired to `POST /auth/profile`; unauthenticated request → 401
- [ ] `dist/lambdas/auth/index.js` deployed and reachable
- [ ] Post-apply script writes `/qulene/dev/cognito_user_pool_id` + `/qulene/dev/cognito_app_client_id` to SSM
- [ ] Lambda env block exactly matches `process.env.*` reads in handler
- [ ] Spec status updated to ✅ Implemented
- [ ] `IMPLEMENTATION_PLAN.md` progress tracker updated
