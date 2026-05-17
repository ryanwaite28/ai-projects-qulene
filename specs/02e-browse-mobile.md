## Spec: Phase 2e — Mobile customer browse (list businesses + business detail)
**FR references**: FR-BIZ-03, FR-BIZ-04, FR-SVC-04, FR-AVL-03
**Status**: ⬜ Not Started
**Prerequisites**: 1c ✅, 2a ✅, 2b ✅, 2c ✅
**Size check**: 4 files · 0 service functions · 1 layer (mobile) · 2 screens · fits one session ✅

### What
Two mobile screens for customer users: a browse-businesses list (with category filter) and a business detail screen showing the business's services and weekly availability. Forms the foundation for Phase 3d (customer can tap a service from the detail screen to start an appointment request).

### Why
FR-BIZ-03/04, FR-SVC-04, FR-AVL-03: customers must be able to discover and inspect businesses before submitting any appointment request.

### New / Modified Files
- `apps/mobile/app/(customer)/_layout.tsx` — bottom tab bar with 4 tabs (Browse, Appointments placeholder, Waitlist placeholder, Notifications placeholder); the placeholders are filled by Phases 3d, 4b, 6b
- `apps/mobile/app/(customer)/index.tsx` — Browse Businesses screen with category chip filter; paginated list using `GET /businesses?category=` with infinite-scroll cursor
- `apps/mobile/app/(customer)/business/[id].tsx` — Business detail: header (name, category, address, avatar), description, list of active services (each tappable — Phase 3d wires the tap to open the appointment request screen), weekly availability grid
- `apps/mobile/components/ui/BusinessCard.tsx` — list-row card; supplemental component shared between list + detail header

### Behavior
**Browse screen**: on mount, `GET /businesses` (no auth required but interceptor allows it). Category chips at top (`SALON`, `TUTOR`, `CONTRACTOR`, `FITNESS`, `OTHER`); tapping a chip refilters via `GET /businesses?category=`. Cursor-based pagination via `nextCursor`. Empty state: "No businesses yet."

**Business detail screen**: route param `id` → parallel fetch `GET /businesses/{id}` + `GET /businesses/{id}/services` + `GET /businesses/{id}/availability`. Render header from profile data, services list with `name • {durationMinutes}m • ${price/100}` rows, availability as 7-row weekly grid. Loading skeleton for each section while fetching. On any 404, show "Business not found" empty state with back button.

**Navigation completeness**: Browse is a tab; business detail is reachable by tapping any business card. Tapping a service row from the detail will be wired to the appointment request screen in Phase 3d (placeholder shows toast for now).

### Done When
- [ ] Browse screen lists businesses paginated with category filter
- [ ] Business detail renders profile + services + availability with skeletons
- [ ] Empty states on no-businesses and on 404 business detail
- [ ] All NativeWind; no `StyleSheet.create`, no `style={}`
- [ ] All routes have a navigation entry point
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
