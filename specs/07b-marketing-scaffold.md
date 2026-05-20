## Spec: Phase 7b — Marketing Angular scaffold + routing + 3 core pages
**FR references**: FR-MKT-01, FR-MKT-02 (Home, About, How It Works), FR-MKT-04
**Status**: ✅ Implemented
**Prerequisites**: 0b ✅
**Size check**: 8 files · 0 service functions · 1 layer (frontend) · 3 pages (at limit) · fits one session ✅

### What
Full Angular 17+ workspace scaffold for `apps/marketing/`: standalone components, Tailwind CSS, app routes, app config. Implement the three core marketing pages: Home (hero + product summary), About, How It Works. The remaining 4 pages + form wiring are Phase 7c.

### Why
FR-MKT-01/02/04: a polished marketing SPA at `qulene.com` is required for portfolio presentation. Scaffolding must come before any page content can be added.

### New / Modified Files
- `apps/marketing/{package.json,angular.json,tsconfig.json,tailwind.config.js}` — Angular CLI config; Tailwind enabled
- `apps/marketing/src/{main.ts,index.html,styles.css}` — bootstrap, root template, Tailwind directives
- `apps/marketing/src/app/{app.config.ts,app.routes.ts}` — provideRouter, withComponentInputBinding, no HttpClient yet (added in 7c when forms need it)
- `apps/marketing/src/app/layouts/marketing-layout.component.ts` — standalone shell with navbar (Qulene logo + nav links to Home, About, How It Works, Pricing, Contact) + footer
- `apps/marketing/src/app/pages/home.component.ts` — hero with tagline + "Get App" + "Open Web App" placeholders (linked to `app.qulene.com` once 8f deploys)
- `apps/marketing/src/app/pages/about.component.ts` — about text + mission summary
- `apps/marketing/src/app/pages/how-it-works.component.ts` — two-column explainer (Business persona / Customer persona) with bullet steps

### Behavior
**Angular standards (FR-WEBAPP-09 — also applies to marketing per consistency)**:
- All components standalone — no `NgModule`
- New control flow `@if`/`@for`/`@switch` — never `*ngIf`/`*ngFor`
- Tailwind classes only — no Angular Material, no separate CSS files beyond `styles.css` Tailwind directives
- All pages mobile-responsive (Tailwind `sm:`/`md:`/`lg:` breakpoints)

**Routing**: `app.routes.ts` defines all 7 routes upfront with `loadComponent` lazy imports; pages not implemented yet (Pricing, Contact, Privacy, Terms) point to a TODO placeholder component (`apps/marketing/src/app/pages/placeholder.component.ts`) so the routes resolve cleanly until Phase 7c.

**Layout**: every page renders inside `<marketing-layout>` (navbar + content slot + footer); navbar links visible on all pages.

### Done When
- [x] `ng build` exits 0 — produces `dist/marketing/browser/`
- [x] `ng lint` exits 0
- [x] `ng serve --port 8080` renders all 3 implemented pages
- [x] Routes for Pricing/Contact/Privacy/Terms resolve to placeholder without errors
- [x] All components standalone; new control flow syntax used; no `NgModule` anywhere
- [x] Tailwind classes applied; pages mobile-responsive
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
