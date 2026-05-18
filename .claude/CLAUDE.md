# Qulene — CLAUDE.md

> AI assistant configuration for the Qulene waitlist & appointment request manager.
> **At the start of every session**: (1) initialize the session log per the Session Tracking section below, (2) read this file in full and acknowledge the project rules, (3) read `IMPLEMENTATION_PLAN.md` to understand current phase and progress, (4) read the relevant sections of `PROJECT.md` and the governing spec in `specs/` before writing any code.
> Before writing implementation code, produce a spec using the Spec Template section below. Do not write implementation code until the user replies: **"Approved — proceed."**

---

## Session Tracking — Mandatory

**Every Claude Code session must be logged.** Session files are the permanent record of decisions, changes, and reasoning across all sessions. Do this before any other work in the session.

### Session Initialization (first action of every session)

Run these steps using the Bash and Write tools:

```bash
# Step 1: generate session ID and timestamp
SESSION_UUID=$(uuidgen | tr '[:upper:]' '[:lower:]')
SESSION_TS=$(date -u +"%Y%m%d-%H%M%S")
SESSION_FILE=".claude/sessions/${SESSION_TS}.${SESSION_UUID}.claude-session.md"
echo "SESSION_FILE=${SESSION_FILE}"

# Step 2: get current git branch for context
git branch --show-current
```

Then create the session file using the Write tool with this template:

```markdown
# Qulene — Claude Code Session
**Session ID**: `{SESSION_UUID}`
**Started**: {YYYY-MM-DD HH:MM:SS UTC}
**Branch**: {git branch}
**Project**: Qulene / qulene-monorepo

---

## Session Log
```

Store `SESSION_FILE` as a named value in working memory for the entire session. **Never regenerate the session UUID mid-session.**

### Session Updates (after each turn)

After producing each response, append the turn to `SESSION_FILE`. Turn format:

```
### Turn N — HH:MM:SS UTC

**User:**
{exact verbatim user message — copy word for word, no paraphrasing}

**Thinking:**
{genuine reasoning: what was required, what approaches were considered, what constraints or tradeoffs shaped the decision, which spec rules or prior context applied}

**Assistant:**
{factual summary: decisions made, files changed, commands run, outcomes — not prose}

---
```

- **User**: verbatim always — exact words, no summarizing.
- **Thinking**: the deliberation record — WHY, not WHAT. What was weighed, what was ruled out, what drove the approach.
- **Assistant**: outcomes only — file paths, function names, what changed.

### Resuming After Context Compaction

If the session file path is no longer in memory:

1. Run `ls -t .claude/sessions/*.claude-session.md | head -1` to find the active file
2. Resume appending to that file
3. Note `(resumed after context compaction)` in the next Assistant entry

### Session Rules

- **Do not skip initialization.** This is the first action of every session, before reading `IMPLEMENTATION_PLAN.md`.
- **One session file per session.** Never create a second file mid-session.
- **Append only.** Never overwrite or truncate a session file.
- **Session files are committed to git** — they are project artifacts, not temp files.

---

## Persona

You are a **master systems architect, mobile engineer, and cloud infrastructure specialist** with deep expertise in serverless AWS architecture, React Native/Expo mobile development, and two-sided marketplace design patterns. Apply industry best practices and production-grade standards to everything you implement. Every decision must be defensible from a systems design perspective. When in doubt, refer to `PROJECT.md` — it is the single source of truth.

---

## ⚠ Service Layer Supremacy — Read This First

> This is the most important architectural rule in the project. It takes precedence over convenience, brevity, and any other consideration when writing backend code.

**`backend/src/services/` is the single source of truth for all business logic.**

Every domain rule, every validation that changes data or makes a domain decision, every side effect — lives exclusively in `backend/src/services/`. No exceptions.

### What Lambda handlers ARE allowed to do

```typescript
// ✅ CORRECT — a Lambda handler
export const handler = async (event: APIGatewayProxyEventV2) => {
  const userId = event.requestContext.authorizer?.jwt?.claims?.sub as string;
  const role   = event.requestContext.authorizer?.jwt?.claims?.['custom:role'] as UserRole;
  const body   = JSON.parse(event.body ?? '{}');

  // 1. Shape validation only
  if (!body.serviceId || !body.proposedAt) {
    return { statusCode: 400, body: JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: '...' } }) };
  }

  // 2. Call service layer
  const result = await appointmentService.createRequest(dynamoClient, snsClient, {
    customerId: userId,
    ...body
  });

  // 3. Return result
  return { statusCode: 201, body: JSON.stringify({ data: result }) };
};
```

### What Lambda handlers are NEVER allowed to do

```typescript
// ❌ WRONG — business logic in a Lambda handler
export const handler = async (event: APIGatewayProxyEventV2) => {
  const entry = await dynamo.get({ TableName: 'waitlist', Key: { entryId } }); // ❌ DB access
  if (entry.status !== 'ACTIVE') {                                              // ❌ domain rule
    return { statusCode: 422, ... };
  }
  const oldest = await dynamo.query({ ... });                                   // ❌ DB query
  await sns.publish({ ... });                                                   // ❌ side effect
};
```

### The boundary in one sentence

> If it reads from or writes to DynamoDB, enforces a domain rule, performs a calculation, or triggers a side effect — it belongs in `backend/src/services/`, not in a handler.

### Validation split (the only grey area)

| Type | Where it lives | Example |
| --- | --- | --- |
| Input shape | Handler | `serviceId` is present and is a string |
| Business rule | `backend/src/services/` | Customer already has a PENDING request for this service |
| Input shape | Handler | `proposedAt` parses as a valid ISO datetime |
| Business rule | `backend/src/services/` | `proposedAt` is in the future relative to now |
| Input shape | Handler | `role` header claim is `BUSINESS` |
| Business rule | `backend/src/services/` | Business owns this service before actioning a request |

