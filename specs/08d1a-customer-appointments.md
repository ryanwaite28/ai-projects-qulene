## Spec: Phase 8d1-a — Web customer appointments page
**FR references**: FR-APT-01, FR-APT-02, FR-APT-09, FR-APT-11, FR-WEBAPP-13
**Status**: ✅ Implemented
**Prerequisites**: 3b ✅, 8a-c ✅
**Size check**: 3 files · 3 service functions · 1 layer (Angular source) · 1 screen · fits one session ✅

### What
Implement the `/customer/appointments` route as a real page. Adds `AppointmentService` with three methods. The page lists the customer's requests with status badges, supports cancellation with confirmation, and includes a "New Request" modal triggered by a page button or by query params forwarded from the business detail "Request" CTA (`?openModal=true&serviceId=<id>`).

### Why
FR-APT-01/09/11: customers must be able to submit, view, and cancel appointment requests. FR-WEBAPP-13: `/customer/appointments` must be a real page.

### New / Modified Files
- `apps/web-app/src/app/services/appointment.service.ts` *(new)* — `listCustomerRequests(cursor?)`, `createRequest(body)`, `cancelRequest(requestId)` — all `Observable<T>`; imports `AppointmentRequest`/`AppointmentStatus` from `@qulene/api-types`
- `apps/web-app/src/app/pages/customer-appointments.component.ts` *(new)* — list + modal + cancel; `@Input() openModal?: string; @Input() serviceId?: string;` (query params via `withComponentInputBinding()`)
- `apps/web-app/src/app/app.routes.ts` *(modify from 8c)* — swap `PlaceholderComponent` → `CustomerAppointmentsComponent` for `/customer/appointments`

### Behavior

**`AppointmentService`**:
- `listCustomerRequests(cursor?: string)` → `GET /appointments/me?cursor=<cursor>`
- `createRequest(body: { serviceId; proposedAt; notes?; idempotencyKey })` → `POST /appointments`
- `cancelRequest(requestId: string)` → `DELETE /appointments/:requestId`

**`CustomerAppointmentsComponent`** signals: `requests`, `loading`, `nextCursor`, `modalOpen`, `modalSubmitting`, `modalError`, `confirmCancelId`.

**Modal**: Reactive Form (serviceId required, proposedAt datetime-local required, notes optional). `idempotencyKey = crypto.randomUUID()` on modal open. On success: close + prepend to list. 409 → inline error "You already have an active request for this service." 422 → "Please choose a future date and time."

**Cancel**: PENDING/ACCEPTED rows show Cancel button. Click sets `confirmCancelId`; confirmation bar appears. Confirm calls `cancelRequest()`; updates record in-place.

**Auto-open**: `ngOnInit` — if `openModal === 'true'`, open modal; pre-fill serviceId from `@Input() serviceId`.

**Status badge colors**: PENDING → yellow; ACCEPTED → green; DECLINED/CANCELLED → gray; COMPLETED → blue; NO_SHOW → orange.

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] List renders with correct status badges and cursor pagination
- [x] "New Request" modal opens from button; serviceId pre-filled when from query params
- [x] Submit creates request; 409 and 422 show inline error in modal (no navigation)
- [x] Cancel on PENDING/ACCEPTED row requires confirmation; updates list in-place on success
- [x] Empty state and loading skeleton present
- [x] Business detail "Request" CTA uses `[queryParams]` correctly
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
