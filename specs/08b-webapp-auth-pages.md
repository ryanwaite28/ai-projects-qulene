## Spec: Phase 8b — Web auth + public pages (login, register, landing)
**FR references**: FR-WEBAPP-04, FR-WEBAPP-08, FR-WEBAPP-13 (public routes section)
**Status**: ⬜ Not Started
**Prerequisites**: 8a ✅
**Size check**: 4 files · 0 service functions (uses AuthService from 8a + adds one method) · 1 layer · 3 pages (at limit) · fits one session ✅

### What
Three pages of the web-app: landing (`/`), login, register. Both auth pages use Reactive Forms; register pages mirror the mobile flow (Cognito `signUp` → `POST /auth/profile`).

### Why
FR-WEBAPP-13 public route section: the entry doors to the web-app. Until these exist, no user can authenticate.

### New / Modified Files
- `apps/web-app/src/app/pages/landing/landing.component.ts` — hero + CTAs "Log in" + "Register" + "Browse businesses"; redirects authenticated users to role-appropriate home (`/business/dashboard` or `/customer/appointments`)
- `apps/web-app/src/app/pages/login/login.component.ts` — Reactive Form (email, password); on submit calls `authService.signIn` → on success navigates to role-appropriate home; on error renders inline message
- `apps/web-app/src/app/pages/register/register.component.ts` — Reactive Form (firstName, lastName, email, password, role select); on submit `authService.signUp` with `custom:role` attribute → on success POSTs `/auth/profile` → navigates to home
- `apps/web-app/src/app/services/auth.service.ts` (extend 8a) — add `registerAndSyncProfile(input)` method that chains Cognito signUp + profile sync (mirrors mobile's chained flow)

### Behavior
**Landing**: signal-based check — if `authService.currentUser()` exists, immediately `router.navigate` to home; else render hero. Tailwind layout matching marketing site visual language.

**Login**: form validation (email format, password min 8); spinner during submit; inline error on invalid credentials; success → navigate based on `currentUser().role`.

**Register**: same validators + `Validators.maxLength(50)` for names; role as required select (Business / Customer); on Cognito signUp success, immediately call backend `POST /auth/profile`; if profile POST fails, surface error but token is already stored — user can retry profile sync on next login (mirrors mobile flow).

**Standards**: Reactive Forms (FR-WEBAPP-11); standalone components (FR-WEBAPP-09); signals (FR-WEBAPP-10); HTTP only via AuthService (FR-WEBAPP-12).

### Done When
- [ ] Landing redirects authenticated users; renders hero for others
- [ ] Login form validates, submits, redirects on success
- [ ] Register form validates all fields including role; chains Cognito + profile sync
- [ ] Invalid credentials → inline error (not toast/alert)
- [ ] All 3 pages have empty/loading states
- [ ] All Reactive Forms; all standalone; signals used
- [ ] At least one navigation entry point per page (navbar links present)
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
