## Spec: Phase 3a — Backend appointment tables (requests + notifications + TF)
**FR references**: FR-APT-01 (table foundation), FR-NOTIF-01 (table foundation)
**Status**: ✅ Implemented
**Prerequisites**: 2a ✅, 2b ✅
**Size check**: 5 files · 0 service functions · 1 layer (TF + table helpers + shared types) · 2 new Terraform resource groups · fits one session ✅

### What
Provision the two DynamoDB tables that the entire booking system depends on: `appointment-requests` (with all four GSIs from PROJECT.md Section 7.5) and `notifications` (with `userId-createdAt-index`). Add the SNS client wrapper that Phase 3b will use to publish events. Add the shared `api-types` definitions for both tables so consumers (backend and clients) share the contract.

### Why
Carved out as a separate sub-phase so Phase 3b can focus on business logic without simultaneously authoring 4 GSIs across 2 tables. The `idempotencyKey-index` GSI must exist before any appointment write can be safely tested for idempotency replay (FR-NFR-04).

### New / Modified Files
- `backend/src/db/tables/appointment-requests.table.ts` — `getRequestById`, `getRequestByIdempotencyKey` (Query `idempotencyKey-index`), `listByCustomer` (Query `customerId-index`), `listByBusinessAndStatus` (Query `businessId-status-index`), `listByServiceAndStatus` (Query `serviceId-index` filter status), `putRequest`, `updateRequestStatus`
- `backend/src/db/tables/notifications.table.ts` — `getNotificationById`, `listByUser` (Query `userId-createdAt-index`), `putNotification`, `markRead`
- `backend/src/clients/sns.client.ts` — `createSnsClient()`; `publishEvent(sns, { eventType, payload })` writes envelope to `SNS_TOPIC_ARN`
- `infra/terraform/modules/dynamodb-appointment-requests/main.tf` — table per PROJECT.md Section 7.5 with all 4 GSIs (`businessId-status-index`, `customerId-index`, `serviceId-index`, `idempotencyKey-index`), all projection ALL
- `infra/terraform/modules/dynamodb-notifications/main.tf` — table per Section 7.7 with `userId-createdAt-index` (projection ALL)
- `packages/api-types/src/appointment.types.ts` (new) + `packages/api-types/src/notification.types.ts` (new) + update `index.ts` — shared types: `AppointmentRequest`, `AppointmentStatus`, `Notification`, `NotificationType`

### Behavior
Tables provisioned in both MiniStack (via a new entry in `infra/ministack/01-seed.sh` that creates the tables locally) and AWS dev (via Terraform apply). All GSIs created with projection ALL so list endpoints can return full records without secondary reads. The SNS client publishes to the `SNS_TOPIC_ARN` env var; in MiniStack that resolves to the locally created topic.

No service-layer functions in this phase — table helpers only. Idempotent re-runs of Terraform apply produce no drift.

### Done When
- [x] `terraform apply` provisions both tables with all 5 GSIs total
- [x] MiniStack 01-seed.sh extended to create both tables locally (so 3a unblocks local dev for 3b)
- [x] `api-types` package exports `AppointmentRequest`, `AppointmentStatus`, `Notification`, `NotificationType`
- [x] Table helper unit tests pass (against mocked DocumentClient)
- [x] No raw DocumentClient calls outside `db/tables/`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated

### Implementation Notes
- `sns.client.ts` already existed from Phase 2b with `createSnsClient()`. Phase 3a added `publishEvent(sns, eventType, payload)` which wraps `PublishCommand` with the standard SNS envelope `{ eventType, payload }` per CLAUDE.md Async Event Contracts section.
- `SnsEventType = NotificationType` — all 6 event types including `REQUEST_RECEIVED` are already in `NotificationType`; no separate union needed.
- `appointment.types.ts` and `notification.types.ts` created as separate files in `packages/api-types/src/`; re-exported from `index.ts` via `export type { ... } from '...'`.
- `listByService` accepts optional `statusFilter` — when absent, returns all requests for the service (needed for Phase 3c soft-delete cascade).
- `listByCustomer` and `listByUser` use `ScanIndexForward: false` (newest first).
- Table helper unit tests in `src/db/tables/__tests__/` (new directory): 17 tests across 2 files, all passing.
- Supporting changes not listed in spec's file set: `backend/vitest.config.ts` (added 2 table env vars), `infra/terraform/envs/dev/main.tf` (2 new module blocks), `infra/ministack/01-seed.sh` (2 new DynamoDB table creates with GSIs).
