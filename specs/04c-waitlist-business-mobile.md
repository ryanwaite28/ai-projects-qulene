## Spec: Phase 4c — Mobile business waitlist view
**FR references**: FR-WAIT-05
**Status**: ✅ Implemented
**Prerequisites**: 2d ✅, 4a ✅
**Size check**: 1 file · 0 service functions · 1 layer · 1 screen · fits one session ✅

### What
Add a "Waitlist" screen accessible from each service row on the business services screen (Phase 2d). The screen lists current waitlist entries for that specific service in queue order (oldest first), showing customer first name and join time.

### Why
FR-WAIT-05: businesses need visibility into who is waiting for each of their services so they can make demand-aware decisions (e.g., spin up additional availability).

### New / Modified Files
- `apps/mobile/app/(business)/services.tsx` (modify) — each service row gets a "View Waitlist (N)" link (N from a count batch call; for portfolio scale, on first render fetch waitlist count per service serially)
- `apps/mobile/app/(business)/waitlist/[serviceId].tsx` (new) — full-screen list of active waitlist entries for the service; each row shows customer first name + queue position (1, 2, 3, …) + join timestamp

### Behavior
**Services row enhancement**: after the existing edit/pause/delete buttons, append "View Waitlist (count)" — tapping navigates to `/(business)/waitlist/{serviceId}`.

**Waitlist for service screen**: header shows service name; body lists entries from `GET /businesses/me/waitlist/{serviceId}`. Each row: `#{index+1}` queue position, customer first name, "Joined {relative time}". Empty state: "No customers on the waitlist." No actions on this screen — read-only.

**Navigation completeness**: entry point from each service row in the Services screen.

### Done When
- [x] Each service row in business Services screen shows "View Waitlist (N)"
- [x] Tapping navigates to the per-service waitlist screen
- [x] Entries listed in queue order (1, 2, 3, ...)
- [x] Empty state + loading skeleton present
- [x] All NativeWind
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