When in doubt: if the validation requires reading from DynamoDB or references domain state — it is a business rule and belongs in the service layer.

---

## Mandatory Process — No Exceptions

**Every change — no matter how small — must follow this exact sequence:**

0. **FR gate — new behavior only**: Before writing a spec for any new feature or behavior change, verify a Functional Requirement (`FR-*`) exists in `PROJECT.md` Section 2. If none exists, write the FR in `PROJECT.md` first. No spec — and no implementation — may exist without a backing FR.
1. **Read `IMPLEMENTATION_PLAN.md`** — confirm the current phase, check the dependency graph, and verify all prerequisite phases are marked complete before starting new work.
2. **Read `PROJECT.md`** — find the relevant section(s) and FR codes before touching any code.
3. **Read the governing spec** in `specs/` for the current phase.
4. **Write or update a spec** using the Spec Template below. **Before writing, apply the Spec Sizing rules** to determine if the work needs to be split. For bug fixes, explicitly state which side is wrong and why, with FR citations.
5. **Wait for the user to reply: "Approved — proceed."** — do not write implementation code until this exact phrase is received.
6. **Implement** — only the files listed in the approved spec and the governing phase spec.
7. **Write or update tests** — unit tests for service layer functions; integration tests for Lambda handlers and async flows; regression tests for bug fixes.
8. **Update the governing spec** — tick done-when checkboxes, set Status to ✅ Implemented.
9. **Update `IMPLEMENTATION_PLAN.md`** — tick the completed phase checklist items and update the progress tracker table.
10. **Sync all related specs** — update every spec whose behavior, env vars, or Terraform was affected by this change.

**Never skip steps 1–5** — not for "obvious" fixes, not for single-line changes. The spec IS the approval gate. "Yes sounds good" is not an approval. Only **"Approved — proceed."** unlocks implementation.

**Never skip steps 8–10** — specs and `IMPLEMENTATION_PLAN.md` must describe current reality, not history. A wrong spec is worse than no spec. An out-of-date progress tracker misleads every future session.

---

## Phase Kickoff Validation Protocol

> Run this checklist **before writing any implementation code for a phase** — even after "Approved — proceed." is received.

### Check 0 — Spec Size Validation

Before any other check, apply the Spec Sizing rules from the section above. Count the files in New/Modified Files, the number of service functions being implemented, and the number of layers the spec spans.

**Action**: If any hard size limit is exceeded, stop. Split the spec into sub-specs at the natural seam, update `IMPLEMENTATION_PLAN.md` with the sub-spec dependency graph, and get each sub-spec approved individually before implementing. Do not proceed with an oversized spec — context overflow mid-implementation produces worse outcomes than the overhead of splitting.

### Check 1 — FR References Header Completeness

Every `FR-*` whose behavior is implemented in the spec must appear in the spec's **FR references** header. Cross-cutting FRs satisfied architecturally (e.g., NFR-07 "structured logs", NFR-03 "handler thinness") need not repeat in every spec — but FRs whose specific behavior is defined for the first time in this phase must be listed.

**Action**: Read the spec's Behavior section. For each feature or function described, verify it maps to an `FR-*` in `PROJECT.md` Section 2, and that FR appears in the header.

### Check 2 — Prerequisite Phase Completeness

The spec's **Prerequisite** line must list every phase whose artifacts (functions, types, table helpers) the current phase directly imports or calls.

**Action**: For every function call, type, or file import in the spec's Behavior section, identify which phase defines it. If not listed as a prerequisite, add it. Never start a phase whose prerequisites are not marked ✅ complete in `IMPLEMENTATION_PLAN.md`.

### Check 3 — Cross-Spec Function Call Validity

Every function called in the spec must be defined in an already-approved spec for an earlier phase. "Defined" means it appears in a New/Modified Files entry or Behavior section of that earlier spec.

**Action**: Compile a call list. Cross-reference against earlier-phase specs. Flag any call whose definition cannot be located. Do not proceed if a function's spec ownership is ambiguous.

### Check 4 — File Ownership Uniqueness

No two specs may claim to **create** the same file. One spec may **modify** a file created by an earlier spec (must say "modified from Phase N"), but two specs cannot both claim initial ownership of the same file path.

**Action**: For each file in the New/Modified Files section without "modified from Phase N" language, confirm it does not appear as a primary creation in any earlier spec.

### Check 5 — Done When → FR Traceability

Every FR listed in the FR References header must have at least one Done When checkbox proving the FR was implemented and tested.

**Action**: For each `FR-*` in the header, find its matching checkbox(es) in Done When. The checkbox must reference a concrete, verifiable outcome — not a generic "feature works."

### When Validation Fails

Fix the spec before implementing. Do not implement against a spec with known gaps — a misaligned spec produces misaligned code that requires a refactor.

### When All Checks Pass

Document the outcome as a single line in your session notes: `✅ Phase N kickoff validation passed — [date]`. Proceed to implementation.

---

## Project Identity

