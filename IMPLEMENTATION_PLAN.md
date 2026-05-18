# Qulene — Implementation Plan

> Coordination layer between `PROJECT.md` (the what/why) and `specs/` (the how).
> **The spec is authoritative for behavior; this file is authoritative for sequencing and phase status.**
> If a spec and this file disagree on what a phase covers, the spec wins; if they disagree on what is done or what comes next, this file wins.

---

## How to Use This File

At the start of **every** session, in this order:

1. **Check the Progress Tracker** below — identify the first incomplete (sub-)phase
2. **Verify prerequisites** for that phase are ✅ Complete — never start a phase whose dependencies are not done
3. **Read the governing spec** in `specs/` for the chosen phase
4. **Follow the Session Protocol** at the bottom of this file (initialize session log, acknowledge rules, report intent, wait for "Approved — proceed.")

Never start any phase whose Prerequisites column lists a phase that is not ✅ in the Progress Tracker.

---

## Phase Dependency Graph

```
Phase 0 — Monorepo Scaffold & Infra Bootstrap
  ├── 0a Root + Backend + Packages workspace          ← root of graph
  ├── 0b Frontend app stubs + Local stack (MiniStack) ← root of graph (||)
  └── 0c Terraform skeleton + CI workflow             ← root of graph (||)
        │
        ▼
Phase 1 — Cognito & Auth Flow
  ├── 1a Backend auth (service + users table + handler + esbuild)   depends: 0a
  ├── 1b Terraform Cognito + API Gateway + lambda-auth deploy        depends: 0c, 1a
  └── 1c Mobile auth (Cognito SDK + login + register)                depends: 0b, 1b
        │
        ▼
Phase 2 — Business Profile & Services
  ├── 2a Backend business profile (service + table + handler + S3 + TF) depends: 1b
  ├── 2b Backend services (service + table + handler + TF)              depends: 1b
  ├── 2c Backend availability windows (service + table + handler + TF)  depends: 1b
  ├── 2d Mobile business management (profile + services + availability) depends: 1c, 2a, 2b, 2c
  └── 2e Mobile customer browse (list businesses + business detail)     depends: 1c, 2a, 2b, 2c
        │
        ▼
Phase 3 — Appointment Requests
  ├── 3a Backend appointment tables (requests + notifications + TF)     depends: 2a, 2b
  ├── 3b Backend customer flow (create + idempotency + cancel + list)   depends: 3a
  ├── 3c Backend business actions (accept + decline + complete + noshow + list) depends: 3a, 3b
  ├── 3d Mobile customer appointment screens (request form + list)      depends: 2e, 3b
  └── 3e Mobile business incoming requests screen                       depends: 2d, 3c
        │
        ▼
Phase 4 — Waitlist
  ├── 4a Backend waitlist (service + table + handler + TF + promotion)  depends: 3c
  ├── 4b Mobile customer waitlist screens (join + my list)              depends: 2e, 4a
  └── 4c Mobile business waitlist view                                  depends: 2d, 4a
        │
        ▼
Phase 5 — Email Notifications
  ├── 5a Terraform SQS + SNS + DLQ + lambda-notification IAM            depends: 0c
  ├── 5b Email rendering (renderer + ses.client + 6 Handlebars templates) depends: 0a
  └── 5c Notification consumer (notif.service routing + handler + E2E test) depends: 3c, 4a, 5a, 5b
        │
        ▼
Phase 6 — In-App Notifications
  ├── 6a Backend notifications endpoints (list + mark read + unreadCount + TF) depends: 5c (notifications table referenced)
  └── 6b Mobile notifications screen + unread badge                     depends: 1c, 6a

Phase 7 — Marketing SPA      (can begin once 0a + 0c done; no auth dependency)
  ├── 7a Backend web/contact + web/signup endpoints + web-signups table depends: 0c
  ├── 7b Marketing Angular scaffold + routing + 3 core pages            depends: 0b
  ├── 7c Marketing remaining pages + Contact form + waitlist signup     depends: 7a, 7b
  └── 7d Marketing Terraform deploy (S3 + CloudFront + Route 53)        depends: 7b (or 7c)

Phase 8 — Angular Web Application                       (mirrors mobile; depends on Phases 1–6)
  ├── 8a Web-app scaffold + Angular config + auth.service + interceptors + guards + routing  depends: 1b
  ├── 8b Web auth + public pages (login, register, landing)             depends: 8a
  ├── 8c Web public business browsing (list + detail)                   depends: 2a, 2b, 2c, 8a
  ├── 8d1 Web customer appointments + waitlist pages                    depends: 3b, 4a, 8a
  ├── 8d2 Web customer notifications + profile pages                    depends: 6a, 8a
  ├── 8e1 Web business dashboard + profile (with avatar upload)         depends: 2a, 3c, 8a
  ├── 8e2 Web business services + availability pages                    depends: 2b, 2c, 8a
  ├── 8e3 Web business waitlist + notifications pages                   depends: 4a, 6a, 8a
  └── 8f  Web-app Terraform deploy (S3 + CloudFront + Route 53)         depends: 8a (or any later)

Phase 9 — DevOps & Hardening
  ├── 9a GitHub Actions CI/CD (ci.yml + deploy-dev.yml + deploy-prod.yml) depends: 0c
  ├── 9b CloudWatch log groups + alarms + DLQ monitoring                  depends: 5a
  └── 9c Secrets Manager population + IAM least-privilege audit           depends: 5a, 1b

Phase 10 — Polish & Portfolio Prep                       (final pass; depends on all features)
  ├── 10a Mobile + web design pass (visual consistency)                  depends: 6b, 8e3
  ├── 10b Error handling + empty states + skeletons across both clients  depends: 6b, 8e3
  └── 10c Seed script + demo data + screenshots + architecture diagram   depends: 10a, 10b
```

