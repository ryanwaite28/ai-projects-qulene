## Spec: Phase 8c — Web public business browsing
**FR references**: FR-BIZ-03, FR-BIZ-04, FR-SVC-04, FR-AVL-03, FR-WEBAPP-13
**Status**: ✅ Implemented
**Prerequisites**: 8a-c ✅
**Size check**: 5 files · 4 service methods (at limit) · 1 layer (Angular source) · 2 screens · fits one session ✅

### What
Replace the `/businesses` and `/businesses/:businessId` placeholder routes with real components. Adds `BusinessService` with four public-endpoint methods and a reusable `BusinessCardComponent`. Businesses list has category chip filters + cursor-based "Load more". Business detail loads profile + services + availability in parallel using `forkJoin`.

### Why
FR-BIZ-03/04: business profiles publicly viewable + paginated list filterable by category. FR-SVC-04/AVL-03: services and availability windows publicly readable. FR-WEBAPP-13: `/businesses` and `/businesses/:businessId` must be real pages.

### New / Modified Files
- `apps/web-app/src/app/services/business.service.ts` *(new)* — `listBusinesses({ category?, cursor? })`, `getBusinessById(id)`, `listServicesForBusiness(businessId)`, `listAvailabilityForBusiness(businessId)`; defines `BusinessProfile`, `Service`, `AvailabilityWindow` response interfaces
- `apps/web-app/src/app/components/business-card.component.ts` *(new)* — selector `app-business-card`; `@Input() business!: BusinessProfile`; card layout with name, category, address, avatar placeholder; `[routerLink]` to `/businesses/:businessId`
- `apps/web-app/src/app/pages/businesses.component.ts` *(new)* — category chip filter (predefined list); signal state: `businesses`, `loading`, `cursor`, `activeCategory`; "Load more" appends next page; empty state when list is empty
- `apps/web-app/src/app/pages/business-detail.component.ts` *(new)* — `@Input() businessId!: string` (via `withComponentInputBinding()`); `forkJoin` of `getBusinessById` + `listServicesForBusiness` + `listAvailabilityForBusiness`; signal state: `profile`, `services`, `windows`, `loading`, `notFound`; service CTAs link to `/customer/appointments` and `/customer/waitlist` (trigger authGuard → login if unauthenticated; real flow wired in 8d1); back link to `/businesses`
- `apps/web-app/src/app/app.routes.ts` *(modify from 8b)* — swap `PlaceholderComponent` → real components for `/businesses` and `/businesses/:businessId`

### Behavior

**`BusinessService`** — all public, no auth header:
- `listBusinesses` builds `HttpParams` from optional `category` and `cursor`; returns `{ data: BusinessProfile[]; nextCursor: string | null }`
- `getBusinessById` / `listServicesForBusiness` / `listAvailabilityForBusiness` are simple GET calls
- `apiUrl` from `environment.apiUrl` only

**`BusinessesComponent`**: predefined categories `['All','Salon','Fitness','Tutoring','Repair','Consulting','Photography','Healthcare']`; selecting a chip resets list + fetches; "Load more" appends next page; skeleton (6 gray cards) while first load is in progress.

**`BusinessDetailComponent`**: `@Input() businessId!: string`; `ngOnInit` fires `forkJoin`; availability rendered as table rows for days that have windows; `addressLine()` method formats address/city/state; `\${{ svc.price }}` used in template (escaped dollar sign in TS backtick literal).

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] `/businesses` lists businesses with category filter and cursor pagination
- [x] `/businesses/:businessId` renders profile + services + availability with skeletons while loading
- [x] Both pages work without authentication (public)
- [x] Empty state on no-results; `notFound` state on detail 404
- [x] No `HttpClient` calls in components — all through `BusinessService`
- [x] Home page "Browse Businesses" link provides navigation entry point
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
