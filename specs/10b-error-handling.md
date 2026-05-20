## Spec: Phase 10b — Error handling + empty states (both clients)
**FR references**: CLAUDE.md Mobile Code Standards (empty states + loading skeletons required on every list screen); CLAUDE.md Web Code Standards (same)
**Status**: ✅ Implemented
**Prerequisites**: 6b ✅, 8e3 ✅, 10a ✅
**Size check**: split into 10b-a (infrastructure ✅) + 10b-b (screen touch-ups)

---

## Sub-spec 10b-a — Error handling infrastructure
**Status**: ✅ Implemented

### New / Modified Files
- `apps/mobile/components/ui/ErrorState.tsx` — new; props `{ message, onRetry }`;  NativeWind-styled
- `apps/mobile/hooks/useApi.ts` (modify) — `fetchWithNetworkGuard` wraps `fetch()`; `TypeError` → `Alert.alert` + rethrow as `ApiError('NETWORK_ERROR', ...)`
- `apps/web-app/src/app/components/error-state.component.ts` — new; standalone; `@Input() message`; `@Output() retry`
- `apps/web-app/src/app/services/toast.service.ts` — new; `toasts = signal<Toast[]>([])`; `show(message)` auto-dismisses after 4 s
- `apps/web-app/src/app/components/toast.component.ts` — new; standalone; fixed top-right overlay; reads `ToastService.toasts()`
- `apps/web-app/src/app/interceptors/error.interceptor.ts` — new; `status === 0` → network toast; `status >= 500` → server error toast; 4xx passes through
- `apps/web-app/src/app/app.component.ts` (modify) — added `<app-toast />`
- `apps/web-app/src/app/app.config.ts` (modify) — `withInterceptors([authInterceptor, errorInterceptor])`

### Done When
- [x] `ErrorState.tsx` exists under `apps/mobile/components/ui/`
- [x] `error-state.component.ts` exists under `apps/web-app/src/app/components/`
- [x] `useApi.ts`: network failure (TypeError) → Alert shown, ApiError('NETWORK_ERROR') thrown
- [x] `ToastService` + `ToastComponent` compiled and wired into app root
- [x] `error.interceptor.ts` registered in `app.config.ts`
- [x] Sub-spec status ✅ Implemented

---

## Sub-spec 10b-b — Screen error state touch-ups
**Status**: ✅ Implemented
**Prerequisites**: 10b-a ✅

### What
Add `fetchError` state/signal to every list screen in both clients. On fetch failure the screen renders `<ErrorState>` with a retry callback instead of silently showing the empty state.

### New / Modified Files
Screen modifications — add `fetchError` state + `<ErrorState>` conditional (replaces silent empty-on-error):
- `apps/mobile/app/(customer)/appointments.tsx` (modify)
- `apps/mobile/app/(customer)/waitlist.tsx` (modify)
- `apps/mobile/app/(customer)/notifications.tsx` (modify)
- `apps/mobile/app/(business)/dashboard.tsx` (modify)
- `apps/mobile/app/(business)/services.tsx` (modify)
- `apps/mobile/app/(business)/waitlist/[serviceId].tsx` (modify)
- `apps/web-app/src/app/pages/customer-appointments.component.ts` (modify)
- `apps/web-app/src/app/pages/customer-waitlist.component.ts` (modify)
- `apps/web-app/src/app/pages/customer-notifications.component.ts` (modify)
- `apps/web-app/src/app/pages/business-dashboard.component.ts` (modify)
- `apps/web-app/src/app/pages/business-services.component.ts` (modify)
- `apps/web-app/src/app/pages/business-waitlist.component.ts` (modify)

### Behavior
**Mobile pattern** (per list screen):
```tsx
const [fetchError, setFetchError] = useState<string | null>(null);
// in load() catch: setFetchError(err instanceof ApiError ? err.message : 'Something went wrong');
// in render, before empty/list branch:
{fetchError ? (
  <ErrorState message={fetchError} onRetry={() => { setFetchError(null); load(undefined, true); }} />
) : items.length === 0 ? ( /* empty state */ ) : ( /* list */ )}
```

**Web pattern** (per list page):
```typescript
error = signal<string | null>(null);
// in catchError: this.error.set(message); return EMPTY;
// in template: @if (error()) { <app-error-state [message]="error()" (retry)="load()" /> }
```

Skeleton renders during `isLoading` — unchanged. Error state replaces empty state when fetch fails.

### Done When
- [x] All 6 mobile list screens show `<ErrorState>` on fetch failure, not silent empty
- [x] All 6 web list pages same
- [x] `ng lint` exits 0 after changes
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