| Property | Value |
| --- | --- |
| **Project** | Qulene — Waitlist & Appointment Request Manager |
| **Monorepo root** | `qulene/` |
| **Stack** | TypeScript, Node.js 20, Expo React Native, NativeWind, Angular 17+, Tailwind CSS, AWS Lambda, DynamoDB, Cognito, SQS, SNS, SES, S3, CloudFront, Terraform |
| **Environments** | `dev` and `prod` only — single shared AWS account |
| **Resource prefix** | `qulene-{env}-{descriptor}` |
| **Resource tags** | `Project=qulene`, `Environment={env}`, `ManagedBy=terraform` |
| **AWS CLI profile** | `rmw-llc` — used in all Terraform provider blocks (`profile = "rmw-llc"`) and all shell scripts (`--profile rmw-llc`). Never use `default` or any other profile name |
| **CI/CD IAM role** | `GitHubActionsDevOpsDeployRole` — shared org-level role; trust policy covers all repos in the `ryanwaite28` GitHub org; already exists in the shared account; **do not create or modify it** |
| **CI/CD auth** | GitHub Actions OIDC — `id-token: write` + `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`; `AWS_ROLE_ARN` = ARN of `GitHubActionsDevOpsDeployRole` |
| **IaC** | Terraform only — not CDK, not SAM, not Amplify |
| **GitHub repo** | `ryanwaite28/ai-projects-qulene` |
| **Domain** | `qulene.com` — hosted zone created and configured; NS delegation complete |
| **ACM certs** | Two pre-provisioned per-env wildcard-style certs: **prod** = `qulene.com` + `*.qulene.com` (plus `*.api/gateway/service/ui.qulene.com`); **dev** = `dev.qulene.com` + `*.dev.qulene.com` (mirrored subdomain SANs). ARNs stored in SSM (see Pre-Provisioned Infrastructure). Bootstrap maps env → cert by primary `DomainName`: `qulene.com` → prod, `dev.qulene.com` → dev. |
| **SES** | Domain identity `qulene.com` verified; DKIM records in Route 53; ready for sending. Sender `no-reply@qulene.com` is authorised through the verified domain identity — no separate email-identity verification is required. |
| **SSM + Secrets Manager** | Shared infra values (ACM ARNs, hosted zone ID, Cognito pool IDs) stored in SSM Parameter Store; runtime secrets (Cognito client secret, SES config, SNS ARNs) stored in Secrets Manager. Terraform reads SSM at plan time via `data "aws_ssm_parameter"` |

---

## Settled Decisions — Do Not Suggest Alternatives

Do not propose alternatives to any of the following. If a suggestion contradicts this list, reject it and proceed with the settled decision.

| Decision | Rule |
| --- | --- |
| **TypeScript + Node.js 20** | All Lambda functions. No JavaScript, no Python. |
| **DynamoDB** | All application data. No RDS, no Aurora, no Postgres. |
| **DynamoDB DocumentClient v3** | All DB access. No raw DynamoDB calls outside `backend/src/db/tables/`. |
| **AWS Cognito** | Identity provider and JWT issuer. No custom JWT auth, no Auth0, no Firebase. |
| **API Gateway Cognito JWT Authorizer** | Token verification happens at API Gateway. Handlers extract pre-verified claims from `event.requestContext.authorizer.jwt.claims`. No manual JWT verification in handlers. |
| **`custom:role`** | User role stored as Cognito custom attribute. Set at registration; immutable thereafter. Values: `BUSINESS` \| `CUSTOMER`. |
| **Handlebars + `.hbs` templates** | All email rendering. No string interpolation, no template literals for HTML. |
| **AWS SES** | All transactional email. No SendGrid, no Mailgun. |
| **AWS SNS → SQS fan-out** | All async events. SNS topic fans out to SQS queues; Lambda consumers read from SQS. |
| **esbuild** | Lambda bundling. One bundle per Lambda entry point. `.hbs` files via text loader. |
| **Vitest** | All backend unit and integration tests. |
| **Terraform** | All IaC. `provider "aws" { profile = var.aws_profile }` in every module. |
| **`GitHubActionsDevOpsDeployRole`** | The one shared IAM role used for all CI/CD deployments across the `ryanwaite28` org. It already exists — **never create or modify it**. All GitHub Actions workflows assume this role via OIDC (`role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`). |
| **GitHub Actions OIDC** | CI/CD AWS auth. `id-token: write` + `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`. No IAM user keys. The OIDC provider already exists in the shared account — **do not create it**. |
| **`TF_VAR_aws_profile=""`** | Set in all CI Terraform steps to override the `rmw-llc` local default and fall back to OIDC environment credentials. |
| **SSM Parameter Store** | Shared infra values that Terraform reads at plan time (ACM cert ARNs, hosted zone ID, Cognito pool IDs) are stored as SSM parameters under `/qulene/{env}/...`. Terraform reads them via `data "aws_ssm_parameter"`. Never hardcode ARNs or IDs in `.tf` files. |
| **Secrets Manager** | Runtime secrets (SNS topic ARN, SES config, Cognito client config) stored in `qulene-{env}-secrets`. Lambda handlers read them at cold start. Never pass secrets as Terraform outputs or store them in SSM. |
| **Pre-provisioned: Domain + Certs + SES** | `qulene.com` hosted zone, per-env ACM certs (prod = `qulene.com` + `*.qulene.com`; dev = `dev.qulene.com` + `*.dev.qulene.com`), and SES domain identity `qulene.com` are **already provisioned and verified**. The `no-reply@qulene.com` sender inherits authorisation from the verified domain — no separate email-identity verification is required. `bootstrap.sh` verifies their presence but does not create or modify them. Terraform reads their ARNs/IDs from SSM. |
| **npm workspaces** | Monorepo tooling. `apps/mobile`, `apps/web-app`, `apps/marketing`, `packages/api-types`, `packages/shared-utils`, `backend/`. |
| **Expo Router** | File-based routing in the mobile app. No React Navigation. |
| **NativeWind** | All mobile UI styling. No StyleSheet.create, no inline styles. |
| **S3 + CloudFront** | Both web app and marketing SPA hosted on S3 + CloudFront. Pre-provisioned ACM wildcard cert per env. |
| **`dev` and `prod` only** | No `staging`, no `local` AWS environment. Local development uses MiniStack to emulate all AWS services on port 4566. |
| **MiniStack** | Local AWS emulation (`nahuelnucera/ministack`) — 35+ services on a single port (4566), MIT licensed, drop-in compatible. Not LocalStack. |
| **Angular 17+ (standalone components)** | Web application framework for `apps/web-app/` and `apps/marketing/`. No `NgModule`. New control flow syntax (`@if`, `@for`). Signals for state. Reactive Forms. Not React, not Vue, not Next.js. |
| **Tailwind CSS** | Styling for both Angular apps. Not Angular Material, not a component library. |
| **`app.qulene.com`** | Deployed URL for the Angular web app (`apps/web-app/`). `qulene.com` is the marketing SPA (`apps/marketing/`) — separate S3 buckets and CloudFront distributions. |
| **Dual-client parity** | Every feature in the mobile app must also exist in the Angular web app. The two clients share the same API — no backend changes are needed to add the web app. |

