## Spec: Phase 4a — Backend waitlist (service + table + handler + TF + promotion wire-in)
**FR references**: FR-WAIT-01, FR-WAIT-02, FR-WAIT-03, FR-WAIT-04, FR-WAIT-05, FR-WAIT-06, FR-APT-07
**Status**: ✅ Implemented
**Prerequisites**: 3c ✅
**Size check**: 7 files · 4 service functions (join, leave, promoteOldestForService, listBusinessWaitlist + listCustomerWaitlist combined as one read; counting as 4) · 1 layer · 4 routes · fits one session ✅

### What
Implement the waitlist domain: join, leave, list (per customer and per business+service), and the promotion routine that fires from appointment decline/cancel. Also modifies `appointment.service.ts` from Phases 3b/3c to call `promoteOldestForService` in `cancelRequest` and `declineRequest`, closing the loop deferred by those phases.

### Why
FR-WAIT-01–06 + FR-APT-07: customers who can't get a current slot must be able to queue; when a slot opens (decline/cancel), the oldest waitlister is invited. Without this, declines are dead-end events.

### New / Modified Files
- `backend/src/db/tables/waitlist-entries.table.ts` — `getEntryById`, `getActiveByCustomerAndService` (Query `customerId-index` filter `serviceId == ? && status='ACTIVE'`), `listActiveByService` (Query `serviceId-status-index` PK=serviceId, SK begins_with 'ACTIVE'), `putEntry`, `updateEntryStatus`, `listByCustomer`
- `backend/src/services/waitlist.service.ts` — `joinWaitlist`, `leaveWaitlist`, `listCustomerEntries`, `listBusinessWaitlist`, `promoteOldestForService` (internal — not exposed as a route; called by appointment.service)
- `backend/src/handlers/waitlist.handler.ts` — routes `POST /waitlist`, `GET /waitlist/me`, `DELETE /waitlist/:entryId`, `GET /businesses/me/waitlist/:serviceId`
- `backend/src/services/appointment.service.ts` (modify) — `declineRequest` and `cancelRequest` now call `waitlist.service.promoteOldestForService(dynamo, sns, { serviceId })` after publishing the decline/cancel event
- `infra/terraform/modules/dynamodb-waitlist-entries/main.tf` — table per Section 7.6 with `serviceId-status-index` (PK serviceId, SK createdAt for oldest-first promotion) and `customerId-index` (PK customerId)
- `infra/terraform/modules/lambda-waitlist/main.tf` — Lambda + IAM (dynamodb:* on waitlist + notifications + appointment-requests tables for cross-read; sns:Publish)
- tests: `backend/src/services/__tests__/waitlist.service.test.ts` + `backend/tests/integration/waitlist.flow.test.ts` (the full E2E: customer A submits → business declines → customer B (waitlisted) promoted → notification + SNS published)

### Behavior
**`joinWaitlist(dynamo, { customerId, serviceId })`**: validate `serviceId` exists + not DELETED (404 if so); call `getActiveByCustomerAndService` — if found → 409 (FR-WAIT-02). PutItem with `entryId=uuid()`, `status='ACTIVE'`, fetch `businessId` from the service for denormalization, `createdAt=now`.

**`leaveWaitlist(dynamo, { userId, role, entryId })`**: handler enforces CUSTOMER. Load entry; ownership check (403). UpdateItem `status='REMOVED'`, `updatedAt=now` (FR-WAIT-03).

**`promoteOldestForService(dynamo, sns, { serviceId })`** (internal):
1. Query `serviceId-status-index` with PK=serviceId, SK begins_with `'ACTIVE'` (composite SK is `status#createdAt` for sort), Limit 1
2. If none → return without effect
3. UpdateItem on found entry: `status='PROMOTED'`, `updatedAt=now`
4. Write `notifications` row for `customerId`: type `WAITLIST_PROMOTED`, `relatedId=serviceId`, message includes business name
5. Atomic `ADD unreadNotificationCount :one` on user
6. Publish SNS `{ eventType: 'WAITLIST_PROMOTED', payload: { waitlistEntryId } }`
7. **Race tolerance documented**: two simultaneous declines for the same service could both promote the same entry — accepted for portfolio scope. A conditional `UpdateItem` (only-if `status='ACTIVE'`) is added so only the first wins; the second is a no-op (return without effect)

**`listBusinessWaitlist(dynamo, { userId, role, serviceId })`**: handler enforces BUSINESS; service verifies the business owns the service (lookup, 403 if mismatch); returns active entries with count + customer-first-name lookups.

**Appointment decline/cancel wire-in**: at the end of `declineRequest` and `cancelRequest` in `appointment.service.ts`, after SNS publish, call `await promoteOldestForService(dynamo, sns, { serviceId: request.serviceId })`. Failures here are caught + logged but do not fail the original operation (FR-NOTIF-06 principle).

### Done When
- [x] All 4 routes work with role + ownership enforcement
- [x] FR-WAIT-02 duplicate join → 409
- [x] Appointment decline triggers promotion → second customer gets notification + event published
- [x] Appointment cancel triggers promotion same way
- [x] Concurrent-decline race: only first decline successfully promotes (conditional UpdateItem)
- [x] Integration test exercises the full chain
- [x] `dist/lambdas/waitlist/index.js` bundle present; API GW routes added
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
