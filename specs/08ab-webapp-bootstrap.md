## Spec: Phase 8a-b — Web-app bootstrap: app skeleton + environments
**FR references**: FR-WEBAPP-02, FR-WEBAPP-04, FR-WEBAPP-09
**Status**: ✅ Implemented
**Prerequisites**: 8a-a ✅
**Size check**: 8 files · 0 service functions · 1 layer (Angular source) · fits one session ✅

### What
Add the TypeScript source files that make `apps/web-app/` compile: `index.html`, `styles.css`, `main.ts`, minimal `AppComponent`, a minimal `app.config.ts` (no interceptors yet — added in 8a-c), an empty `app.routes.ts`, and the two environment files. After this phase `ng build` and `ng lint` pass. Auth wiring and the full route table come in Phase 8a-c.

### Why
FR-WEBAPP-02: Angular 17+ scaffold must compile before any feature pages can be added. FR-WEBAPP-04: environments must carry `cognitoUserPoolId`, `cognitoAppClientId`, and `apiUrl` so that 8a-c can configure Amplify without hardcoding any values.

### New / Modified Files
- `apps/web-app/src/index.html` — standard Angular shell; `<app-root>`, viewport + description meta
- `apps/web-app/src/styles.css` — `@tailwind base/components/utilities` only
- `apps/web-app/src/main.ts` — `bootstrapApplication(AppComponent, appConfig)`
- `apps/web-app/src/environments/environment.ts` — dev: `{ production: false, apiUrl: 'http://localhost:4566', cognitoUserPoolId: 'dev-placeholder', cognitoAppClientId: 'dev-placeholder', region: 'us-east-1' }`
- `apps/web-app/src/environments/environment.prod.ts` — prod: `{ production: true, apiUrl: 'https://api.qulene.com', cognitoUserPoolId: '', cognitoAppClientId: '', region: 'us-east-1' }`
- `apps/web-app/src/app/app.component.ts` — standalone; selector `app-root`; template `<router-outlet />`; imports `[RouterOutlet]`
- `apps/web-app/src/app/app.config.ts` — `provideRouter(routes, withComponentInputBinding())` + `provideHttpClient(withFetch())`; no interceptors yet (added in 8a-c); no Amplify configure yet (added in 8a-c)
- `apps/web-app/src/app/app.routes.ts` — `export const routes: Routes = []` (populated in 8a-c)

### Behavior

**Environment shape** (same for both files, different values):
```typescript
export const environment = {
  production: boolean,
  apiUrl: string,          // base URL for all HTTP calls — injected in services/auth.service.ts
  cognitoUserPoolId: string,  // read by Amplify configure in app.config.ts (8a-c)
  cognitoAppClientId: string, // read by Amplify configure in app.config.ts (8a-c)
  region: string,
};
```
Prod Cognito IDs are intentionally left as empty strings — they are written to `apps/web-app/src/environments/environment.prod.ts` as a post-deploy step after `terraform apply` emits the Cognito outputs. Local dev IDs are placeholders that are replaced when running against a live dev Cognito pool.

**`app.config.ts`** (minimal — interceptors added in 8a-c):
```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch()),
  ],
};
```

**`app.component.ts`**: single `<router-outlet />` — the entire app renders through routing; no nav shell here (shell is added per feature phase as part of page components).

### Done When
- [x] `ng build` exits 0 — no TypeScript or template errors
- [x] `ng lint` exits 0
- [x] `apps/web-app/src/environments/environment.ts` and `environment.prod.ts` exist with correct shape
- [x] `app.config.ts` uses `provideHttpClient(withFetch())` — no interceptors yet
- [x] `app.routes.ts` exports an empty `Routes` array
- [x] All components standalone; no `NgModule`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