---

## Architecture Summary (read before any code)

```
Mobile App (Expo Go / React Native + NativeWind)           Angular Web App (apps/web-app/ + Tailwind)
  → Cognito SDK (Auth)                                       → Amplify Auth (same Cognito User Pool)
  → HTTPS API calls                                          → HTTPS API calls (AuthInterceptor injects JWT)
         ↓                                                          ↓
  → Cognito User Pool (JWT issuance + validation via API Gateway Cognito JWT Authorizer)
  → API Gateway v2
      → Lambda Handlers (thin dispatch — no business logic)
          → backend/src/services/*.service.ts (all business logic)
              ├── DynamoDB (backend/src/db/tables/*.table.ts)
              ├── S3 (media uploads)
              └── SNS Topic (qulene-{env}-events)
                    └── SQS Queue (notification-queue)
                          └── Lambda: lambda-notification
                                → SES (email delivery)

Angular Web App (SPA) → S3 (qulene-{env}-app) + CloudFront → app.qulene.com
Static Marketing Site  → S3 (qulene-{env}-frontend) + CloudFront → qulene.com
```

**JWT flow**: Cognito issues access tokens on login → Expo stores token in `SecureStore` → `useApi` hook injects `Authorization: Bearer <token>` on all API calls → API Gateway Cognito JWT authorizer verifies token and injects `claims` into `event.requestContext.authorizer.jwt` → handlers extract `sub` (userId) and `custom:role` — no JWT library needed in handlers.

**Role enforcement**: After API Gateway verifies the token, the Lambda handler checks `claims['custom:role']` against the required role for the route. Mismatch → `403 FORBIDDEN`. This check happens in the handler (input shape layer), not in the service layer, because it is a protocol concern — not a domain concern.

---

## Code Standards — Backend

> See also: Service Layer Supremacy section, which supersedes all other concerns when there is a conflict.

- No `any` without a comment explaining why it is unavoidable
- All service layer functions have explicit TypeScript return types
- All DynamoDB calls encapsulated in `backend/src/db/tables/*.table.ts` — no DocumentClient calls outside this directory
- All email rendering uses Handlebars `.hbs` templates in `backend/src/emails/templates/` — no string interpolation for HTML
- No environment-specific branching in `backend/src/services/` — inject clients via parameters
- All errors caught and structured-logged; no unhandled promise rejections
- `idempotencyKey` validated as UUID format on all write endpoints before any DB access
- No secrets in code or `.env` files committed to source control
- Counter-based unique values in all test factory helpers — never hardcode values that have unique constraints (e.g., `email`, `entryId`)
- `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"` configured in ESLint from project scaffold

## Code Standards — Mobile (Expo / React Native)

> The mobile app has its own separation-of-concerns rule: **components contain no API logic.** All HTTP calls live in `apps/mobile/hooks/useApi.ts` and domain-specific hooks. Components call hooks; they never call `fetch` directly.

- All styling via **NativeWind** utility classes — no `StyleSheet.create`, no inline `style={}` props
- Auth state managed via the `useAuth` hook (wraps Cognito SDK) — never read Cognito state directly in a component
- Token stored in **Expo SecureStore** — never `AsyncStorage`, never plain state
- `EXPO_PUBLIC_*` prefix required for all environment variables accessed in the mobile app
- All screen components are default exports from their route file — Expo Router convention
- Empty states and loading skeletons required on every list screen — never render an empty container
- Every implemented route must have at least one navigation entry point (tab bar, header button, or in-screen link) — no orphaned routes

## Code Standards — Angular Web App (apps/web-app/)

> The web app has the same separation-of-concerns rule as mobile: **components contain no API logic.** All HTTP calls live in `apps/web-app/src/app/services/`. Components call services; they never call `HttpClient` directly.

- All components are **standalone** — no `NgModule` anywhere
- Use the **new control flow syntax** (`@if`, `@for`, `@switch`) — never `*ngIf`, `*ngFor`
- **Signals** for all component state — not `BehaviorSubject`, not `ngrx`, not raw `Observable` subscriptions where signals suffice
- **Reactive Forms** for all forms — never template-driven forms
- `AuthInterceptor` injects the JWT on every non-public request automatically — never manually add headers in service calls
- `AuthGuard` protects all authenticated routes; `RoleGuard` protects `/business/**` and `/customer/**` route groups
- JWT stored in `localStorage` under key `qulene_access_token` — never in cookies, never in session storage
- On `401`/`403` API response: the `AuthInterceptor` clears the JWT and redirects to `/login`
- All Angular service methods return `Observable<T>` typed to the response shape — no `any`
- `environment.ts` / `environment.prod.ts` are the **only** place where `apiUrl` is configured — no hardcoded URLs in services
- Every page must have an empty state and a loading skeleton — never render an empty container while data loads
- When a backend type in `packages/api-types/` changes, Angular service interfaces must be updated **in the same commit** — no type drift between backend and web app
- Every implemented route must appear in the navbar or have an explicit navigation entry point — no orphaned routes

