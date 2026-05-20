## Spec: Phase 8a — Web-app scaffold + auth.service + interceptors + guards + routing
**FR references**: FR-WEBAPP-02, FR-WEBAPP-04, FR-WEBAPP-05, FR-WEBAPP-06, FR-WEBAPP-07, FR-WEBAPP-08, FR-WEBAPP-09, FR-WEBAPP-10, FR-WEBAPP-11, FR-WEBAPP-12
**Status**: ✅ Implemented
**Prerequisites**: 1b ✅
**Size check**: 8 files · 1 service (AuthService) · 1 layer (frontend) · 0 pages (scaffold only) · fits one session ✅

### What
Full Angular 17+ scaffold for `apps/web-app/` mirroring the marketing scaffold (Tailwind, standalone components) but with auth wiring: AuthService (Amplify Auth), AuthInterceptor, AuthGuard, RoleGuard, and the empty route table. No pages yet (pages come in Phases 8b–8e3).

### Why
FR-WEBAPP-02/04–12: the web-app is auth-protected and uses Cognito; the scaffold must include the full auth machinery before any page can be added.

### New / Modified Files
- `apps/web-app/{package.json,angular.json,tsconfig.json,tailwind.config.js}` — Angular CLI config; Tailwind enabled; AWS Amplify Auth dependency
- `apps/web-app/src/{main.ts,index.html,styles.css}` — bootstrap + Tailwind directives
- `apps/web-app/src/app/{app.config.ts,app.routes.ts}` — provideRouter, provideHttpClient(withInterceptors([authInterceptor])), Amplify configure block reads Cognito IDs from `environment`
- `apps/web-app/src/app/services/auth.service.ts` — `signIn`, `signUp`, `signOut`, `currentSession()`, `currentUser` signal; persists JWT in `localStorage` under `qulene_access_token`
- `apps/web-app/src/app/interceptors/auth.interceptor.ts` — functional interceptor; injects `Authorization: Bearer <token>` on all non-public requests; on 401/403, clears token + redirects to `/login`
- `apps/web-app/src/app/guards/auth.guard.ts` — functional guard; redirects to `/login` if `authService.currentUser()` is null
- `apps/web-app/src/app/guards/role.guard.ts` — functional guard factory; accepts expected role; redirects to `/login` (or 403 page) on mismatch
- `apps/web-app/src/environments/{environment.ts,environment.prod.ts}` — `apiUrl`, `cognitoUserPoolId`, `cognitoAppClientId`, `region`

### Behavior
**Routing**: `app.routes.ts` declares all 15 routes from FR-WEBAPP-13 upfront with `loadComponent` lazy imports pointing to placeholder components (replaced incrementally by 8b–8e3). `AuthGuard` applied to all `/customer/**` and `/business/**` routes; `RoleGuard('CUSTOMER')` to `/customer/**`; `RoleGuard('BUSINESS')` to `/business/**`. Public routes (`/`, `/login`, `/register`, `/businesses`, `/businesses/:id`) have no guards.

**Public-request detection**: `authInterceptor` skips `Authorization` header injection when the URL matches `/web/contact` or `/web/signup` or hits the public business endpoints (`GET /businesses*` without authenticated user); otherwise it injects.

**Token storage**: `qulene_access_token` in `localStorage` only (FR-WEBAPP-04). On logout: remove key + redirect to `/login`. Cross-tab session sync is out of scope.

**Standards (FR-WEBAPP-09/10/11/12)**: all components standalone; signals for state; Reactive Forms for forms (only AuthService here so no form yet); all HTTP in services/ (no HttpClient in components).

### Done When
- [x] `ng build` exits 0; `ng lint` exits 0
- [x] All 15 routes resolve via `loadComponent` to placeholder components
- [x] AuthGuard redirects unauthenticated user from `/customer/**` to `/login`
- [x] RoleGuard redirects CUSTOMER attempting `/business/**` to `/login`
- [x] AuthInterceptor injects Bearer on protected requests; skips on public
- [x] 401/403 from API clears token + redirects to `/login` (verified via mock HttpClient)
- [x] Amplify Auth configured from `environment.ts`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
