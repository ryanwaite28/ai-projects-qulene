## Spec: Phase 1c — Mobile auth (Cognito SDK + login + register)
**FR references**: FR-AUTH-01, FR-AUTH-04, FR-AUTH-06
**Status**: ⬜ Not Started
**Prerequisites**: 0b ✅, 1b ✅
**Size check**: 6 files · 0 service functions · 1 layer (mobile) · 2 screens (login, register) · fits one session ✅

### What
Full Expo Router scaffold for the mobile app plus the register/login screens. Cognito SDK setup (AWS Amplify Auth) reading IDs from `EXPO_PUBLIC_*` env vars. `useAuth` hook wraps Cognito session state; `useApi` hook injects `Authorization: Bearer <token>` on every API call. `_layout.tsx` redirects unauthenticated users to `/login`.

### Why
FR-AUTH-01 + FR-AUTH-04: users register and log in via Cognito. The mobile app is the first client; CLAUDE.md mandates `EXPO_PUBLIC_*` prefix for client-side env vars and Expo SecureStore for tokens (never AsyncStorage). The Phase 1a `POST /auth/profile` endpoint requires the mobile to chain Cognito signup → profile sync.

### New / Modified Files
- `apps/mobile/` — full Expo init (`expo init` skeleton: `App.tsx` removed, Expo Router enabled, NativeWind installed + configured, `tailwind.config.js`, `babel.config.js`, `tsconfig.json`)
- `apps/mobile/lib/cognito.ts` — Amplify Auth `configure()` call using `EXPO_PUBLIC_COGNITO_USER_POOL_ID` + `EXPO_PUBLIC_COGNITO_CLIENT_ID`; helper wrappers around `signUp`, `signIn`, `signOut`, `getCurrentSession`
- `apps/mobile/hooks/useAuth.ts` — React hook exposing `{ session, login, register, logout, isLoading }`; persists token via Expo SecureStore under key `qulene_access_token`
- `apps/mobile/hooks/useApi.ts` — typed `request<T>(path, init?)` that calls `getCurrentSession()` for a fresh token, injects `Authorization: Bearer`, prepends `EXPO_PUBLIC_API_URL`, parses response envelope and throws on `error`
- `apps/mobile/app/_layout.tsx` — root layout with `<Stack>`; redirects to `/login` when `useAuth().session` is null; renders tab navigation when authenticated
- `apps/mobile/app/(auth)/login.tsx` — email + password form (NativeWind), calls `useAuth().login`, navigates to home on success
- `apps/mobile/app/(auth)/register.tsx` — email + password + firstName + lastName + role-select form; on Cognito success calls `POST /auth/profile` via `useApi`; if profile call fails, retries on next login

### Behavior
**Registration flow**: user fills form → `signUp` to Cognito with `custom:role` attribute → on success, immediately POSTs to `/auth/profile` with `{ firstName, lastName }` → on success, navigates to role-appropriate home screen. If the profile POST fails, mark token in SecureStore with `profile_synced: false`; on next `useApi` invocation, retry the profile sync before any other call.

**Login flow**: `signIn` → token in SecureStore → navigate to home.

**Token lifecycle**: tokens stored in Expo SecureStore (never AsyncStorage). On 401 response, `useApi` clears the token and navigates to `/login`. Amplify Auth handles refresh-token rotation transparently.

**Styling**: NativeWind only — no `StyleSheet.create`, no `style={}`. Both screens include loading spinners and inline error messages on failure.

**Navigation completeness (CLAUDE.md 12.13)**: register screen has "Already have an account? Log in" link; login screen has "Don't have an account? Register" link.

### Done When
- [ ] Register (BUSINESS or CUSTOMER) → user record visible in DynamoDB
- [ ] Login persists session across app restarts (SecureStore)
- [ ] 401 response clears token + redirects to `/login`
- [ ] Both screens render correctly via NativeWind (no `StyleSheet.create` or inline `style={}`)
- [ ] Both routes have at least one navigation entry point
- [ ] `EXPO_PUBLIC_*` env vars used (no hardcoded URLs/IDs)
- [ ] Spec status updated to ✅ Implemented
- [ ] `IMPLEMENTATION_PLAN.md` progress tracker updated