### Parallelism notes

- **Within Phase 0**: 0a, 0b, 0c are independent; can run in parallel
- **Within Phase 2**: 2a, 2b, 2c are independent backend tracks; 2d and 2e are independent mobile tracks once all of 2a–c are ✅
- **Within Phase 5**: 5a (Terraform) and 5b (email templates + renderer) are independent; 5c joins them
- **Within Phase 8**: 8b–8e3 can run in parallel after 8a is ✅
- **Phase 7** can run in parallel with Phases 1–6 once 0a + 0b + 0c are ✅
- **Phase 9a, 9b, 9c** can each start as soon as their named dependency completes

---

## Cross-Cutting Patterns

These patterns are defined once here. Specs **reference** them — they do not redefine them.

### Error response envelope

```json
// Success (single resource)
{ "data": { ...resource } }

// Success (list)
{ "data": [ ...resources ], "nextCursor": "base64-cursor | null" }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

HTTP status mapping:

| Code | HTTP |
| --- | --- |
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `UNPROCESSABLE` | 422 |
| `INTERNAL_ERROR` | 500 |

### Structured log format

One JSON line per service function invocation, written to CloudWatch:

```json
{ "level": "info",  "action": "createRequest",  "durationMs": 43 }
{ "level": "warn",  "action": "joinWaitlist",   "durationMs": 12, "code": "CONFLICT", "error": "Customer already on waitlist" }
{ "level": "error", "action": "promoteWaitlist","durationMs": 5,  "error": "Unexpected DynamoDB error" }
```

No `console.log` with plain strings. No silent failures.

### Service function signature convention

```typescript
export async function actionName(
  dynamo: DynamoDBDocumentClient,
  sns: SNSClient,              // or ses: SESClient, omit if no side-effect
  input: ActionNameInput
): Promise<ActionNameResult>
```

`dynamo` and `sns`/`ses` are always **explicit parameters** — never imported as singletons inside service functions. This makes unit tests trivially injectable with fakes.

### Idempotency pattern (appointment creation)

```
1. assertUuid(idempotencyKey, 'idempotencyKey')
2. existing = queryByIdempotencyKey(dynamoClient, customerId, idempotencyKey)
3. if (existing) return existing   ← SKIP all remaining steps, including SNS publish
4. validate business rules (future proposedAt, no duplicate active request for service)
5. PutItem AppointmentRequest
6. publish SNS { REQUEST_RECEIVED, appointmentRequestId }
7. return new record
```

### DynamoDB access pattern rules

- Single-item lookups → `GetItem` with PK; never scan
- List queries → `Query` against a GSI with specific PK value; never `FilterExpression` alone over a full table
- Pagination → cursor-based via `LastEvaluatedKey` / `ExclusiveStartKey`; never offset pagination
- Application-enforced uniqueness → query GSI then `PutItem`; document the race tolerance explicitly in the service function
- Counters (e.g., `unreadNotificationCount`) → atomic `UpdateItem` with `ADD #count :one`; never read-modify-write
- Soft delete → `status = 'DELETED'` / `'REMOVED'`; never physically delete items referenced by other records
- GSI projection → prefer `ALL` for GSIs used in list responses; `KEYS_ONLY` / `INCLUDE` only when used exclusively for existence checks

### SNS event envelope

All SNS events published from the service layer use this JSON body:

```typescript
{
  eventType: 'REQUEST_RECEIVED' | 'REQUEST_ACCEPTED' | 'REQUEST_DECLINED'
           | 'REQUEST_CANCELLED' | 'WAITLIST_PROMOTED' | 'SERVICE_REMOVED',
  payload: {
    // event-specific IDs needed by the notification Lambda to fetch full records
    // e.g., { appointmentRequestId: string }
    //        { waitlistEntryId: string }
    //        { serviceId: string, affectedUserIds: string[] }
  }
}
```

The notification Lambda:
1. Parses `Records[0].body` → SNS envelope → `envelope.Message` → inner `{ eventType, payload }`
2. Routes `eventType` → correct `notification.service.ts` function
3. Unknown `eventType` is acknowledged (no throw) — never poison the DLQ
4. Email send failures are caught and logged — never re-throw from `send*Email` functions (FR-NOTIF-06)

---

## Per-Phase Breakdown

> Every sub-phase below has its own spec file. The `Spec` column links to it.

### Phase 0 — Monorepo Scaffold & Infra Bootstrap

#### 0a — Root + Backend + Packages workspace

- **Spec**: `specs/00a-scaffold-root.md`
- **Prerequisites**: none
- **Session estimate**: 1
- **Key files**: `package.json`, `tsconfig.base.json`, `.eslintrc.json`, `.prettierrc`, `.gitignore`, `.env.example`, `backend/package.json`, `backend/tsconfig.json`, `backend/src/types/index.ts`, `packages/api-types/{package.json,src/index.ts}`, `packages/shared-utils/{package.json,src/index.ts}`
- **Done When**:
  - [ ] `npm install` from repo root succeeds without errors
  - [ ] Workspace resolves `@qulene/api-types` and `@qulene/shared-utils` from `backend/`
  - [ ] `npm run lint` exits 0 (no source files yet → trivially passes or passes against stubs)
  - [ ] `npm run typecheck` exits 0
  - [ ] ESLint config includes `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"`

