## Spec: Phase 3b — Backend appointment customer flow (create + idempotency + cancel + list)
**FR references**: FR-APT-01, FR-APT-02, FR-APT-03, FR-APT-04, FR-APT-09, FR-APT-11, NFR-04 (idempotency)
**Status**: ✅ Implemented
**Prerequisites**: 3a ✅
**Size check**: 5 files · 3 service functions · 1 layer · 3 routes · fits one session ✅

### What
The customer-facing slice of appointment lifecycle: submit a request (idempotency-protected), cancel a request, list own requests. Publishes `REQUEST_RECEIVED` and `REQUEST_CANCELLED` SNS events. Phase 5c will consume them and send emails; Phase 4a will modify cancel to also call waitlist promotion.

### Why
FR-APT-01/02/03/04/09/11 form the customer's complete read+write surface against appointments. NFR-04 mandates idempotency on creation to handle network retries safely.

### New / Modified Files
- `backend/src/services/appointment.service.ts` (new) — `createRequest`, `cancelRequest`, `listCustomerRequests` (3 functions ≤ 4 limit ✅)
- `backend/src/handlers/appointment.handler.ts` — routes `POST /appointments`, `DELETE /appointments/:requestId`, `GET /appointments/me`
- `infra/terraform/modules/lambda-appointments/main.tf` — Lambda + IAM (dynamodb:* on appointment-requests + notifications tables; sns:Publish on events topic)
- `infra/terraform/envs/dev/main.tf` (modify) — instantiate module + 3 routes
- tests: `backend/src/services/__tests__/appointment.service.test.ts` + `backend/tests/integration/appointment.handler.test.ts`

### Behavior
**`createRequest(dynamo, sns, { customerId, serviceId, proposedAt, notes?, idempotencyKey })`**:
1. `assertUuid(idempotencyKey)` — handler-level shape validation already done; service re-asserts for safety
2. `existing = getRequestByIdempotencyKey(dynamo, customerId, idempotencyKey)` — if found, return existing (skip all remaining steps including SNS publish; this is the contract)
3. `parsed = parseISO(proposedAt)`; if `parsed <= now()` → throw `UNPROCESSABLE` (FR-APT-02)
4. `service = getServiceById(dynamo, serviceId)`; if missing or `status=DELETED` → 404; capture `businessId`
5. Query `listByCustomer(dynamo, customerId)` filter `serviceId == this && status in [PENDING, ACCEPTED]`; if any → 409 `CONFLICT` (FR-APT-03)
6. `putRequest({ requestId: uuid(), customerId, businessId, serviceId, proposedAt, notes, status: 'PENDING', idempotencyKey, createdAt, updatedAt })`
7. Write `notifications` record for business user: `type: REQUEST_RECEIVED`, `userId: businessId`, `relatedId: requestId`, `message: "{customerName} requested {serviceName} at {time}"`, atomic `ADD unreadNotificationCount :one` on users table
8. `publishEvent(sns, { eventType: 'REQUEST_RECEIVED', payload: { appointmentRequestId: requestId } })`
9. Return new record
10. Structured log

**`cancelRequest(dynamo, sns, { userId, role, requestId })`**: handler enforces CUSTOMER. Service loads request; if `customerId !== userId` → 403. If `status` not in [`PENDING`, `ACCEPTED`] → 422. Updates status to `CANCELLED`, `updatedAt=now`. Writes notification for business; publishes `REQUEST_CANCELLED`. **TODO comment in code**: Phase 4a will also call `waitlist.service.promoteOldestForService(serviceId)` here.

**`listCustomerRequests(dynamo, { customerId, cursor? })`**: Query `customerId-index` PK=customerId, sorted by `createdAt` descending; paginated.

### Done When
- [x] Idempotency: same `idempotencyKey` replay returns original record; no duplicate write; no second SNS publish (verified by counting publish calls in test)
- [x] FR-APT-02: past `proposedAt` → 422
- [x] FR-APT-03: duplicate active request for same service → 409
- [x] FR-APT-09: cancel ownership-enforced (other customer → 403); already-final status → 422
- [x] CUSTOMER → only own data; ownership verified across all routes
- [x] `dist/lambdas/appointments/index.js` bundle present (esbuild entry added)
- [x] API GW integration blocks added for 3 routes; Lambda env vars match `process.env.*`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated

### Implementation Notes
- `users.table.ts` extended with `incrementUnreadCount(dynamo, userId)` — atomic `ADD unreadNotificationCount :one` (supporting change not in spec file list).
- `esbuild.config.ts` extended with `appointments: 'src/handlers/appointment.handler.ts'` entry (supporting change).
- `cancelRequest` has a `// TODO: Phase 4a` comment marking where waitlist promotion will be wired.
- `getRequestByIdempotencyKey` signature is `(dynamo, idempotencyKey)` (no customerId param); service does a post-lookup `existing.customerId === input.customerId` guard to prevent cross-customer idempotency key collisions.
- `listByCustomer` called with `DUPLICATE_CHECK_LIMIT = 200` for the FR-APT-03 duplicate check — acceptable for a portfolio app where customers won't have thousands of requests.
- `lambda-appointments/main.tf` is a self-contained module (wraps shared lambda module) with all DynamoDB + SNS IAM policies; takes table names/ARNs as variables.
- 15/15 unit tests pass; integration tests in `tests/integration/appointment.handler.test.ts` cover all Done When scenarios (require MiniStack).