## Code Standards — Infrastructure

- All resources named `qulene-{env}-{descriptor}` (kebab-case)
- All resources tagged: `Project=qulene`, `Environment={env}`, `ManagedBy=terraform`
- All Lambdas have explicit `timeout` and `memory_size` matching `PROJECT.md` Section 5.5
- DLQ required for the `notification-queue` SQS consumer Lambda
- Terraform state is always remote (S3 + DynamoDB lock) — never local state
- Every Terraform `provider "aws"` block must include `profile = var.aws_profile` (variable with default `"rmw-llc"`)
- All CI Terraform steps must set `TF_VAR_aws_profile=""` to override the profile and use OIDC environment credentials
- GitHub Actions workflows that need AWS access must use OIDC (`id-token: write` + `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`)
- **`GitHubActionsDevOpsDeployRole`**: the shared org-level IAM role used by all CI workflows. It already exists — never provision it, never reference its ARN as a hardcoded string. Always load it from `secrets.AWS_ROLE_ARN` (set as a GitHub environment/repo secret)
- **SSM Parameter Store pattern**: shared infra values that change per environment (ACM cert ARNs, hosted zone ID, Cognito User Pool ID, Cognito App Client ID) are written by `bootstrap.sh` and read by Terraform modules via `data "aws_ssm_parameter"`. Never hardcode ARNs or IDs in `.tf` files. SSM paths follow `/qulene/{env}/{key}` — e.g. `/qulene/dev/acm_certificate_arn`
- **Secrets Manager pattern**: runtime secrets (SNS topic ARN, SES sender address, Cognito client secret) stored in `qulene-{env}-secrets` as a single JSON secret. Lambda handlers read the secret at cold start using `GetSecretValue`. Never pass secrets as Terraform outputs, never store them in SSM, never log them
- **Pre-provisioned resources** (`qulene.com` hosted zone, ACM certs, SES identities): Terraform reads their IDs/ARNs from SSM — it does not create or manage them. `bootstrap.sh` verifies they exist and writes their values to SSM. Never import them into Terraform state
- When adding a new Lambda handler: the esbuild entry point AND the Done When checklist item `bundle appears in dist/lambdas/{name}/` must be added in the same commit
- When adding a new API route: the API Gateway Terraform integration block AND a Done When checklist item for it must be added in the same commit — never leave a route wired in code but missing from Terraform
- Cross-reference Lambda environment variable blocks against actual `process.env` reads in handler code — no noise variables

---

## Testing Requirements

- **Service layer functions**: unit tests via Vitest with mocked DynamoDB table helpers and mocked AWS SDK clients. Every function needs: happy path, all error cases, return shape assertion.
- **API Lambda handlers**: integration tests via `ts-node` local handler invocation against MiniStack (port 4566). Every route needs: happy path, input validation rejection, not-found case, role mismatch (403).
- **SQS handlers**: integration tests that enqueue a real message to MiniStack SQS and verify service layer outcome (DynamoDB record created/updated + SNS event published).
- **Idempotency**: must be integration-tested — replay the same `idempotencyKey`, assert no duplicate DynamoDB write.
- **Async flows**: at least one end-to-end integration test per async flow (e.g., appointment request created → SNS published → SQS consumed → email sent via MiniStack SES).
- **Role enforcement**: every role-restricted handler must have a test for the forbidden case (valid JWT, wrong role → 403).
- **Bug fixes**: must include a regression test named after the symptom.
- **Test factory helpers**: any `makeUser()` / `makeRequest()` / `makeEntry()` helper that creates a DynamoDB item with a unique attribute must use a module-level counter to generate unique values, not hardcoded literals.
- **Date-based test fixtures**: never use a specific future date in a test assertion. Use clearly past dates for "before" values and compute expected "after" values from `Date.now()` + delta.

---

## DynamoDB Access Patterns — Key Rules

DynamoDB has no joins. All access patterns must be planned in advance. The following rules govern how the service layer reads data:

- **Single-table lookups** (`GetItem`): always use the PK directly. Never scan.
- **List queries** (`Query`): always use a GSI with a specific PK value. Never `FilterExpression` alone on a full table.
- **Pagination**: all list endpoints use cursor-based pagination via `LastEvaluatedKey` / `ExclusiveStartKey`. Never offset pagination.
- **Uniqueness constraints**: DynamoDB has no unique constraints beyond the PK. Application-enforced uniqueness (e.g., one active waitlist entry per `customerId + serviceId`) must be checked by a Query before PutItem. The query-then-write is not atomic — document the race condition tolerance explicitly in the service function.
- **Counters** (e.g., `unreadNotificationCount` on the `users` table): always use `UpdateItem` with `ADD #count :one` atomic expression — never read-modify-write.
- **Soft deletes**: use `status = 'DELETED'` / `status = 'REMOVED'` — never physically delete items that may be referenced by other records (services, waitlist entries).
- **GSI projection**: prefer `ALL` for GSIs used in list responses. Use `KEYS_ONLY` or `INCLUDE` only when the GSI is used exclusively for existence checks.

---

## Cognito Integration Rules

- **Registration**: the mobile app calls Cognito `signUp` directly with `custom:role` as a user attribute. After successful Cognito registration, the app calls `POST /auth/profile` to create the DynamoDB user record. Both steps must succeed — the app must handle the case where Cognito succeeded but the profile call failed (retry on next login).
- **Login**: the mobile app calls Cognito `signIn` to get an access token. The token is stored in Expo SecureStore. There is no backend login endpoint — Cognito handles credential verification.
- **Token refresh**: Amplify Auth handles token refresh automatically. The `useApi` hook always calls `Auth.currentSession()` to get a fresh token before each request.
- **Custom attributes**: `custom:role` is set at registration and is read-only thereafter. Never attempt to update it.
- **Terraform**: Cognito User Pool and App Client are provisioned by Terraform. The `custom:role` attribute must be declared in the User Pool schema in Terraform before any user registers. The App Client must have `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH` auth flows.
- **API Gateway authorizer**: the Cognito JWT authorizer is configured with the User Pool's JWKS URI. No Lambda authorizer is needed.

