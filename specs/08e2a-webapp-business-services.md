## Spec: Phase 8e2-a — Web business services management page
**FR references**: FR-WEBAPP-13 (`/business/services`), FR-SVC-01, FR-SVC-02, FR-SVC-03
**Status**: ✅ Implemented
**Prerequisites**: 2b ✅, 8c ✅ (Service type defined in BusinessService), 8e1-b ✅
**Size check**: 3 files · 4 service functions · 1 layer (Angular source) · 1 screen · fits one session ✅

### What
Implement `/business/services` as a real page. Adds `ServiceManagementService` with four methods. The page lists the business's own services with CRUD operations: create via modal, edit via pre-filled modal, pause/resume toggle, and soft-delete with confirmation. Price is entered in dollars and converted to integer cents before sending to the API.

**Note**: 8e2 is split into 8e2-a (this spec) and 8e2-b (availability page) because the combined service function count exceeds 4. 8e2-b depends on this spec.

### Why
FR-SVC-01/02/03: business users must be able to create, update, and delete their own services from the web app.

### New / Modified Files
- `apps/web-app/src/app/services/service-management.service.ts` *(new)* — `listMyServices(businessId)`, `createService(body)`, `updateService(serviceId, updates)`, `softDeleteService(serviceId)`; imports `Service` type from `business.service.ts`
- `apps/web-app/src/app/pages/business-services.component.ts` *(new)* — service list + create/edit modal + delete confirmation + pause/resume toggle; business top-nav strip
- `apps/web-app/src/app/app.routes.ts` *(modify from 8e1-b)* — swap `PlaceholderComponent` → `BusinessServicesComponent` for `/business/services`

### Behavior
**`ServiceManagementService`**: listMyServices → `GET /businesses/:businessId/services`; createService → `POST /businesses/me/services`; updateService → `PATCH /businesses/me/services/:serviceId`; softDeleteService → `DELETE /businesses/me/services/:serviceId`. All prices in integer cents.

**`BusinessServicesComponent`**: userId decoded from JWT on mount. Service cards show name, truncated description, duration, price (formatted via `formatPrice` as `$X.XX`), status badge (ACTIVE → green, PAUSED → yellow). Action buttons: Edit (opens pre-filled modal), Pause/Resume (`actionInProgress` Set prevents double-click), Delete (confirmation bar). Create/Edit Modal: name (required), description (optional), durationMinutes (required, 15–480), price in dollars (required, ≥0), status radio. Price converted to cents on submit. 422 `LIMIT_REACHED` → inline "You have reached the 20 active service limit."

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] Services list renders with correct status badges and price formatting
- [x] Create modal adds service; LIMIT_REACHED shows inline error
- [x] Edit modal pre-fills and updates service in-place
- [x] Pause/Resume toggles status; button disabled during call
- [x] Delete requires confirmation; removes service from list on success
- [x] Empty state and loading skeleton present
- [x] Business top-nav strip present
- [x] `app.routes.ts` wired for `/business/services`
- [x] IMPLEMENTATION_PLAN.md updated with 8e2-a/8e2-b split
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
