## Spec: Phase 8e2 — Web business services + availability pages
**FR references**: FR-WEBAPP-13 (`/business/services`, `/business/availability`), FR-SVC-01, FR-SVC-02, FR-SVC-03, FR-AVL-01, FR-AVL-02, FR-AVL-04
**Status**: ✅ Implemented
**Prerequisites**: 2b ✅, 2c ✅, 8a ✅
**Size check**: 4 files · 2 services · 1 layer · 2 pages · fits one session ✅

### What
Web equivalents of the mobile business services and availability management screens. Adds `ServiceService` and `AvailabilityService` Angular services.

### Why
FR-WEBAPP-13 business route group: managers need parity to operate from desktop.

### New / Modified Files
- `apps/web-app/src/app/services/service.service.ts` — `listMyServices`, `createService`, `updateService`, `softDeleteService`
- `apps/web-app/src/app/services/availability.service.ts` — `listMyAvailability`, `addWindow`, `removeWindow`
- `apps/web-app/src/app/pages/business/services/services.component.ts` — list with create/edit modals, pause toggle, delete; inline error on FR-SVC-02 LIMIT_REACHED
- `apps/web-app/src/app/pages/business/availability/availability.component.ts` — weekly grid, add-window modal with day + start/end, delete on click; inline error on FR-AVL-02 limits

### Behavior
**Services page**: table or card grid of own services with status badges (ACTIVE/PAUSED). FAB or "+ Add Service" opens the create modal with Reactive Form (name, description, durationMinutes, price as integer dollars stored as cents, status select). Edit reuses the same modal pre-filled. Delete confirms via dialog → `softDeleteService` → optimistic remove.

**Availability page**: 7-row weekly view (Sun – Sat) showing existing windows as chips. Each row has a "+" button → opens add-window modal (dayOfWeek pre-filled, start/end time inputs). Delete via X on each chip. Server-side validation errors render inline.

**Standards**: Reactive Forms; signals; standalone; service-layer HTTP only.

### Done When
- [x] Services CRUD operations all work; FR-SVC-02 limit error inline
- [x] Availability add/remove works; FR-AVL-02 limits enforced + surfaced inline
- [x] Empty + loading states present
- [x] Navigation entry points: business sidebar links
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