#### 0b — Frontend app stubs + Local stack (MiniStack)

- **Spec**: `specs/00b-scaffold-frontend-local.md`
- **Prerequisites**: none (parallel with 0a)
- **Session estimate**: 1
- **Key files**: `apps/mobile/{package.json,app.json}`, `apps/web-app/package.json`, `apps/marketing/package.json`, `docker-compose.yml`, `infra/ministack/01-seed.sh`
- **Done When**:
  - [ ] `docker-compose up -d` starts MiniStack on `:4566` (passes healthcheck)
  - [ ] MiniStack init script creates: `qulene-local-events` SNS topic, `qulene-local-notifications` + `qulene-local-notifications-dlq` SQS queues with redrive policy, SNS→SQS subscription, `qulene-local-media` S3 bucket
  - [ ] `apps/mobile/package.json` declares the workspace member (no Expo init yet)
  - [ ] `apps/web-app/package.json` declares the workspace member (no Angular project yet)
  - [ ] `apps/marketing/package.json` declares the workspace member (no Angular project yet)

#### 0c — Terraform skeleton + CI workflow

- **Spec**: `specs/00c-scaffold-terraform-ci.md`
- **Prerequisites**: none (parallel with 0a, 0b)
- **Session estimate**: 1
- **Key files**: `infra/terraform/envs/dev/{main.tf,variables.tf,terraform.tfvars}`, `infra/terraform/envs/prod/{main.tf,variables.tf,terraform.tfvars}`, `infra/terraform/bootstrap/main.tf` (placeholder/README), `.github/workflows/ci.yml`
- **Done When**:
  - [ ] Every `provider "aws"` block uses `profile = var.aws_profile` (default `"rmw-llc"`)
  - [ ] Backend `s3` blocks reference `qulene-dev-tf-state` / `qulene-prod-tf-state`
  - [ ] `.github/workflows/ci.yml` runs lint + typecheck + (placeholder) `ng lint` for all 3 Angular workspaces on push/PR
  - [ ] Workflow uses OIDC for AWS auth (placeholder — no apply yet): `id-token: write`, `aws-actions/configure-aws-credentials@v4`, `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`

### Phase 1 — Cognito & Auth Flow

#### 1a — Backend auth (service + users table + handler + esbuild)

- **Spec**: `specs/01a-auth-backend.md`
- **Prerequisites**: 0a ✅
- **Session estimate**: 1
- **Key files**: `backend/src/services/auth.service.ts`, `backend/src/db/dynamo.client.ts`, `backend/src/db/tables/users.table.ts`, `backend/src/handlers/auth.handler.ts`, `backend/src/middleware/auth.middleware.ts`, `backend/esbuild.config.ts`, `backend/src/services/__tests__/auth.service.test.ts`, `backend/tests/integration/auth.handler.test.ts`
- **Done When**:
  - [x] `POST /auth/profile` creates a `users` record from Cognito claims (handler extracts `sub` + `custom:role`)
  - [x] Idempotent: re-calling `POST /auth/profile` returns the existing record
  - [x] Unit tests pass for `auth.service.ts` (happy + 422 wrong role + 409 already exists scenarios)
  - [x] Integration test against MiniStack passes
  - [x] `dist/lambdas/auth/index.js` produced by `npm run build`

#### 1b — Terraform Cognito + API Gateway + lambda-auth deploy

- **Spec**: `specs/01b-auth-terraform.md`
- **Prerequisites**: 0c ✅, 1a ✅
- **Session estimate**: 1
- **Key files**: `infra/terraform/modules/cognito/{main.tf,variables.tf,outputs.tf}`, `infra/terraform/modules/dynamodb-users/main.tf`, `infra/terraform/modules/api-gateway/main.tf`, `infra/terraform/modules/lambda/main.tf`, `infra/terraform/envs/dev/main.tf` (modify), `infra/scripts/post-apply-cognito.sh`
- **Done When**:
  - [x] Cognito User Pool + App Client provisioned; `custom:role` attribute in schema
  - [x] API Gateway v2 + Cognito JWT authorizer wired to `POST /auth/profile`
  - [x] `lambda-auth` deployed and reachable; `dist/lambdas/auth/index.js` packaged + uploaded
  - [x] Post-apply script writes `/qulene/dev/cognito_user_pool_id` + `/qulene/dev/cognito_app_client_id` to SSM
  - [x] `terraform validate` exits 0; `terraform plan` shows no drift after apply

#### 1c — Mobile auth (Cognito SDK + login + register)

- **Spec**: `specs/01c-auth-mobile.md`
- **Prerequisites**: 0b ✅, 1b ✅
- **Session estimate**: 1
- **Key files**: `apps/mobile/lib/cognito.ts`, `apps/mobile/hooks/useAuth.ts`, `apps/mobile/hooks/useApi.ts`, `apps/mobile/app/(auth)/{login.tsx,register.tsx}`, `apps/mobile/app/_layout.tsx`
- **Done When**:
  - [x] Register with email/password/role → Cognito `signUp` → mobile calls `POST /auth/profile` to sync DynamoDB user record
  - [x] Login with email/password → Cognito `signIn` → token in Expo SecureStore
  - [x] `useApi` injects `Authorization: Bearer <token>` on every request
  - [x] `_layout.tsx` redirects unauthenticated users to `/login`
  - [x] Both screens use NativeWind styling; both have at least one navigation entry point

