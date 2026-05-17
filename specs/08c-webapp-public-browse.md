## Spec: Phase 8c — Web public business browsing (list + detail)
**FR references**: FR-WEBAPP-13 (`/businesses`, `/businesses/:id`), FR-BIZ-03, FR-BIZ-04, FR-SVC-04, FR-AVL-03
**Status**: ⬜ Not Started
**Prerequisites**: 2a ✅, 2b ✅, 2c ✅, 8a ✅
**Size check**: 4 files · 1 service (BusinessService) · 1 layer · 2 pages · fits one session ✅

### What
Web mirror of Phase 2e mobile screens: browse businesses (paginated, category-filtered) and business detail (profile + services + availability). Public — no auth required.

### Why
FR-WEBAPP-13 requires the web app to mirror mobile functionality including the public browse experience.

### New / Modified Files
- `apps/web-app/src/app/services/business.service.ts` — `listBusinesses({ category?, cursor? })`, `getBusinessById(id)`, `listServicesForBusiness(businessId)`, `listAvailabilityForBusiness(businessId)` — all return `Observable<T>`
- `apps/web-app/src/app/pages/businesses/businesses.component.ts` — category chip filter; paginated card grid; cursor-based "Load more"; loading skeleton; empty state
- `apps/web-app/src/app/pages/business-detail/business-detail.component.ts` — header (name, category, address, avatar), services list, weekly availability grid; each service has "Request Appointment" button (linked in 8d1 once that exists) and "Join Waitlist" button (linked in 8d1)
- `apps/web-app/src/app/components/business-card/business-card.component.ts` — reusable card for list + future related-business widgets

### Behavior
**Browse page**: signal-based state `businesses = signal<Business[]>([])`, `category = signal<Category|null>(null)`, `cursor = signal<string|null>(null)`. On category change → reset + reload. On Load More → fetch next page.

**Detail page**: route param `:businessId` → parallel `forkJoin` of profile + services + availability; render with skeleton placeholders while loading. Empty state on 404 with back link.

**Service row CTAs**: until Phases 8d1 are implemented, the "Request Appointment" and "Join Waitlist" buttons surface a toast "Sign in to book"; once 8d1 exists, the buttons navigate to `/customer/appointments/new?serviceId=...` (or open a modal).

**Standards**: all signals; new control flow; standalone; service-layer HTTP only.

### Done When
- [ ] Browse page lists businesses with category filter + cursor pagination
- [ ] Business detail renders profile + services + availability with skeletons
- [ ] Public — works without authentication
- [ ] Empty states on no-businesses and on 404
- [ ] No HTTP calls in components (all via BusinessService)
- [ ] At least one navigation entry point (navbar "Browse")
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
