## Spec: Phase 8d1-b — Web customer waitlist page
**FR references**: FR-WL-01, FR-WL-02, FR-WL-09, FR-WEBAPP-14
**Status**: ✅ Implemented
**Prerequisites**: 8a-c ✅, 8d1-a ✅
**Size check**: 3 files · 3 service functions · 1 layer (Angular source) · 1 screen · fits one session ✅

### What
Implement the `/customer/waitlist` route as a real page. Adds `WaitlistService` with three methods. The page lists the customer's waitlist entries with status badges, supports leaving the waitlist with confirmation, and includes a "Join Waitlist" modal that auto-opens when `serviceId` is present as a query param (forwarded from the business detail "Waitlist" CTA).

### Why
FR-WL-01/02/09: customers must be able to join, view, and leave the waitlist. FR-WEBAPP-14: `/customer/waitlist` must be a real page.

### New / Modified Files
- `apps/web-app/src/app/services/waitlist.service.ts` *(new)* — `listCustomerEntries()`, `joinWaitlist(serviceId)`, `leaveWaitlist(entryId)` — all `Observable<T>`; imports `WaitlistEntry`/`WaitlistStatus` from `@qulene/api-types`
- `apps/web-app/src/app/pages/customer-waitlist.component.ts` *(new)* — list + modal + leave confirmation; `@Input() serviceId?: string` (query param via `withComponentInputBinding()`)
- `apps/web-app/src/app/app.routes.ts` *(modify from 8d1-a)* — swap `PlaceholderComponent` → `CustomerWaitlistComponent` for `/customer/waitlist`

### Behavior

**`WaitlistService`**:
- `listCustomerEntries()` → `GET /waitlist/me`
- `joinWaitlist(serviceId: string)` → `POST /waitlist` with body `{ serviceId }`
- `leaveWaitlist(entryId: string)` → `DELETE /waitlist/:entryId`

**`CustomerWaitlistComponent`** signals: `entries`, `loading`, `modalOpen`, `modalSubmitting`, `modalError`, `confirmLeaveId`, `joinServiceId`.

**Join Modal**: Single text field for serviceId (pre-filled and read-only when `@Input() serviceId` is present). On success: close modal + prepend entry to list. 409 → inline error "You are already on the waitlist for this service."

**Leave**: ACTIVE rows show Leave button. Click sets `confirmLeaveId`; confirmation bar appears. Confirm calls `leaveWaitlist()`; removes entry from list in-place (or updates status to REMOVED if API returns updated record).

**Auto-open**: `ngOnInit` — if `serviceId` input is present, open modal and pre-fill serviceId.

**PROMOTED rows**: Show "Promoted — slot opened!" badge (green) and a "Book Now" link → `/customer/appointments?openModal=true&serviceId=<serviceId>`.

**Status badge colors**: ACTIVE → blue; PROMOTED → green; REMOVED → gray.

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] List renders with correct status badges
- [x] "Join Waitlist" modal opens from button; serviceId pre-filled and read-only when from query params
- [x] Submit joins waitlist; 409 shows inline error in modal (no navigation)
- [x] Leave on ACTIVE row requires confirmation; removes entry from list on success
- [x] PROMOTED row shows "Book Now" link with correct query params
- [x] Empty state and loading skeleton present
- [x] Business detail "Waitlist" CTA uses `[queryParams]` correctly (already wired in 8d1-a)
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