### Phase 2 — Business Profile & Services

#### 2a — Backend business profile (service + table + handler + S3 + TF)

- **Spec**: `specs/02a-business-profile-backend.md`
- **Prerequisites**: 1b ✅
- **Key files**: `backend/src/services/business.service.ts`, `backend/src/db/tables/business-profiles.table.ts`, `backend/src/handlers/business.handler.ts`, `backend/src/clients/s3.client.ts`, `infra/terraform/modules/dynamodb-business-profiles/main.tf`, `infra/terraform/modules/lambda-businesses/main.tf`, tests
- **Done When**:
  - [x] `GET /businesses` (public, paginated, `category` filter)
  - [x] `GET /businesses/:businessId` (public)
  - [x] `PATCH /businesses/me` (BUSINESS only)
  - [x] `POST /businesses/me/avatar` (BUSINESS only, presigned URL)
  - [x] Role enforcement tested (CUSTOMER → 403)
  - [x] Unit + integration tests pass; `dist/lambdas/businesses/` produced

#### 2b — Backend services (service offerings)

- **Spec**: `specs/02b-services-backend.md`
- **Prerequisites**: 1b ✅
- **Key files**: `backend/src/services/service.service.ts`, `backend/src/db/tables/services.table.ts`, `backend/src/handlers/service.handler.ts`, `infra/terraform/modules/dynamodb-services/main.tf`, `infra/terraform/modules/lambda-services/main.tf`, tests
- **Done When**:
  - [x] `GET /businesses/:businessId/services` (public)
  - [x] `POST /businesses/me/services` (BUSINESS, max 20 active)
  - [x] `PATCH /businesses/me/services/:serviceId` (BUSINESS, ownership-checked)
  - [x] `DELETE /businesses/me/services/:serviceId` (soft delete → `status=DELETED`)
  - [x] Role + ownership enforcement tested

#### 2c — Backend availability windows

- **Spec**: `specs/02c-availability-backend.md`
- **Prerequisites**: 1b ✅
- **Key files**: `backend/src/services/availability.service.ts`, `backend/src/db/tables/availability-windows.table.ts`, `backend/src/handlers/availability.handler.ts` (added to business.handler), Terraform table module, tests
- **Done When**:
  - [x] `GET /businesses/:businessId/availability` (public)
  - [x] `POST /businesses/me/availability` (BUSINESS, max 14 windows, 2 per day)
  - [x] `DELETE /businesses/me/availability/:windowId` (BUSINESS, ownership-checked)

#### 2d — Mobile business management (profile + services + availability)

- **Spec**: `specs/02d-business-mobile.md`
- **Prerequisites**: 1c ✅, 2a ✅, 2b ✅, 2c ✅
- **Key files**: `apps/mobile/app/(business)/{profile.tsx,services.tsx,availability.tsx}`, supporting hooks
- **Done When**: ✅ 3 screens implemented with empty states + loading skeletons + at least one navigation entry per route (business tab bar)

#### 2e — Mobile customer browse (list + detail)

- **Spec**: `specs/02e-browse-mobile.md`
- **Prerequisites**: 1c ✅, 2a ✅, 2b ✅, 2c ✅
- **Key files**: `apps/mobile/app/(customer)/index.tsx`, `apps/mobile/app/(customer)/business/[id].tsx`, supporting components
- **Done When**: 2 screens implemented with category filter, business detail showing services + availability

### Phase 3 — Appointment Requests

#### 3a — Backend appointment tables (requests + notifications + TF)

- **Spec**: `specs/03a-appointment-tables.md`
- **Prerequisites**: 2a ✅, 2b ✅
- **Key files**: `backend/src/db/tables/appointment-requests.table.ts`, `backend/src/db/tables/notifications.table.ts`, `backend/src/clients/sns.client.ts`, `infra/terraform/modules/dynamodb-appointment-requests/main.tf`, `infra/terraform/modules/dynamodb-notifications/main.tf`, tests
- **Done When**: tables provisioned in MiniStack + AWS dev; all GSIs (`businessId-status-index`, `customerId-index`, `serviceId-index`, `idempotencyKey-index`, `userId-createdAt-index`) created; type definitions exported from `packages/api-types/`

#### 3b — Backend appointment customer flow (create + idempotency + cancel + list)

- **Spec**: `specs/03b-appointment-customer-backend.md`
- **Prerequisites**: 3a ✅
- **Key files**: `backend/src/services/appointment.service.ts` (functions: `createRequest`, `cancelRequest`, `listCustomerRequests`), `backend/src/handlers/appointment.handler.ts` (initial routes), `infra/terraform/modules/lambda-appointments/main.tf`, tests
- **Done When**:
  - [ ] `POST /appointments` (CUSTOMER, idempotency-checked, publishes `REQUEST_RECEIVED`)
  - [ ] `DELETE /appointments/:requestId` (CUSTOMER, ownership-checked, publishes `REQUEST_CANCELLED`)
  - [ ] `GET /appointments/me` (CUSTOMER, paginated by `customerId-index`)
  - [ ] Idempotency replay tested (same key → no duplicate write, no second SNS publish)

