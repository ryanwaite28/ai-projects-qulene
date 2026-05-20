## Spec: Phase 8a-c — Web-app auth machinery
**FR references**: FR-WEBAPP-04, FR-WEBAPP-05, FR-WEBAPP-06, FR-WEBAPP-07, FR-WEBAPP-08, FR-WEBAPP-13
**Status**: ✅ Implemented
**Prerequisites**: 8a-b ✅
**Size check**: 7 files · 0 service functions · 1 layer (Angular source) · fits one session ✅

### What
Wire the full auth infrastructure for the web app: `AuthService` (Amplify v6), a functional `AuthInterceptor`, `AuthGuard` and `RoleGuard`, and a single `PlaceholderComponent` that all 15 routes resolve to for now. Modifies `app.config.ts` to configure Amplify and register the interceptor. Populates the full route table in `app.routes.ts`. After this phase every route exists in the router, guards enforce auth/role, and `ng build` + `ng lint` both pass.

### Why
FR-WEBAPP-04/05/06/07/08: auth token storage, JWT injection, route protection, and 401/403 handling must all be in place before any real page can be built. FR-WEBAPP-13: the route table must be complete so that later phases only swap `PlaceholderComponent` for real components.

### New / Modified Files
- `apps/web-app/src/app/services/auth.service.ts` *(new)* — Amplify `signIn`/`signUp`/`signOut`/`fetchAuthSession`; stores token in `localStorage['qulene_access_token']`; exposes `isAuthenticated()`, `getUserRole()`, `getToken()`
- `apps/web-app/src/app/interceptors/auth.interceptor.ts` *(new)* — functional `HttpInterceptorFn`; adds `Authorization: Bearer <token>` when token present; on 401/403: clears token + `router.navigate(['/login'])`
- `apps/web-app/src/app/guards/auth.guard.ts` *(new)* — `CanActivateFn`; redirects to `/login` if no token
- `apps/web-app/src/app/guards/role.guard.ts` *(new)* — `CanActivateFn`; reads `route.data['requiredRole']`; redirects if JWT `custom:role` claim doesn't match
- `apps/web-app/src/app/pages/placeholder.component.ts` *(new)* — standalone; selector `app-placeholder`; template: centered "Coming Soon" message
- `apps/web-app/src/app/app.config.ts` *(modify from 8a-b)* — calls `Amplify.configure(...)` at module scope using `environment` values; adds `withInterceptors([authInterceptor])` to `provideHttpClient`
- `apps/web-app/src/app/app.routes.ts` *(modify from 8a-b)* — full 15-route table (see Behavior)

### Behavior

**`AuthService`** — injectable service using Amplify v6:
```typescript
login(email, password)           // signIn → fetchAuthSession → store token
register(email, password, role)  // signUp with custom:role attribute
logout()                         // signOut → remove token from localStorage
getToken(): string | null        // localStorage.getItem('qulene_access_token')
isAuthenticated(): boolean
getUserRole(): string | null     // decodes JWT payload (base64) to read custom:role claim
```
`fetchAuthSession().tokens.accessToken.toString()` is the token stored and read.

**`authInterceptor`** (functional `HttpInterceptorFn`):
- Reads `localStorage['qulene_access_token']`; clones request with `Authorization: Bearer <token>` if present
- `catchError`: on 401 or 403 → `localStorage.removeItem(TOKEN_KEY)` + `router.navigate(['/login'])`

**`authGuard`** (`CanActivateFn`): reads token from `localStorage`; returns `router.createUrlTree(['/login'])` if null.

**`roleGuard`** (`CanActivateFn`): decodes JWT payload, checks `custom:role` against `route.data['requiredRole']`; returns `router.createUrlTree(['/'])` if mismatch.

**`app.config.ts`** (module-scope Amplify configure + interceptor registration):
```typescript
Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId } } });

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
  ],
};
```

**`app.routes.ts`** — 15 routes matching FR-WEBAPP-13:
- Public: `/`, `/login`, `/register`, `/businesses`, `/businesses/:businessId`
- `/customer` (canActivate: authGuard + roleGuard, data: `{ requiredRole: 'CUSTOMER' }`): `appointments`, `waitlist`, `notifications`, `profile`
- `/business` (canActivate: authGuard + roleGuard, data: `{ requiredRole: 'BUSINESS' }`): `dashboard`, `profile`, `services`, `availability`, `waitlist`, `notifications`

Guards applied on parent route; children inherit.

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] `AuthInterceptor` adds `Authorization: Bearer` header when `qulene_access_token` present in `localStorage`
- [x] `AuthInterceptor` clears token and navigates to `/login` on 401 or 403 response
- [x] `AuthGuard` redirects unauthenticated users to `/login`
- [x] `RoleGuard` redirects CUSTOMER users away from `/business/**` (and vice versa)
- [x] Amplify configured in `app.config.ts` using `environment.cognitoUserPoolId` / `cognitoAppClientId`
- [x] All 15 routes from FR-WEBAPP-13 present in `app.routes.ts`
- [x] `PlaceholderComponent` is standalone; selector `app-placeholder`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
