## Spec: Phase 4b — Mobile customer waitlist screens (join + my list)
**FR references**: FR-WAIT-01, FR-WAIT-02, FR-WAIT-03
**Status**: ⬜ Not Started
**Prerequisites**: 2e ✅, 4a ✅
**Size check**: 2 files · 0 service functions · 1 layer (mobile) · 2 screens (modified detail + new waitlist) · fits one session ✅

### What
Add "Join Waitlist" CTA to the business detail screen (Phase 2e modify) shown next to each service. Fill in the placeholder "Waitlist" tab from Phase 2e with the customer's active + promoted + removed waitlist entries with a per-row leave action.

### Why
FR-WAIT-01–03: customer must be able to queue and leave a waitlist; without a list screen the customer has no way to see or manage their queue position.

### New / Modified Files
- `apps/mobile/app/(customer)/business/[id].tsx` (modify) — each service row gets an outlined "Join Waitlist" secondary button alongside the existing "Request Appointment" primary
- `apps/mobile/app/(customer)/waitlist.tsx` (replace Phase 2e placeholder) — list of waitlist entries with status badges (ACTIVE / PROMOTED / REMOVED), each row shows business + service name + queue-joined-at; "Leave" button on ACTIVE rows; tap PROMOTED row navigates to the appointment request form for that service (Phase 3d)

### Behavior
**Join Waitlist CTA**: tapping confirms "Join the waitlist for {service name}?" → `POST /waitlist { serviceId }`. On 409 (FR-WAIT-02 already on waitlist) shows toast "You're already on the waitlist for this service." On 404 (service deleted) shows toast.

**My Waitlist screen**: `GET /waitlist/me` paginated; render with most-recent-first ordering. Status badge colors: ACTIVE=yellow, PROMOTED=green, REMOVED=gray. ACTIVE rows show "Leave" button → confirms via Alert → `DELETE /waitlist/:entryId` → optimistically updates. PROMOTED rows show "Book Now" CTA → navigates to `/(customer)/appointment-request/{serviceId}`.

**Empty state**: "No waitlist entries — join one from a business detail screen."

**Navigation completeness**: Waitlist is a tab (entry point); Join Waitlist CTA visible on every service in every business detail (entry point).

### Done When
- [ ] Join Waitlist CTA visible on each service in business detail
- [ ] 409 already-on-waitlist surfaced as toast
- [ ] Waitlist tab lists entries with correct status badges
- [ ] ACTIVE row Leave action removes the entry
- [ ] PROMOTED row Book Now navigates to appointment request form pre-filled with serviceId
- [ ] Empty state + loading skeleton present
- [ ] All NativeWind; all routes have a navigation entry point
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
