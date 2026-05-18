## Spec: Phase 2b — Backend services (offerings)
**FR references**: FR-SVC-01, FR-SVC-02, FR-SVC-03, FR-SVC-04, FR-SVC-05
**Status**: ✅ Implemented
**Prerequisites**: 1b ✅
**Size check**: 6 files · 4 service functions · 1 layer · 4 routes · fits one session ✅

### What
Implement service (offering) CRUD endpoints for businesses and the public read endpoint for customers. Provision the `services` DynamoDB table and the `lambda-services` Lambda. Soft-delete sets `status=DELETED`; the cascade to existing appointment requests (FR-SVC-05) is wired in Phase 3c when appointment cancellation is implemented (this phase emits the `SERVICE_REMOVED` SNS event; the consumer Lambda Phase 5c routes it to the email + cancellation flow).

### Why
FR-SVC-01–05 define the catalog of bookable offerings — the foundational entity that appointment requests reference. Phase 3 cannot proceed without this table existing.

### New / Modified Files
- `backend/src/db/tables/services.table.ts` — `getServiceById`, `listByBusinessActive` (Query `businessId-index` filter `status=ACTIVE|PAUSED`), `countActiveByBusiness`, `putService`, `updateService`, `setServiceStatus`
- `backend/src/services/service.service.ts` — `listActiveByBusiness`, `createService`, `updateService`, `softDeleteService` (4 service functions ≤ 4 limit ✅; publishes `SERVICE_REMOVED` to SNS on delete)
- `backend/src/handlers/service.handler.ts` — routes `GET /businesses/:businessId/services`, `POST /businesses/me/services`, `PATCH /businesses/me/services/:serviceId`, `DELETE /businesses/me/services/:serviceId`
- `infra/terraform/modules/dynamodb-services/main.tf` — table `qulene-{env}-services` (PK: `serviceId`, SK: `businessId`); GSI `businessId-index` (PK: `businessId`, SK: `createdAt`, projection ALL)
- `infra/terraform/modules/lambda-services/main.tf` — Lambda + IAM (dynamodb:* on services table, sns:Publish on events topic)
- tests: `backend/src/services/__tests__/service.service.test.ts` + `backend/tests/integration/service.handler.test.ts`

### Behavior
**`listActiveByBusiness(dynamo, businessId)`**: Query `businessId-index` with PK = businessId, returns items where `status != 'DELETED'`. Sorted by `createdAt` ascending. Paginated.

**`createService(dynamo, sns, { userId, role, input })`** (handler enforces role=BUSINESS): validates `name` (1–100 chars), `description` (≤ 1000 chars), `durationMinutes` (15–480), `price` (integer cents ≥ 0), `status` ∈ {`ACTIVE`,`PAUSED`}. Calls `countActiveByBusiness(businessId)`; if ≥ 20 → 422 `LIMIT_REACHED` (FR-SVC-02). PutItem with `serviceId = uuid()`, `createdAt/updatedAt = now`.

**`updateService(dynamo, { userId, role, serviceId, updates })`**: handler enforces BUSINESS; service checks ownership (`existing.businessId === userId`), 403 if mismatch. Merges allowed fields (`name`, `description`, `durationMinutes`, `price`, `status`); updates `updatedAt`.

**`softDeleteService(dynamo, sns, { userId, role, serviceId })`**: ownership check; SetItem `status=DELETED`, `updatedAt=now`; publishes SNS `{ eventType: 'SERVICE_REMOVED', payload: { serviceId } }`. The consumer Lambda (Phase 5c) handles the FR-SVC-05 cascade (cancels affected PENDING/ACCEPTED appointments + notifies customers).

**Note on FR-BIZ-05 `isActive`**: this phase does not back-update `business-profiles.isActive` on service create/delete — the responsibility for that cross-table update is documented as a follow-up in Phase 2a's spec. For portfolio scale (low volume), `business.service.isActive` can be lazily recomputed in `listActiveBusinesses`.

### Done When
- [x] `GET /businesses/:businessId/services` returns active services
- [x] `POST /businesses/me/services` blocked at 20 active (FR-SVC-02)
- [x] `PATCH /businesses/me/services/:serviceId` ownership-enforced (403 on other business)
- [x] `DELETE` sets `status=DELETED` and publishes `SERVICE_REMOVED` SNS event
- [x] CUSTOMER → 403 on business routes (regression test)
- [x] `dist/lambdas/services/index.js` bundle present
- [x] API GW integration blocks added for all 4 routes
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated

### Implementation Notes
- Table schema corrected: `serviceId` is PK only (no sort key). Spec said `(PK: serviceId, SK: businessId)` which would require businessId for GetItem — impractical with path-only serviceId.
- SNS topic `qulene-{env}-events` provisioned inline in `dev/main.tf` (Phase 5a was the designated owner, but Phase 2b is the first publisher). Phase 5a's scope adjusted to SQS queues + subscriptions + notification Lambda.
- `SNS_TOPIC_ARN` passed as Lambda env var (not Secrets Manager) — topic ARN is not sensitive. Flagged as tech debt for Phase 9c if needed.
- `sns.client.ts` added to `backend/src/clients/` (follows S3 client pattern from Phase 2a).
- `vitest.config.ts` updated with `SERVICES_TABLE`, `SNS_TOPIC_ARN`, `SNS_ENDPOINT`, `BUSINESS_PROFILES_TABLE`.