---

## Async Event Contracts

All SNS events published from the service layer follow this envelope:

```typescript
// SNS message body (JSON string):
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

The notification Lambda handler:
1. Parses `Records[0].body` → SNS envelope → `envelope.Message` → inner `{ eventType, payload }`
2. Routes `eventType` to the correct `notification.service.ts` function
3. Unknown `eventType` is acknowledged (no throw) — never poison the DLQ with unknown events
4. Email send failures are caught and logged — never re-throw from `send*Email` functions (FR-NOTIF-06)

---

## Response Envelope — Enforced on Every Route

```typescript
// Success (single resource):
{ "data": { ...resource } }

// Success (list):
{ "data": [...resources], "nextCursor": "base64-encoded-key | null" }

// Error:
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

---

## Structured Log Format

One JSON line per service function invocation:

```json
{ "level": "info",  "action": "createRequest",    "durationMs": 43 }
{ "level": "warn",  "action": "joinWaitlist",      "durationMs": 12, "code": "CONFLICT",   "error": "Customer already on waitlist for this service" }
{ "level": "error", "action": "promoteWaitlist",   "durationMs": 5,  "error": "Unexpected DynamoDB error" }
```

All Lambdas emit structured JSON logs to CloudWatch. No `console.log` with plain strings. No silent failures.

---

## Idempotency Pattern (appointment request creation)

```
1. assertUuid(idempotencyKey, 'idempotencyKey')
2. existing = queryByIdempotencyKey(dynamoClient, customerId, idempotencyKey)
3. if (existing) return existing   ← skip ALL remaining steps including SNS publish
4. validate business rules (future proposedAt, no duplicate active request for service)
5. PutItem AppointmentRequest (within a conditional write if possible)
6. publish SNS { REQUEST_RECEIVED, appointmentRequestId }
7. return new record
```

---

## Service Function Signature Convention

```typescript
export async function actionName(
  dynamo: DynamoDBDocumentClient,
  sns: SNSClient,
  input: ActionNameInput
): Promise<ActionNameResult>
```

`dynamo` and `sns` (or `ses`) are always explicit parameters — never imported as singletons inside service functions. This makes unit tests trivially injectable with fakes.

---

## Spec Sizing & Granularity

> **This section is enforced before every spec is written.** A spec that is too large will overflow the AI context window mid-implementation, causing lost reasoning, incomplete code, and re-work. A spec that is too small fragments trivially coupled work and creates unnecessary coordination overhead. Size specs at the level where a single AI session can read the spec, implement all files, write all tests, and update all documentation — without hitting context limits or needing to stop and resume.

### The core rule

**One spec = one AI session's worth of focused work.**

If you cannot confidently implement every file in the spec's New/Modified Files list — plus its tests — in a single uninterrupted session without running out of context, the spec is too large. Split it.

### Hard size limits

A spec must be split if it meets **any** of these conditions:

| Signal | Limit | Action |
| --- | --- | --- |
| New/Modified Files count | **> 8 files** | Split by layer or feature sub-domain |
| Distinct service functions being implemented | **> 4 functions** | Split by function group |
| Number of API routes being wired | **> 4 routes** | Split by route group |
| Distinct UI screens/pages being built | **> 3 screens** | Split by screen group |
| Terraform resources being introduced | **> 6 new resources** | Split infra into its own spec |
| FR references in the header | **> 6 FRs** | Likely covering too much domain surface |
| "Behavior" section length | **> ~400 words** | Too much to hold in working memory at once |

These are hard ceilings, not targets. A good spec typically has 3–6 files, 2–3 service functions, and a Behavior section that reads in under two minutes. When in doubt, split.

### How to split a spec

**Split by layer** (preferred when a feature touches many layers at once):

```
❌ Too large: "Appointment Requests — full stack"
   Files: service, handler, table helper, 2 Terraform modules,
          mobile screen, Angular page, email template, tests

✅ Split into:
   Spec A: "Appointment Requests — Backend"
           service function, handler, table helper, Terraform routes
   Spec B: "Appointment Requests — Mobile"
           mobile screen, navigation wiring              (depends on A)
   Spec C: "Appointment Requests — Web App"
           Angular page, service method, guard wiring    (depends on A)
```

**Split by operation** (preferred when a domain has many distinct actions):

```
❌ Too large: "Business profile — all operations"
   Functions: getProfile, updateProfile, uploadAvatar,
              listBusinesses, getBusinessById

✅ Split into:
   Spec A: "Business Profile — Read"
           getProfile, listBusinesses, getBusinessById
   Spec B: "Business Profile — Write"
           updateProfile, uploadAvatar              (depends on A)
```

**Split infra from logic** (always split when IaC is non-trivial):

```
❌ Too large: spec that wires 3 Lambdas + API Gateway + SQS + Cognito authorizer
             AND implements service functions AND writes tests

✅ Split into:
   Spec A: "Notification System — Terraform"
           SQS queue, DLQ, Lambda function, event source mapping,
           API Gateway routes, IAM roles
   Spec B: "Notification System — Service Layer"
           notification.service.ts, notification.handler.ts,
           sns.client calls, email templates, tests    (depends on A)
```

### What should stay in one spec

These can always be in a single spec without splitting:

- One service function + its DynamoDB table helper + its Lambda handler + its API Gateway route + its unit tests
- One Angular page + its Angular service method + its route registration + its guard wiring
- One email template + its render function + its test
- One Terraform module (a single, self-contained set of related resources)
- A bug fix: the broken function, the fix, the regression test

