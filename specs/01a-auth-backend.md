## Spec: Phase 1a — Backend auth (service + users table + handler + esbuild)
**FR references**: FR-AUTH-01, FR-AUTH-02, FR-AUTH-06, FR-AUTH-07
**Status**: ⬜ Not Started
**Prerequisites**: 0a ✅
**Size check**: 8 files · 1 service function group (createOrSyncUserProfile) · 1 layer (backend) · fits one session ✅

### What
Implement the `POST /auth/profile` endpoint that runs immediately after Cognito signup completes. The mobile/web client has just created a Cognito identity; this endpoint creates the corresponding DynamoDB `users` record (or returns the existing one on re-call). Establishes the foundational backend infrastructure: DynamoDB DocumentClient singleton, the first table helper, the auth middleware that extracts JWT claims, and the esbuild config.

### Why
FR-AUTH-01 requires storing app-level user data (firstName, lastName, role, unreadNotificationCount) separately from Cognito credentials. Cognito holds identity; DynamoDB holds profile. Per CLAUDE.md Cognito Integration Rules, the mobile app must handle the case where Cognito succeeded but the profile call failed — so this endpoint is idempotent on re-call.

### New / Modified Files
- `backend/src/db/dynamo.client.ts` — `DynamoDBDocumentClient` factory; reads `DYNAMODB_ENDPOINT` env var (MiniStack vs AWS); exported `createDynamoClient()`
- `backend/src/db/tables/users.table.ts` — `getUserById`, `getUserByEmail` (queries `email-index` GSI), `putUser`, `updateUserName`
- `backend/src/services/auth.service.ts` — `createOrSyncUserProfile(dynamo, input)` — checks if user exists by Cognito `sub`; if not, writes user record with `unreadNotificationCount: 0`, `createdAt`/`updatedAt` now; returns the user (existing or new)
- `backend/src/middleware/auth.middleware.ts` — `extractClaims(event)` returns `{ userId, role, email }` from `event.requestContext.authorizer.jwt.claims`; `requireRole(claims, expectedRole)` returns 403 envelope if mismatch
- `backend/src/handlers/auth.handler.ts` — routes `POST /auth/profile`; calls `extractClaims` → `auth.service.createOrSyncUserProfile` → returns `{ data: user }`
- `backend/esbuild.config.ts` — builds one bundle per Lambda entry; outputs to `dist/lambdas/{name}/index.js`; loader for `.hbs` as text (reserved for Phase 5b but config from day one); registers `auth` entry pointing at `src/handlers/auth.handler.ts`
- `backend/src/services/__tests__/auth.service.test.ts` — unit tests: happy path (new user), idempotency (existing user returned, no duplicate write), missing claim (422), invalid role (422)
- `backend/tests/integration/auth.handler.test.ts` — integration against MiniStack: invoke handler with mock APIGW event carrying valid Cognito claims; assert user record created; second invoke returns same record without duplicate write

### Behavior
**Input shape (handler layer)**: APIGW v2 event with `event.body` JSON `{ firstName, lastName }`; claims `{ sub, custom:role, email }` injected by API Gateway authorizer (Phase 1b). Shape validation: `firstName` and `lastName` non-empty strings, max 50 chars; role one of `BUSINESS`|`CUSTOMER`.

**Business logic (service layer)**: `createOrSyncUserProfile(dynamo, { userId, email, role, firstName, lastName })`:
1. `getUserById(dynamo, userId)` → if exists, return it (idempotent re-call after failed first attempt)
2. Else `putUser` with new record: `{ userId, email, firstName, lastName, role, unreadNotificationCount: 0, createdAt: now, updatedAt: now }`
3. Return the new record
4. Structured log: `{ level: 'info', action: 'createOrSyncUserProfile', durationMs }`

**Error cases**: missing `userId` claim → 401; missing `custom:role` → 422; role is not BUSINESS/CUSTOMER → 422.

**Note on FR-AUTH-02 (email uniqueness)**: enforced by Cognito itself (User Pool config in Phase 1b). The DynamoDB `email-index` GSI exists for future lookup needs (e.g., admin tooling) but the unique constraint is upstream.

### Done When
- [ ] Unit tests pass: happy + idempotent re-call + missing claim + invalid role
- [ ] Integration test passes against MiniStack
- [ ] esbuild produces `dist/lambdas/auth/index.js`
- [ ] Handler is thin: only `extractClaims`, shape validation, service call, envelope wrap
- [ ] All DynamoDB calls go through `users.table.ts`; no DocumentClient calls in `auth.service.ts`
- [ ] Spec status updated to ✅ Implemented
- [ ] `IMPLEMENTATION_PLAN.md` progress tracker updated
