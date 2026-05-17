## Spec: Phase 10b — Error handling + empty states + skeletons across both clients
**FR references**: Phase 10 PROJECT.md items (error handling on all API failures)
**Status**: ⬜ Not Started
**Prerequisites**: 6b ✅, 8e3 ✅
**Size check**: cross-cutting polish; no new components except shared `ErrorState` + `EmptyState` + `LoadingSkeleton` per client; ≤ 8 files · 1 layer per client · fits one session ✅

### What
Audit every list screen and form submission across both mobile and web for: missing loading skeleton, missing empty state, missing error rendering. Add reusable `ErrorState` / `EmptyState` / `LoadingSkeleton` components per client and apply them consistently. Improve global error UX (network failures, 5xx) with a toast/snackbar system in both clients.

### Why
CLAUDE.md Mobile + Web standards mandate empty states + loading skeletons. Earlier phases enforced this per-screen, but consistency audit + a shared toast/error reporting layer is best done as a pass.

### New / Modified Files
- `apps/mobile/components/ui/{EmptyState.tsx,LoadingSkeleton.tsx,ErrorState.tsx,Toast.tsx}` — reusable; replace any ad-hoc inline implementations from earlier phases
- `apps/web-app/src/app/components/{empty-state,loading-skeleton,error-state,toast}/*.component.ts` — same
- Touch-up modifications: list screens missing skeleton or empty state get them; forms missing error rendering get inline error messages
- `apps/mobile/lib/api.ts` (modify Phase 1c version) — global error handler categorizes errors (network / 5xx / 4xx) and surfaces them via the Toast system
- `apps/web-app/src/app/interceptors/error.interceptor.ts` — new; categorizes HTTP errors and emits toast events via a `ToastService`

### Behavior
**Categorization**:
- Network failure (no response) → toast: "Connection lost — please try again"
- 500-class server error → toast: "Something went wrong on our end — please try again"
- 4xx errors → handled inline by the calling component (not toast); the global handler skips these

**Empty state semantics**: every list screen has one of these per data state: loading skeleton, empty state, error state, or content. Never an empty container.

**Toast system**: a small queue (1–3 visible at a time); auto-dismiss after 4 seconds; tap-to-dismiss; render at bottom for mobile, top-right for web. Mobile uses a custom NativeWind component (not Expo's built-in); web uses signal-based component.

**Audit checklist applied per screen**:
- [ ] Has loading state (skeleton or spinner)
- [ ] Has empty state for "no data" case
- [ ] Has error state for "fetch failed" case
- [ ] Form submissions show inline errors on 4xx
- [ ] Network failures surface via toast

### Done When
- [ ] All 4 reusable components exist in each client
- [ ] Every list screen audited and updated; checklist green per screen
- [ ] Toast system works on both clients
- [ ] Manual test: kill network mid-fetch → appropriate UX surfaced on every audited screen
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