#### 3c — Backend appointment business actions (accept + decline + complete + noshow + list)

- **Spec**: `specs/03c-appointment-business-backend.md`
- **Prerequisites**: 3a ✅, 3b ✅
- **Key files**: `backend/src/services/appointment.service.ts` (functions: `acceptRequest`, `declineRequest`, `markComplete`, `markNoShow`, `listBusinessRequests`), `backend/src/handlers/appointment.handler.ts` (additional routes), tests
- **Done When**:
  - [x] `PATCH /businesses/me/appointments/:requestId/{accept|decline|complete|noshow}` (BUSINESS, ownership-checked)
  - [x] `GET /businesses/me/appointments` (BUSINESS, paginated by `businessId-status-index`, `status` filter)
  - [x] All four lifecycle actions publish appropriate SNS events
  - [x] Decline does NOT promote waitlist yet (deferred to Phase 4 where `waitlist.service.promoteOldestForService` is wired in)

#### 3d — Mobile customer appointment screens (request form + my appointments list)

- **Spec**: `specs/03d-appointment-customer-mobile.md`
- **Prerequisites**: 2e ✅, 3b ✅
- **Key files**: `apps/mobile/app/(customer)/appointments.tsx`, `apps/mobile/app/(customer)/business/[id].tsx` (modify to add request form), supporting components

#### 3e — Mobile business incoming requests screen

- **Spec**: `specs/03e-appointment-business-mobile.md`
- **Prerequisites**: 2d ✅, 3c ✅
- **Key files**: `apps/mobile/app/(business)/dashboard.tsx`, supporting components for accept/decline/complete/noshow actions

### Phase 4 — Waitlist

#### 4a — Backend waitlist (service + table + handler + TF + promotion wire-in)

- **Spec**: `specs/04a-waitlist-backend.md`
- **Prerequisites**: 3c ✅
- **Key files**: `backend/src/services/waitlist.service.ts`, `backend/src/db/tables/waitlist-entries.table.ts`, `backend/src/handlers/waitlist.handler.ts`, `infra/terraform/modules/dynamodb-waitlist-entries/main.tf`, `infra/terraform/modules/lambda-waitlist/main.tf`, `backend/src/services/appointment.service.ts` (modify decline + cancel to call `promoteOldestForService`), tests
- **Done When**:
  - [x] `POST /waitlist` (CUSTOMER, uniqueness check on `customerId+serviceId+status=ACTIVE`)
  - [x] `GET /waitlist/me` (CUSTOMER)
  - [x] `DELETE /waitlist/:entryId` (CUSTOMER, ownership-checked, sets `status=REMOVED`)
  - [x] `GET /businesses/me/waitlist/:serviceId` (BUSINESS, ownership-checked)
  - [x] Appointment decline / cancel triggers `promoteOldestForService` → publishes `WAITLIST_PROMOTED`
  - [x] Integration test: customer A submits → business declines → customer B (waitlisted) promoted → notification + event published

#### 4b — Mobile customer waitlist screens (join + my list)

- **Spec**: `specs/04b-waitlist-customer-mobile.md`
- **Prerequisites**: 2e ✅, 4a ✅
- **Key files**: `apps/mobile/app/(customer)/waitlist.tsx`, `apps/mobile/app/(customer)/business/[id].tsx` (modify to add Join Waitlist CTA)

#### 4c — Mobile business waitlist view

- **Spec**: `specs/04c-waitlist-business-mobile.md`
- **Prerequisites**: 2d ✅, 4a ✅
- **Key files**: `apps/mobile/app/(business)/waitlist.tsx`

### Phase 5 — Email Notifications

#### 5a — Terraform SQS + SNS + DLQ + lambda-notification IAM

- **Spec**: `specs/05a-notification-terraform.md`
- **Prerequisites**: 0c ✅
- **Key files**: `infra/terraform/modules/sqs/main.tf`, `infra/terraform/modules/sns/main.tf`, `infra/terraform/modules/lambda-notification/main.tf`
- **Done When**: `qulene-{env}-events` SNS topic + `qulene-{env}-notifications` SQS + DLQ + SNS→SQS subscription + Lambda event source mapping all provisioned; IAM grants `sqs:Receive/Delete`, `ses:SendEmail`, `dynamodb:GetItem`

#### 5b — Email rendering (renderer + ses.client + 6 Handlebars templates)

- **Spec**: `specs/05b-email-rendering.md`
- **Prerequisites**: 0a ✅
- **Key files**: `backend/src/clients/ses.client.ts`, `backend/src/emails/email.renderer.ts`, `backend/src/emails/templates/{request-received,request-accepted,request-declined,request-cancelled,waitlist-promoted,service-removed}.hbs`, renderer test
- **Done When**: each `send*Email` function renders the corresponding `.hbs` template; failures caught + logged + never re-thrown (FR-NOTIF-06); esbuild bundles `.hbs` files via text loader

#### 5c — Notification consumer (routing + handler + E2E test)

