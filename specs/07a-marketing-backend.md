## Spec: Phase 7a — Backend web/contact + web/signup endpoints
**FR references**: FR-MKT-03, FR-MKT-05
**Status**: ✅ Implemented
**Prerequisites**: 0c ✅
**Size check**: 9 files · 2 service functions · 1 layer · 2 routes · single-session safe ✅

### What
Public (no-auth) `POST /web/contact` and `POST /web/signup` endpoints for the marketing SPA. `web/contact` sends the submission to the admin email via SES. `web/signup` upserts the visitor's email into `qulene-{env}-web-signups` DynamoDB table. Both routes have `authorization_type = "NONE"` in API Gateway.

### Why
FR-MKT-03 (waitlist signup → `web-signups` table) and FR-MKT-05 (contact form + signup → `lambda-contact`). Required before Phase 7c (Angular forms).

### New / Modified Files
- `backend/src/db/tables/web-signups.table.ts` — new; `putSignup(dynamo, email)` (PutItem, idempotent by email PK)
- `backend/src/services/contact.service.ts` — new; `submitContact(ses, {name, email, message})`, `signupForWaitlist(dynamo, email)`
- `backend/src/handlers/contact.handler.ts` — new; routes `POST /web/contact`, `POST /web/signup`, no auth
- `infra/terraform/modules/dynamodb-web-signups/main.tf` — new; `qulene-{env}-web-signups` (PK: email)
- `infra/terraform/modules/lambda-contact/main.tf` — new; 128 MB / 10s, IAM `dynamodb:PutItem` + `ses:SendEmail`
- `infra/terraform/envs/dev/main.tf` — modified; Phase 7a block with 2 modules + permission + integration + 2 NONE-auth routes
- `infra/terraform/envs/dev/variables.tf` — modified; added `admin_email` variable (default `ryanwaite28@gmail.com`)
- `backend/esbuild.config.ts` — modified; added `contact` entry
- `backend/vitest.config.ts` — modified; added `WEB_SIGNUPS_TABLE` + `ADMIN_EMAIL` env vars

### Behavior
**`submitContact(ses, { name, email, message })`**: Sends HTML email to `ADMIN_EMAIL` with escaped name/email/message. Re-throws SES errors (handler catches → 500).

**`signupForWaitlist(dynamo, email)`**: PutItem to `WEB_SIGNUPS_TABLE` with `{ email, createdAt }`. Idempotent — same email overwrites `createdAt`. Returns `{ email }`.

**Handler `POST /web/contact`**: validates name (non-empty, ≤100), email (contains @), message (non-empty, ≤2000). Calls `submitContact`. Returns `{ data: { ok: true } }`.

**Handler `POST /web/signup`**: validates email (contains @). Calls `signupForWaitlist`. Returns `{ data: { email } }`.

### Done When
- [x] `POST /web/contact` returns 200 for valid payload; SES call made
- [x] `POST /web/signup` returns 200; row written to `web-signups`; idempotent on re-submit
- [x] 400 returned for missing/malformed fields on both routes
- [x] 5 unit tests pass (contact.service.test.ts)
- [x] 9 integration tests pass (contact.handler.test.ts)
- [x] `dist/lambdas/contact/index.zip` present
- [x] API Gateway routes added with `authorization_type = "NONE"`
- [x] `npx tsc --noEmit` clean
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