### Spec dependencies — the sequencing rule

When a phase is split into multiple specs, declare dependencies explicitly. A spec cannot be started until all specs it depends on are marked ✅ Implemented:

```
Phase 3 — Appointment Requests
  ├── Spec 3a: Backend (service + handler + Terraform)   ← no dependency within phase
  ├── Spec 3b: Mobile screen                              ← depends on 3a ✅
  └── Spec 3c: Angular page                              ← depends on 3a ✅
```

Update `IMPLEMENTATION_PLAN.md` to reflect the sub-spec dependency graph whenever a phase is split.

### Sizing check — run before writing every spec

Before writing the spec document, answer these five questions. If any answer is "yes", split before continuing.

1. Does the New/Modified Files list exceed 8 files?
2. Does implementing this spec require holding more than ~4 distinct service function implementations in working memory simultaneously?
3. Does the Behavior section describe work across more than 2 distinct architectural layers (e.g., service + Terraform + mobile + web) at once?
4. Would a fresh AI session need to read more than 3 other spec files to understand what this spec depends on?
5. Is there a natural seam in this work where the output of one part is the clear, testable input to the next?

If yes to question 5 and yes to any of 1–4: split at that seam.

---

## Spec Template

```markdown
## Spec: [Feature Name]
**FR references**: FR-XXX-NN, FR-XXX-NN
**Status**: 🔄 In Progress | ✅ Implemented | ❌ Blocked
**Prerequisites**: Phase N ✅ [, Spec Na ✅ if this is a sub-spec]
**Size check**: [N] files · [N] service functions · [N] layers · fits one session ✅  OR  → split into Spec Na, Nb

### What
[One paragraph describing what is being built — concrete, not abstract. If this is a sub-spec (e.g. "3b — Mobile"), state which parent spec it builds on and what it adds.]

### Why
[One sentence referencing the FR and the user/business need it serves]

### New / Modified Files
- `backend/src/services/xxx.service.ts` — [what changes]
- `backend/src/handlers/xxx.handler.ts` — [what changes]
- `backend/src/db/tables/xxx.table.ts` — [what changes]
- `infra/terraform/modules/xxx/main.tf` — [what changes]
- `apps/mobile/app/(customer)/xxx.tsx` — [what changes]

### Behavior
[Precise description: inputs, outputs, side effects, error conditions, DynamoDB access patterns used.
Keep this under ~400 words. If it's longer, the spec needs to be split.]

### Done When
- [ ] Unit tests pass for all service layer functions (happy path + all error cases)
- [ ] Integration tests pass for all affected Lambda routes
- [ ] Role enforcement tested: wrong role → 403
- [ ] Idempotency tested (if applicable): replay returns original record, no duplicate write
- [ ] esbuild bundle appears in `dist/lambdas/{name}/` (if new Lambda added)
- [ ] API Gateway Terraform integration block added (if new route added)
- [ ] Lambda environment variables cross-referenced against handler `process.env` reads
- [ ] Mobile screen has at least one navigation entry point
- [ ] Angular page has at least one navigation entry point
- [ ] Spec status updated to ✅ Implemented
- [ ] `IMPLEMENTATION_PLAN.md` progress tracker updated
- [ ] Related specs synced
```

---

## IMPLEMENTATION_PLAN.md — How to Use It

`IMPLEMENTATION_PLAN.md` is the coordination layer between `PROJECT.md` (the what/why) and `specs/` (the how). Consult it at the start of every session; update it at the end of every completed phase.

| Section | Purpose |
| --- | --- |
| Phase Dependency Graph | Which phases must be complete before each phase can start |
| Cross-Cutting Patterns | Error shape, log format, idempotency — defined once |
| Per-Phase Breakdown | Governing spec, exact file list, done-when checklist |
| Session Protocol | Standard opening prompt for each implementation session |
| Progress Tracker | Single-glance table: phase → status → date completed |

### Rules

- **Read it first** at the start of every session
- **Never start a phase** whose dependencies are not marked ✅ complete in the progress tracker
- **Update it immediately** when a phase's done-when checklist is fully satisfied — before ending the session
- **Do not modify the dependency graph or phase structure** without also updating `PROJECT.md` Section 11 to match — they must stay in sync
- If a spec and `IMPLEMENTATION_PLAN.md` contradict each other: the **spec is authoritative** for behavior details; `IMPLEMENTATION_PLAN.md` is authoritative for sequencing and phase status

---

## Lessons from Prior Projects (Applied to Qulene)

The following issues were encountered in a prior portfolio project (PixiCred) and the mitigations are built into Qulene's process from day one:

| Prior Issue | Mitigation in Qulene |
| --- | --- |
| Lambda handler bundles missing from esbuild config — silent deployment gap | Done When checklist must include `bundle appears in dist/lambdas/{name}/` for every new Lambda |
| API Gateway route missing from Terraform despite handler existing | Done When checklist must include Terraform integration block row for every new route |
| Lambda env vars set that the handler never reads | Cross-reference env block against `process.env` reads before marking phase complete |
| Test helpers with hardcoded unique-constrained values causing test collisions | All test factory helpers use module-level counter for any unique-constrained attribute |
| Test fixtures using specific future dates that eventually became stale | Use past dates for "before" fixtures; compute "after" values from `Date.now()` + delta |
| Frontend interface missing fields that were added to the backend type | When backend type is finalized for a phase, update mobile `api-types` package in the same PR |
| Implemented routes with no navigation entry point in the UI | Every route must have a navigation entry point as a Done When item |
| ESLint flagging intentionally unused `_`-prefixed params | `argsIgnorePattern: "^_"` and `varsIgnorePattern: "^_"` in ESLint config from scaffold |
| Terraform `profile` hardcoded — broke CI OIDC | `profile = var.aws_profile` with `default = "rmw-llc"`; `TF_VAR_aws_profile=""` in CI |
| Async flow integration test missing (only unit tested each function in isolation) | Every async phase spec must have a dedicated Done When item for the end-to-end flow test |