- **Spec**: `specs/05c-notification-consumer.md`
- **Prerequisites**: 3c ✅, 4a ✅, 5a ✅, 5b ✅
- **Key files**: `backend/src/services/notification.service.ts`, `backend/src/handlers/notification.handler.ts`, end-to-end integration test
- **Done When**: SQS consumer routes each `eventType` to the right `send*Email`; unknown events acknowledged silently; E2E test (appointment created → SNS → SQS → SES email payload captured in MiniStack) passes

### Phase 6 — In-App Notifications

#### 6a — Backend notifications endpoints (list + mark read + unreadCount + TF)

- **Spec**: `specs/06a-notifications-backend.md`
- **Prerequisites**: 5c ✅ (notifications table exists from Phase 3a; this phase adds read endpoints + unread counter)
- **Key files**: `backend/src/services/notification.service.ts` (extend), `backend/src/services/user.service.ts`, `backend/src/handlers/user.handler.ts`, `backend/src/handlers/notification.handler.ts` (extend), `infra/terraform/modules/lambda-users/main.tf`, tests
- **Done When**:
  - [ ] `GET /notifications` (paginated)
  - [ ] `PATCH /notifications/:notificationId/read` (atomic decrement of `unreadNotificationCount`)
  - [ ] `GET /users/me` returns `unreadNotificationCount`
  - [ ] `PATCH /users/me` updates `firstName`/`lastName`
  - [ ] Atomic counter operations tested

#### 6b — Mobile notifications screen + unread badge

- **Spec**: `specs/06b-notifications-mobile.md`
- **Prerequisites**: 1c ✅, 6a ✅
- **Key files**: `apps/mobile/app/(customer)/notifications.tsx` (also used by business), `apps/mobile/components/NotificationBadge.tsx`, tab bar config

### Phase 7 — Marketing SPA

#### 7a — Backend web/contact + web/signup endpoints

- **Spec**: `specs/07a-marketing-backend.md`
- **Prerequisites**: 0c ✅
- **Key files**: `backend/src/services/contact.service.ts`, `backend/src/db/tables/web-signups.table.ts`, `backend/src/handlers/contact.handler.ts`, `infra/terraform/modules/dynamodb-web-signups/main.tf`, `infra/terraform/modules/lambda-contact/main.tf`, tests
- **Done When**: `POST /web/contact` (no auth) sends admin email; `POST /web/signup` (no auth) writes `web-signups` table

#### 7b — Marketing Angular scaffold + routing + 3 core pages

- **Spec**: `specs/07b-marketing-scaffold.md`
- **Prerequisites**: 0b ✅
- **Key files**: `apps/marketing/{package.json,angular.json,tsconfig.json,tailwind.config.js}`, `apps/marketing/src/{main.ts,index.html,styles.css}`, `apps/marketing/src/app/{app.config.ts,app.routes.ts}`, `apps/marketing/src/app/pages/{home,about,how-it-works}.component.ts`
- **Done When**: `ng build` exits 0; `ng lint` exits 0; 3 pages route correctly via Angular Router

#### 7c — Marketing remaining pages + Contact form + waitlist signup

- **Spec**: `specs/07c-marketing-forms.md`
- **Prerequisites**: 7a ✅, 7b ✅
- **Key files**: `apps/marketing/src/app/pages/{pricing,contact,privacy,terms}.component.ts`, `apps/marketing/src/app/services/marketing-api.service.ts`
- **Done When**: Contact form POSTs to `/web/contact` and shows success/error; waitlist signup posts to `/web/signup`

#### 7d — Marketing Terraform deploy (S3 + CloudFront + Route 53)

- **Spec**: `specs/07d-marketing-deploy.md`
- **Prerequisites**: 7b ✅ (can deploy stubs before forms wired)
- **Key files**: `infra/terraform/modules/spa/main.tf` (reusable), `infra/terraform/modules/marketing/main.tf`, `infra/scripts/deploy-marketing.sh`
- **Done When**: S3 bucket `qulene-dev-frontend` + CloudFront distribution + Route 53 A-record for apex + www; deploy script syncs + invalidates; site reachable at `dev.qulene.com`

### Phase 8 — Angular Web Application

#### 8a — Web-app scaffold + auth.service + interceptors + guards + routing

- **Spec**: `specs/08a-webapp-scaffold.md`
- **Prerequisites**: 1b ✅
- **Key files**: `apps/web-app/{package.json,angular.json,tsconfig.json,tailwind.config.js}`, `apps/web-app/src/{main.ts,index.html,styles.css}`, `apps/web-app/src/app/{app.config.ts,app.routes.ts}`, `apps/web-app/src/app/services/auth.service.ts`, `apps/web-app/src/app/interceptors/auth.interceptor.ts`, `apps/web-app/src/app/guards/{auth.guard.ts,role.guard.ts}`
- **Done When**: `ng build` exits 0; `ng lint` exits 0; guards + interceptor wired in `app.config.ts`

#### 8b — Web auth + public pages (login, register, landing)

- **Spec**: `specs/08b-webapp-auth-pages.md`
- **Prerequisites**: 8a ✅
- **Key files**: `apps/web-app/src/app/pages/{login,register}/login.component.ts` (and register), landing page route in `app.routes.ts`
- **Done When**: register → Cognito + `POST /auth/profile`; login → Cognito + token in `localStorage` under `qulene_access_token`; 401/403 redirects to `/login`

#### 8c — Web public business browsing (list + detail)

