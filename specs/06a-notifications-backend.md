## Spec: Phase 6a — Backend notifications endpoints (list + mark read + unreadCount + TF)
**FR references**: FR-NOTIF-03, FR-NOTIF-04, FR-NOTIF-05
**Status**: ⬜ Not Started
**Prerequisites**: 5c ✅ (notifications table populated; this phase adds read endpoints)
**Size check**: 6 files · 4 service functions (listNotifications, markRead, getMyProfile, updateMyProfile) · 1 layer · 4 routes · fits one session ✅

### What
Implement the user-facing read endpoints for notifications + the user profile management endpoints. `GET /notifications` paginated, `PATCH /notifications/:id/read` atomically decrements `unreadNotificationCount`, `GET /users/me` returns the profile including the unread badge count, `PATCH /users/me` updates name. Deploys a new `lambda-users` Lambda.

### Why
FR-NOTIF-03/04/05 + the basic profile management that completes the user surface. Without these, the unread badge in the mobile app has no source data.

### New / Modified Files
- `backend/src/services/notification.service.ts` (extend Phase 5c) — `listForUser(dynamo, { userId, cursor? })`, `markAsRead(dynamo, { userId, notificationId })` (atomic decrement of unreadNotificationCount only if `isRead` was false)
- `backend/src/services/user.service.ts` (new) — `getMyProfile(dynamo, userId)`, `updateMyName(dynamo, { userId, firstName, lastName })`
- `backend/src/handlers/user.handler.ts` (new) — routes `GET /users/me`, `PATCH /users/me`
- `backend/src/handlers/notification.handler.ts` (extend; now hosts both SQS consumer and HTTP routes — esbuild creates two bundles: `notification` for SQS and `notification-http` for API routes) — actually cleaner: split HTTP routes into the user.handler module which is in `lambda-users`. Routes `GET /notifications`, `PATCH /notifications/:notificationId/read` also go in lambda-users to consolidate user-scoped reads.
- `infra/terraform/modules/lambda-users/main.tf` — Lambda + IAM (dynamodb:GetItem/UpdateItem/Query on users + notifications tables)
- tests: `backend/src/services/__tests__/notification.service.test.ts` (extend) + `backend/src/services/__tests__/user.service.test.ts` + `backend/tests/integration/notification-read.test.ts`

### Behavior
**`listForUser(dynamo, { userId, cursor? })`**: Query `userId-createdAt-index` PK=userId, sorted by createdAt descending, paginated via LastEvaluatedKey. Returns `{ data: [...notifications], nextCursor }`.

**`markAsRead(dynamo, { userId, notificationId })`**:
1. GetItem notification; if missing → 404; if `userId !== input.userId` → 403
2. If `isRead === true` → return existing (idempotent, no decrement)
3. Two-step transaction (NOT TransactWriteItems for portfolio simplicity — sequential UpdateItems, document race tolerance):
   a. UpdateItem notification `isRead=true`, condition `isRead = false` (so a parallel mark-read doesn't double-decrement)
   b. If step (a) succeeded → UpdateItem users `ADD unreadNotificationCount :neg_one`, expression `IF NOT_EXISTS(unreadNotificationCount, :zero)` guard so count never goes negative
4. Return updated notification

**`getMyProfile(dynamo, userId)`**: GetItem users; returns `{ userId, email, firstName, lastName, role, unreadNotificationCount, createdAt, updatedAt }`.

**`updateMyName(dynamo, { userId, firstName, lastName })`**: validates non-empty + ≤ 50 chars; UpdateItem; returns updated record. Note: email + role are NOT updatable (Cognito controls email; role is immutable per FR-AUTH per CLAUDE.md Cognito Integration Rules).

### Done When
- [ ] `GET /notifications` paginated by `userId-createdAt-index`
- [ ] `PATCH /notifications/:id/read` decrements unread count atomically (not twice on parallel calls; verified in test)
- [ ] `GET /users/me` returns full profile including `unreadNotificationCount`
- [ ] `PATCH /users/me` updates name only; email/role rejected with 422
- [ ] CUSTOMER and BUSINESS both can call all 4 routes (no role discrimination here)
- [ ] `dist/lambdas/users/index.js` bundle present; API GW integration blocks for 4 routes
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
