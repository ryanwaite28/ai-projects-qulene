## Spec: Phase 3e — Mobile business incoming requests screen
**FR references**: FR-APT-05, FR-APT-06, FR-APT-07, FR-APT-08, FR-APT-10
**Status**: ✅ Implemented
**Prerequisites**: 2d ✅, 3c ✅
**Size check**: 2 files · 0 service functions · 1 layer (mobile) · 1 screen · fits one session ✅

### What
Fill in the placeholder "Dashboard" tab from Phase 2d with the business's incoming appointment requests inbox. Status filter chips (All / Pending / Accepted / Past). Per-row action buttons appropriate to current status: PENDING shows Accept + Decline; ACCEPTED with future `proposedAt` shows Cancel (Note: business-side cancel is not a current FR; only the customer can cancel — so this is omitted); ACCEPTED with past `proposedAt` shows Complete + No-Show.

### Why
FR-APT-05–08/10: businesses need to see and action incoming requests. Without this screen, requests are received but cannot be processed.

### New / Modified Files
- `apps/mobile/app/(business)/dashboard.tsx` (replace placeholder) — incoming requests list, status filter chips, action buttons per row
- `apps/mobile/components/AppointmentCard.tsx` — reusable card shared with Phase 3d customer list; supports both customer and business contexts via prop flag

### Behavior
**Filter chips**: `All` / `Pending` / `Accepted` / `Past`. Mapped to API query: All=no filter, Pending=`status=PENDING`, Accepted=`status=ACCEPTED`, Past=client-side filter for `COMPLETED|NO_SHOW|CANCELLED|DECLINED`. (Server side does not support multi-status filter; for portfolio scale the past tab can fetch ACCEPTED+COMPLETED+NO_SHOW+CANCELLED+DECLINED in serial requests and merge.)

**Card layout**: shows customer first name, service name, formatted `proposedAt`, optional notes. Status badge color same as Phase 3d. Action buttons under the body when applicable.

**Action buttons**:
- PENDING → "Accept" (green) + "Decline" (red), both call `PATCH /businesses/me/appointments/:requestId/{accept|decline}`
- ACCEPTED with `proposedAt` in past → "Complete" + "No-Show", both call respective PATCH endpoints
- ACCEPTED with `proposedAt` in future → no actions (waiting for the appointment)
- Other terminal statuses → no actions

All actions confirm via Alert; on success optimistically updates the row and shows toast.

**Loading / empty**: skeleton on initial fetch; "No requests yet" empty state; pull-to-refresh.

**Navigation completeness**: Dashboard is the first tab in the business tab bar (entry point already wired in Phase 2d).

### Done When
- [x] Status filter chips work
- [x] PENDING rows show Accept + Decline; clicking succeeds + updates row
- [x] Past ACCEPTED rows show Complete + No-Show
- [x] Cards render correctly with NativeWind
- [x] Empty state + loading skeleton + pull-to-refresh
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated

### Implementation Notes
- `AppointmentCard.tsx` placed in `components/ui/` to match `BusinessCard.tsx` convention.
- "Past" filter chip fetches without a status param (server supports only single-status filter) then applies client-side `PAST_STATUSES.has(r.status)` filter. Cross-page ordering within the Past tab is not guaranteed but acceptable at portfolio scale.
- `performAction` is a shared helper that handles Alert confirmation → PATCH request → optimistic state update → re-fetch on error for all four action types, reducing repetition.
- `useEffect` on `activeFilter` resets `items` and `nextCursor` before re-fetching; `cancelled` flag prevents stale state updates if the chip changes before a slow request resolves.
- Future-ACCEPTED cards (proposedAt ≥ now) intentionally show no action buttons — appointment has not yet occurred.