- **Spec**: `specs/08c-webapp-public-browse.md`
- **Prerequisites**: 2a ✅, 2b ✅, 2c ✅, 8a ✅
- **Key files**: `apps/web-app/src/app/services/business.service.ts`, `apps/web-app/src/app/pages/{businesses,business-detail}/*.component.ts`

#### 8d1 — Web customer appointments + waitlist pages

- **Spec**: `specs/08d1-webapp-customer-bookings.md`
- **Prerequisites**: 3b ✅, 4a ✅, 8a ✅
- **Key files**: `apps/web-app/src/app/services/{appointment.service.ts,waitlist.service.ts}`, `apps/web-app/src/app/pages/customer/{appointments,waitlist}/*.component.ts`

#### 8d2 — Web customer notifications + profile pages

- **Spec**: `specs/08d2-webapp-customer-account.md`
- **Prerequisites**: 6a ✅, 8a ✅
- **Key files**: `apps/web-app/src/app/services/{notification.service.ts,user.service.ts}`, `apps/web-app/src/app/pages/customer/{notifications,profile}/*.component.ts`

#### 8e1 — Web business dashboard + profile (with avatar upload)

- **Spec**: `specs/08e1-webapp-business-dashboard-profile.md`
- **Prerequisites**: 2a ✅, 3c ✅, 8a ✅
- **Key files**: `apps/web-app/src/app/pages/business/{dashboard,profile}/*.component.ts`

#### 8e2 — Web business services + availability pages

- **Spec**: `specs/08e2-webapp-business-services-availability.md`
- **Prerequisites**: 2b ✅, 2c ✅, 8a ✅
- **Key files**: `apps/web-app/src/app/pages/business/{services,availability}/*.component.ts`

#### 8e3 — Web business waitlist + notifications pages

- **Spec**: `specs/08e3-webapp-business-waitlist-notifications.md`
- **Prerequisites**: 4a ✅, 6a ✅, 8a ✅
- **Key files**: `apps/web-app/src/app/pages/business/{waitlist,notifications}/*.component.ts`

#### 8f — Web-app Terraform deploy (S3 + CloudFront + Route 53)

- **Spec**: `specs/08f-webapp-deploy.md`
- **Prerequisites**: 8a ✅ (can deploy as soon as scaffold builds; pages added incrementally)
- **Key files**: `infra/terraform/modules/webapp/main.tf` (wraps `spa` module), `infra/scripts/deploy-web-app.sh`
- **Done When**: S3 `qulene-dev-app` + CloudFront + Route 53 A-record for `app.dev.qulene.com`; deploy script syncs + invalidates

### Phase 9 — DevOps & Hardening

#### 9a — GitHub Actions CI/CD workflows

- **Spec**: `specs/09a-ci-cd.md`
- **Prerequisites**: 0c ✅ (CI skeleton exists; this extends it with deploys)
- **Key files**: `.github/workflows/{ci.yml,deploy-dev.yml,deploy-prod.yml}` (deploy-dev and deploy-prod are new; ci.yml is extended)
- **Done When**: push to `main` → lint + test + build + Terraform apply (dev) + web-app deploy (dev) + marketing deploy (dev); prod gated by `prod-approval` GitHub environment with required reviewers

#### 9b — CloudWatch log groups + alarms + DLQ monitoring

- **Spec**: `specs/09b-observability.md`
- **Prerequisites**: 5a ✅
- **Key files**: `infra/terraform/modules/observability/main.tf`
- **Done When**: 14-day retention on all Lambda log groups; CloudWatch alarms for DLQ depth > 0, Lambda error rate > 1%

#### 9c — Secrets Manager + IAM least-privilege audit

- **Spec**: `specs/09c-secrets-iam.md`
- **Prerequisites**: 5a ✅, 1b ✅
- **Key files**: post-apply secrets writer script, IAM policy audit against `PROJECT.md` Section 5.8
- **Done When**: every Lambda IAM role matches Section 5.8 (no wildcards beyond named tables); `qulene-{env}-secrets` populated with `SNS_TOPIC_ARN`, `SES_FROM_EMAIL`, Cognito client secret

### Phase 10 — Polish & Portfolio Prep

#### 10a — Mobile + web design pass (visual consistency)

- **Spec**: `specs/10a-design-pass.md`
- **Prerequisites**: 6b ✅, 8e3 ✅

#### 10b — Error handling + empty states + skeletons

- **Spec**: `specs/10b-error-handling.md`
- **Prerequisites**: 6b ✅, 8e3 ✅

#### 10c — Seed script + demo data + screenshots + architecture diagram

- **Spec**: `specs/10c-portfolio-prep.md`
- **Prerequisites**: 10a ✅, 10b ✅
- **Key files**: `infra/scripts/seed-local.ts`, `docs/architecture.png`

---

## Session Protocol

Paste this prompt at the start of any new implementation session (after this first one):

```
You are implementing Qulene. Before writing any code:

1. Initialize the session log per CLAUDE.md Session Tracking section
2. Read CLAUDE.md in full and acknowledge the project rules
3. Read IMPLEMENTATION_PLAN.md — identify the first incomplete phase
   and confirm all prerequisites are ✅ Complete in the Progress Tracker
4. Read the governing spec for that phase in specs/
5. Report: which phase you are about to implement, which files are in scope,
   and any blockers you observe

Do not write any implementation code until you have completed steps 1–4
and reported your findings.
```

---

## Progress Tracker

