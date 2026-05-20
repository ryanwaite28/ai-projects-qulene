## Spec: Phase 7c-a — Marketing static pages + environments + HttpClient config
**FR references**: FR-MKT-02, FR-MKT-04, FR-MKT-05
**Status**: ✅ Implemented
**Prerequisites**: 7b ✅
**Size check**: 7 files · 0 service functions · 1 layer (frontend config + static pages) · fits one session ✅

### What
Completes the non-dynamic half of the marketing SPA: adds the Angular environment files (`apiUrl` per env), wires `provideHttpClient(withFetch())` into `app.config.ts`, and replaces the three placeholder routes (Pricing, Privacy, Terms) with real static-content components. Contact remains on the `PlaceholderComponent` stub until Phase 7c-b (which depends on this spec).

### Why
FR-MKT-02: all seven pages must render content (not a stub) before the marketing site can ship. FR-MKT-04/05: `HttpClient` must be provided before the dynamic 7c-b features can be built.

### New / Modified Files
- `apps/marketing/src/environments/environment.ts` — `{ apiUrl: 'http://localhost:4566' }` (dev / local serve)
- `apps/marketing/src/environments/environment.prod.ts` — `{ apiUrl: 'https://api.qulene.com' }` (production build)
- `apps/marketing/src/app/app.config.ts` (modify from 7b) — add `provideHttpClient(withFetch())`
- `apps/marketing/src/app/app.routes.ts` (modify from 7b) — replace `/pricing`, `/privacy`, `/terms` `loadComponent` targets from `PlaceholderComponent` to the real components below
- `apps/marketing/src/app/pages/pricing.component.ts` — static pricing page: two-tier card layout (Free / Pro placeholder), no API calls
- `apps/marketing/src/app/pages/privacy.component.ts` — static privacy policy text (standard boilerplate sections: data collected, how used, retention, contact)
- `apps/marketing/src/app/pages/terms.component.ts` — static terms of service text (standard boilerplate: acceptance, service description, user obligations, limitation of liability)

### Behavior

**Environments**: Angular CLI's build system resolves `src/environments/environment.ts` for `ng serve` and replaces it with `environment.prod.ts` for production builds (`ng build --configuration production`). The `angular.json` `fileReplacements` array must be populated in the production configuration block.

**`app.config.ts` change**: add `provideHttpClient(withFetch())` to the `providers` array. `withFetch` is required for the Angular application builder (esbuild-based); it replaces the legacy XHR-based transport and is compatible with SSR and Zoneless builds.

**`app.routes.ts` change**: three `loadComponent` entries swap from `PlaceholderComponent` to the real components:
```typescript
{ path: 'pricing',  loadComponent: () => import('./pages/pricing.component').then(m => m.PricingComponent) },
{ path: 'privacy',  loadComponent: () => import('./pages/privacy.component').then(m => m.PrivacyComponent) },
{ path: 'terms',    loadComponent: () => import('./pages/terms.component').then(m => m.TermsComponent) },
```
The `/contact` route continues to point at `PlaceholderComponent` — it is wired in 7c-b.

**Pricing page**: two side-by-side cards (stacked on mobile). Left card: Free tier — "Get started at no cost", bullet list (up to 2 services, 10 active waitlist entries, basic notifications). Right card: Pro tier — "Coming soon", teaser bullet list, "Join the waitlist" CTA linking to the home page anchor. No Reactive Form, no API call.

**Privacy page**: headings (What we collect, How we use it, Data retention, Your rights, Contact us) with placeholder paragraph text under each. Tailwind `prose`-style layout (max-width, readable line-height).

**Terms page**: same heading/paragraph structure as Privacy (Acceptance, Service description, User conduct, Disclaimers, Limitation of liability, Changes to terms, Governing law). Same layout.

### Done When
- [x] `ng build` exits 0; no TypeScript or template errors
- [x] `ng lint` exits 0
- [x] `/pricing`, `/privacy`, `/terms` routes render the real components (confirmed via `ng serve`)
- [x] `/contact` still renders `PlaceholderComponent` (not changed in this spec)
- [x] `environment.ts` and `environment.prod.ts` exist; `fileReplacements` block in `angular.json` production config
- [x] `provideHttpClient(withFetch())` present in `app.config.ts`
- [x] All new components standalone; `@if`/`@for` control flow; no `NgModule`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
