## Spec: Phase 2d — Mobile business management (profile + services + availability)
**FR references**: FR-BIZ-02, FR-BIZ-06, FR-SVC-01, FR-SVC-02, FR-SVC-03, FR-AVL-01, FR-AVL-04
**Status**: ⬜ Not Started
**Prerequisites**: 1c ✅, 2a ✅, 2b ✅, 2c ✅
**Size check**: 5 files · 0 service functions · 1 layer (mobile) · 3 screens (at limit) · fits one session ✅

### What
Three mobile screens for business users: profile editor (with avatar upload), services manager (CRUD list), and availability windows manager. Hook up the business-side tab bar with these three screens as the primary navigation entry points. Each screen has loading skeletons and empty states.

### Why
FR-BIZ-02/06, FR-SVC-01/02/03, FR-AVL-01/04 define the operational management surface a business user needs after signup. Without these screens, businesses cannot configure their listing for customers to browse.

### New / Modified Files
- `apps/mobile/app/(business)/_layout.tsx` — bottom tab bar with 4 tabs (Dashboard placeholder, Profile, Services, Availability); Dashboard is filled in by Phase 3e
- `apps/mobile/app/(business)/profile.tsx` — Reactive form (NativeWind) for `businessName`, `category`, `description`, `address`, `city`, `state`, `phone`; avatar upload via Expo ImagePicker → presigned URL flow from Phase 2a
- `apps/mobile/app/(business)/services.tsx` — list of own services with create / edit (modal) / pause / delete actions; empty state on no services
- `apps/mobile/app/(business)/availability.tsx` — weekly grid (Sun–Sat) showing existing windows; add-window modal with dayOfWeek + start/end time pickers; delete on tap
- `apps/mobile/hooks/useBusinessApi.ts` — typed wrappers for the business + services + availability endpoints used here

### Behavior
**Profile screen**: on first mount, GET `/users/me` and `/businesses/{userId}` (latter may 404 — render empty form); on submit, `PATCH /businesses/me`. Avatar tap → ImagePicker → request `POST /businesses/me/avatar` → upload to presigned URL → `PATCH /businesses/me { avatarUrl }`.

**Services screen**: GET `/businesses/{userId}/services` on mount; show list with status badges (ACTIVE/PAUSED). FAB opens create modal. Each row has edit / pause-toggle / delete buttons. Delete confirms via Alert; on confirm calls `DELETE /businesses/me/services/:serviceId`. Inline error on FR-SVC-02 LIMIT_REACHED.

**Availability screen**: GET `/businesses/{userId}/availability` on mount; render as 7-row grid. "+" button on each day opens add-window modal. Inline error on FR-AVL-02 LIMIT_REACHED / DAY_LIMIT_REACHED.

**Navigation completeness**: each screen has its own tab in the business tab bar; that satisfies CLAUDE.md 12.13. All three screens use NativeWind only.

### Done When
- [ ] All 3 screens render correctly with NativeWind (no `StyleSheet.create`, no `style={}`)
- [ ] Each screen has an empty state and a loading skeleton
- [ ] All 3 routes appear in the business tab bar (navigation entry point)
- [ ] Profile screen avatar upload works end-to-end (presigned URL flow)
- [ ] FR-SVC-02 and FR-AVL-02 limit errors render as inline messages
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
