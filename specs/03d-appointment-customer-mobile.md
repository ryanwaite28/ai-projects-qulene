## Spec: Phase 3d — Mobile customer appointment screens (request form + my appointments)
**FR references**: FR-APT-01, FR-APT-02, FR-APT-09, FR-APT-11
**Status**: ✅ Implemented
**Prerequisites**: 2e ✅, 3b ✅
**Size check**: 3 files · 0 service functions · 1 layer (mobile) · 2 screens (modified detail + new appointments) · fits one session ✅

### What
Wire the "Request Appointment" CTA on a service row in the business detail screen (Phase 2e) to a new appointment-request form. Add the "My Appointments" tab screen listing the customer's requests across all businesses, sorted by `proposedAt` desc, with a per-row cancel action.

### Why
FR-APT-01/02/09/11: the customer must be able to submit a request, see their own pending/accepted/past requests, and cancel before completion.

### New / Modified Files
- `apps/mobile/app/(customer)/business/[id].tsx` (modify) — tapping a service row navigates to the new appointment request screen with `serviceId` as a route param
- `apps/mobile/app/(customer)/appointment-request/[serviceId].tsx` (new) — full-screen form: read-only service summary at top, DateTime picker for `proposedAt`, multiline `notes` field, submit button; generates `idempotencyKey = uuid()` at mount and locks it for the lifetime of the screen so retries are safe
- `apps/mobile/app/(customer)/appointments.tsx` (replace Phase 2e placeholder) — list of customer requests with status badge per row; tap to expand; per-row "Cancel" button for PENDING/ACCEPTED only; pull-to-refresh; cursor pagination

### Behavior
**Request form**: validates `proposedAt > now()` client-side (inline error); submits `POST /appointments` with `{ serviceId, proposedAt: iso, notes, idempotencyKey }`. On 409 (FR-APT-03 duplicate active) shows inline "You already have an active request for this service"; on 422 (past time) shows "Please pick a future time"; on success, navigates back to `(customer)/appointments` and shows toast.

**My Appointments list**: `GET /appointments/me` paginated; group by status badge color (PENDING=yellow, ACCEPTED=green, DECLINED=red, CANCELLED=gray, COMPLETED=blue, NO_SHOW=gray). Loading skeleton; empty state "No appointments yet — browse businesses to book."

**Cancel action**: confirms via native Alert; on confirm `DELETE /appointments/:requestId`; optimistically removes row, re-fetches on failure.

**Navigation completeness**: Appointments is a tab (entry point); appointment request form is reachable from any service detail (entry point).

### Done When
- [x] Request form generates one `idempotencyKey` per mount; retries from this same screen do not create duplicates (tested by killing network during first submit)
- [x] Past `proposedAt` blocked client-side and surfaces 422 cleanly if it slips through
- [x] Cancel flow ownership-checked server-side (already covered by 3b)
- [x] My Appointments list paginated + sorted by `proposedAt` desc; pull-to-refresh
- [x] Empty states + loading skeletons present
- [x] All NativeWind; all routes have a navigation entry point
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated

### Implementation Notes
- Supporting change: `apps/mobile/expo-env.d.ts` created to fix pre-existing TS2591 error (`process` not typed); declares `NodeJS.ProcessEnv` with `EXPO_PUBLIC_API_URL`.
- Supporting change: `useApi.ts` extended with `requestWithCursor<T>` returning `{ data: T; nextCursor: string | null }` — same auth flow as `request` but preserves top-level pagination fields.
- `appointment-request/[serviceId].tsx` uses a `useRef<string>` initialized with `generateUUID()` at mount; the key is locked for the screen lifetime so retries submit the same key.
- Date/time entry uses two TextInputs (YYYY-MM-DD + HH:MM) combined into an ISO string; no external DateTimePicker dependency required.
- Cancel action optimistically updates the local row to CANCELLED; re-fetches from server on error.
- `appointments.tsx` uses a synchronous `if (!loaded)` guard as the initial-load trigger (avoids useEffect + state flush ordering issues in strict mode).
