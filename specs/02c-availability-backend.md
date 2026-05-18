## Spec: Phase 2c — Backend availability windows
**FR references**: FR-AVL-01, FR-AVL-02, FR-AVL-03, FR-AVL-04, FR-AVL-05
**Status**: ✅ Implemented
**Prerequisites**: 1b ✅
**Size check**: 5 files · 3 service functions · 1 layer · 3 routes · fits one session ✅

### What
Implement availability window CRUD for businesses. Windows are recurring weekly time blocks (dayOfWeek + startTime + endTime). The handler is added to the existing `lambda-businesses` deployment from Phase 2a — no new Lambda, only new routes — to avoid extra cold-start overhead for a closely related domain.

### Why
FR-AVL-01–05: customers browsing a business need to see when the business operates. Required by Phase 2e (customer browse renders windows) and Phase 3d (customer appointment form suggests times against windows).

### New / Modified Files
- `backend/src/db/tables/availability-windows.table.ts` — `listByBusiness` (Query `businessId-index`), `putWindow`, `deleteWindow`, `countByBusiness`, `countByBusinessAndDay`
- `backend/src/services/availability.service.ts` — `listForBusiness`, `addWindow`, `removeWindow`
- `backend/src/handlers/availability.handler.ts` — exports route handlers added to `lambda-businesses` deployment from Phase 2a (routes: `GET /businesses/:businessId/availability`, `POST /businesses/me/availability`, `DELETE /businesses/me/availability/:windowId`)
- `infra/terraform/modules/dynamodb-availability-windows/main.tf` — table `qulene-{env}-availability-windows` (PK: `windowId`, SK: `businessId`); GSI `businessId-index` (PK: `businessId`, projection ALL)
- tests: `backend/src/services/__tests__/availability.service.test.ts`

### Behavior
**`listForBusiness(dynamo, businessId)`**: Query `businessId-index`; returns all windows for the business. Public — no auth required.

**`addWindow(dynamo, { userId, role, input })`**: handler enforces role=BUSINESS. Validates `dayOfWeek` ∈ [0..6], `startTime`/`endTime` match `^[0-2]\d:[0-5]\d$`, `endTime > startTime`. Service calls `countByBusiness(businessId)`; if ≥ 14 → 422 `LIMIT_REACHED` (FR-AVL-02 ceiling). Calls `countByBusinessAndDay(businessId, dayOfWeek)`; if ≥ 2 → 422 `DAY_LIMIT_REACHED`. PutItem with `windowId=uuid()`.

**`removeWindow(dynamo, { userId, role, windowId })`**: handler enforces BUSINESS. Loads window by PK; if owner mismatch → 403. DeleteItem (physical delete; windows are not referenced by other records, so soft-delete unnecessary).

### Done When
- [x] `GET /businesses/:businessId/availability` returns windows (public)
- [x] `POST /businesses/me/availability` blocked at 14 total / 2 per day
- [x] `DELETE` ownership-checked
- [x] CUSTOMER → 403 on write routes
- [x] Routes added to existing `lambda-businesses` Terraform integration
- [x] Unit tests cover all 3 functions + all error cases
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated

### Implementation Notes
- Table schema corrected: `windowId` is PK only (hash key only, no sort key). Spec said `(PK: windowId, SK: businessId)` but `getWindowById(windowId)` requires both keys with a composite key — impractical with path-only windowId.
- `availability.handler.ts` exports individual route handler functions (`handleListAvailability`, `handleAddWindow`, `handleRemoveWindow`). `business.handler.ts` imports them and routes via switch cases. No new Lambda — all routes go through the existing `lambda-businesses` integration.
- `AVAILABILITY_WINDOWS_TABLE` added to `lambda_businesses` env block in `dev/main.tf`.
- New IAM policy `lambda_businesses_availability_dynamodb` grants DDB access to the availability-windows table. Kept separate from the existing `lambda_businesses_dynamodb` policy for clarity.
- `countByBusinessAndDay` uses `FilterExpression` on the GSI — acceptable because per-day count is bounded (max 7 days × 2 windows = 14 items max returned by the GSI query before filtering).