| Phase | Name | Spec | Status | Date Completed |
| --- | --- | --- | --- | --- |
| 0a | Root + Backend + Packages workspace | `specs/00a-scaffold-root.md` | ✅ Complete | 2026-05-17 |
| 0b | Frontend app stubs + Local stack | `specs/00b-scaffold-frontend-local.md` | ✅ Complete | 2026-05-17 |
| 0c | Terraform skeleton + CI workflow | `specs/00c-scaffold-terraform-ci.md` | ✅ Complete | 2026-05-17 |
| 1a | Backend auth | `specs/01a-auth-backend.md` | ✅ Complete | 2026-05-17 |
| 1b | Terraform Cognito + API Gateway + lambda-auth | `specs/01b-auth-terraform.md` | ✅ Complete | 2026-05-17 |
| 1c | Mobile auth | `specs/01c-auth-mobile.md` | ✅ Complete | 2026-05-18 |
| 2a | Backend business profile | `specs/02a-business-profile-backend.md` | ✅ Complete | 2026-05-18 |
| 2b | Backend services | `specs/02b-services-backend.md` | ✅ Complete | 2026-05-18 |
| 2c | Backend availability windows | `specs/02c-availability-backend.md` | ✅ Complete | 2026-05-18 |
| 2d | Mobile business management | `specs/02d-business-mobile.md` | ✅ Complete | 2026-05-18 |
| 2e | Mobile customer browse | `specs/02e-browse-mobile.md` | ✅ Complete | 2026-05-18 |
| 3a | Backend appointment tables | `specs/03a-appointment-tables.md` | ✅ Complete | 2026-05-18 |
| 3b | Backend appointment customer flow | `specs/03b-appointment-customer-backend.md` | ✅ Complete | 2026-05-18 |
| 3c | Backend appointment business actions | `specs/03c-appointment-business-backend.md` | ✅ Complete | 2026-05-18 |
| 3d | Mobile customer appointment screens | `specs/03d-appointment-customer-mobile.md` | ✅ Complete | 2026-05-18 |
| 3e | Mobile business incoming requests | `specs/03e-appointment-business-mobile.md` | ✅ Complete | 2026-05-18 |
| 4a | Backend waitlist | `specs/04a-waitlist-backend.md` | ✅ Complete | 2026-05-18 |
| 4b | Mobile customer waitlist | `specs/04b-waitlist-customer-mobile.md` | ✅ Complete | 2026-05-18 |
| 4c | Mobile business waitlist | `specs/04c-waitlist-business-mobile.md` | ✅ Complete | 2026-05-18 |
| 5a | Notification Terraform | `specs/05a-notification-terraform.md` | ⬜ Not Started | — |
| 5b | Email rendering | `specs/05b-email-rendering.md` | ⬜ Not Started | — |
| 5c | Notification consumer | `specs/05c-notification-consumer.md` | ⬜ Not Started | — |
| 6a | Backend notifications endpoints | `specs/06a-notifications-backend.md` | ⬜ Not Started | — |
| 6b | Mobile notifications + badge | `specs/06b-notifications-mobile.md` | ⬜ Not Started | — |
| 7a | Backend marketing endpoints | `specs/07a-marketing-backend.md` | ⬜ Not Started | — |
| 7b | Marketing scaffold + core pages | `specs/07b-marketing-scaffold.md` | ⬜ Not Started | — |
| 7c | Marketing remaining pages + forms | `specs/07c-marketing-forms.md` | ⬜ Not Started | — |
| 7d | Marketing Terraform deploy | `specs/07d-marketing-deploy.md` | ⬜ Not Started | — |
| 8a | Web-app scaffold + auth + guards | `specs/08a-webapp-scaffold.md` | ⬜ Not Started | — |
| 8b | Web auth + public pages | `specs/08b-webapp-auth-pages.md` | ⬜ Not Started | — |
| 8c | Web public business browsing | `specs/08c-webapp-public-browse.md` | ⬜ Not Started | — |
| 8d1 | Web customer appointments + waitlist | `specs/08d1-webapp-customer-bookings.md` | ⬜ Not Started | — |
| 8d2 | Web customer notifications + profile | `specs/08d2-webapp-customer-account.md` | ⬜ Not Started | — |
| 8e1 | Web business dashboard + profile | `specs/08e1-webapp-business-dashboard-profile.md` | ⬜ Not Started | — |
| 8e2 | Web business services + availability | `specs/08e2-webapp-business-services-availability.md` | ⬜ Not Started | — |
| 8e3 | Web business waitlist + notifications | `specs/08e3-webapp-business-waitlist-notifications.md` | ⬜ Not Started | — |
| 8f | Web-app Terraform deploy | `specs/08f-webapp-deploy.md` | ⬜ Not Started | — |
| 9a | CI/CD workflows | `specs/09a-ci-cd.md` | ⬜ Not Started | — |
| 9b | Observability (logs + alarms) | `specs/09b-observability.md` | ⬜ Not Started | — |
| 9c | Secrets + IAM least-privilege | `specs/09c-secrets-iam.md` | ⬜ Not Started | — |
| 10a | Design pass | `specs/10a-design-pass.md` | ⬜ Not Started | — |
| 10b | Error handling + empty states | `specs/10b-error-handling.md` | ⬜ Not Started | — |
| 10c | Portfolio prep (seed + docs) | `specs/10c-portfolio-prep.md` | ⬜ Not Started | — |