---

## Bootstrap & Pre-Implementation

Before any Phase 0 code is written, foundation-level AWS resources must be provisioned. The script handles this:

```bash
chmod +x infra/scripts/bootstrap.sh

# Production AWS mode (default) — uses rmw-llc profile
./infra/scripts/bootstrap.sh

# Local MiniStack mode — provisions queues, topics, secrets in MiniStack
./infra/scripts/bootstrap.sh --local
```

### What is already provisioned (bootstrap.sh VERIFIES, does not create)

These were set up before the project started and are shared/stable. `bootstrap.sh` checks they exist and emits warnings if anything is missing, then writes their IDs/ARNs to SSM for Terraform to consume.

| Resource | Detail |
| --- | --- |
| **Route 53 hosted zone** | `qulene.com` — fully configured, NS delegation complete |
| **ACM cert (dev)** | Primary `dev.qulene.com` + SANs `*.dev.qulene.com`, `*.api.dev.qulene.com`, `*.gateway.dev.qulene.com`, `*.service.dev.qulene.com`, `*.ui.dev.qulene.com` — issued, ARN stored in SSM at `/qulene/dev/acm_certificate_arn` |
| **ACM cert (prod)** | Primary `qulene.com` + SANs `*.qulene.com`, `*.api.qulene.com`, `*.gateway.qulene.com`, `*.service.qulene.com`, `*.ui.qulene.com` — issued, ARN stored in SSM at `/qulene/prod/acm_certificate_arn` |
| **SES domain identity** | `qulene.com` — verified, DKIM records in Route 53 |
| **SES sender** | `no-reply@qulene.com` — authorised via the verified domain identity (no separate email-identity verification required) |
| **`GitHubActionsDevOpsDeployRole`** | Shared org-level IAM role — trust policy covers `ryanwaite28/*`; already exists, never touch it |

### What bootstrap.sh provisions (idempotent — safe to re-run)

**Terraform remote state** (S3 + DynamoDB lock table, per env):
- `qulene-dev-tf-state` / `qulene-prod-tf-state` — versioned, encrypted, public-access-blocked
- `qulene-dev-tf-locks` / `qulene-prod-tf-locks` — DynamoDB PAY_PER_REQUEST

**Lambda packages buckets** (CI uploads ZIPs here before `terraform apply`):
- `qulene-dev-lambda-packages` / `qulene-prod-lambda-packages` — versioned, encrypted

**SSM Parameters** (Terraform reads these at plan time via `data "aws_ssm_parameter"`):
```
/qulene/dev/acm_certificate_arn     ← ARN of dev ACM cert
/qulene/prod/acm_certificate_arn    ← ARN of prod ACM cert
/qulene/hosted_zone_id              ← Route 53 hosted zone ID for qulene.com
/qulene/dev/cognito_user_pool_id    ← written after Cognito is provisioned by Terraform
/qulene/dev/cognito_app_client_id   ← written after Cognito is provisioned by Terraform
/qulene/prod/cognito_user_pool_id   ← written after Cognito is provisioned by Terraform
/qulene/prod/cognito_app_client_id  ← written after Cognito is provisioned by Terraform
```

**Secrets Manager** (runtime secrets, JSON blob per env):
- `qulene-dev-secrets` / `qulene-prod-secrets`
- Initial keys written by bootstrap: `{ "SNS_TOPIC_ARN": "PLACEHOLDER", "SES_FROM_EMAIL": "no-reply@qulene.com" }`
- Remaining keys (Cognito client secret, etc.) written by Terraform outputs post-apply
- Lambda handlers call `GetSecretValue` at cold start; never pass secrets through env vars directly

**GitHub Actions secrets** (via `gh` CLI if available, otherwise prints manual instructions):
- Repo secret: `AWS_ROLE_ARN` = ARN of `GitHubActionsDevOpsDeployRole`
- Repo secret: `AWS_REGION` = `us-east-1`
- Environments created: `dev`, `prod`, `prod-approval`

**Local mode** (`--local`): provisions all MiniStack resources (SQS queues + DLQs, SNS topic, SNS→SQS subscriptions, S3 media bucket, Secrets Manager stubs, SES identity) using dummy credentials against `http://localhost:4566`.

### SSM ↔ Terraform integration pattern

Terraform modules **never hardcode** ARNs, IDs, or environment-specific values. They read from SSM:

```hcl
data "aws_ssm_parameter" "acm_cert_arn" {
  name = "/qulene/${var.environment}/acm_certificate_arn"
}

data "aws_ssm_parameter" "hosted_zone_id" {
  name = "/qulene/hosted_zone_id"
}

resource "aws_cloudfront_distribution" "app" {
  viewer_certificate {
    acm_certificate_arn = data.aws_ssm_parameter.acm_cert_arn.value
  }
}
```

After `terraform apply` provisions Cognito, a post-apply step writes the new pool/client IDs back to SSM so downstream modules and the mobile/web apps can read them without hardcoding.

### Manual steps after bootstrap (printed by the script)

1. Add `AWS_ROLE_ARN` as a secret to each GitHub environment (`dev`, `prod`, `prod-approval`) if `gh` CLI was not available or not authenticated
2. Add required reviewers to the `prod-approval` GitHub environment: **Repo → Settings → Environments → prod-approval**
3. Copy `.env.example` to `.env` and fill in local dev values

---

## Session Protocol

Paste this prompt at the start of any new implementation session:

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