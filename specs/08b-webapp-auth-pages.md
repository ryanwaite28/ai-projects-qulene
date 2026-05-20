## Spec: Phase 8b — Web auth + public pages
**FR references**: FR-WEBAPP-04, FR-WEBAPP-06, FR-WEBAPP-09, FR-WEBAPP-10, FR-WEBAPP-11, FR-WEBAPP-13
**Status**: ✅ Implemented
**Prerequisites**: 8a-c ✅
**Size check**: 5 files · 0 backend service functions · 1 layer (Angular source) · 3 screens · fits one session ✅

### What
Replace the three placeholder routes (`/`, `/login`, `/register`) with real components. Adds a `UserApiService` for `POST /auth/profile`. Login flow: Amplify `signIn` → store token → `createProfile` (idempotent, all errors swallowed so login is never blocked) → navigate by role. Register flow: Amplify `signUp` → show success message with link to `/login`. Home page: hero with CTAs; redirects authenticated users to their dashboard on `ngOnInit`.

### Why
FR-WEBAPP-04: Cognito auth + token in `localStorage['qulene_access_token']`. FR-WEBAPP-13: `/`, `/login`, `/register` routes must be real pages. FR-WEBAPP-11: Reactive Forms required for all forms.

### New / Modified Files
- `apps/web-app/src/app/pages/login.component.ts` *(new)* — email + password form; on success calls `UserApiService.createProfile()` (best-effort) then navigates to `/business/dashboard` or `/customer/appointments` based on role
- `apps/web-app/src/app/pages/register.component.ts` *(new)* — email + password + confirmPassword + role radio; on Cognito success shows "Check your email to confirm your account, then log in" with link to `/login`
- `apps/web-app/src/app/pages/home.component.ts` *(new)* — hero with "Get Started" → `/register`, "Log In" → `/login`, "Browse Businesses" → `/businesses`; if already authenticated redirects to dashboard in `ngOnInit`
- `apps/web-app/src/app/services/user-api.service.ts` *(new)* — `createProfile(): Observable<void>` POSTs `{}` to `${environment.apiUrl}/auth/profile`; `AuthInterceptor` injects the JWT automatically
- `apps/web-app/src/app/app.routes.ts` *(modify from 8a-c)* — swap `PlaceholderComponent` → real components for `/`, `/login`, `/register`

### Behavior

**`UserApiService.createProfile()`**: `POST /auth/profile` with empty body. The JWT is injected by `AuthInterceptor` automatically.

**`LoginComponent`** (`app-login`):
- Reactive Form: `email` (required, `Validators.email`), `password` (required)
- Signals: `submitting`, `error`
- Submit: `authService.login(email, password)` → best-effort `createProfile()` (all errors swallowed) → `authService.getUserRole()` → navigate; navigation happens outside try/finally so `submitting` is cleared only on error
- Submit button disabled while `submitting()` or `form.invalid`; link to `/register`

**`RegisterComponent`** (`app-register`):
- Reactive Form: `email` (required, `Validators.email`), `password` (required, `minLength(8)`), `confirmPassword` (required), `role` (required, values: `'CUSTOMER'` | `'BUSINESS'`)
- Form-level cross-field validator: passwords must match
- Signals: `submitting`, `error`, `success`
- Submit: `authService.register(email, password, role)` → on success: `success.set(true)` — replaces form with confirmation + link to `/login`; link to `/login`

**`HomeComponent`** (`app-home`):
- `ngOnInit`: if `authService.isAuthenticated()` → navigate by role (same routing logic as post-login)
- Template: hero section with three router links

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] Login form submits → stores token in `localStorage['qulene_access_token']` → navigates to correct dashboard
- [x] Login calls `createProfile()` after successful sign-in; any error on `createProfile` does not block navigation
- [x] Register form submits → Cognito `signUp` called with `custom:role`; success shows confirmation message
- [x] Register form: passwords-must-match validator prevents submission when passwords differ
- [x] Home page redirects authenticated users to their role-based dashboard
- [x] `UserApiService` uses `environment.apiUrl` exclusively (no hardcoded URLs)
- [x] All components standalone; Reactive Forms; new control flow syntax (`@if`)
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
