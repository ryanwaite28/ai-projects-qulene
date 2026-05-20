## Spec: Phase 8e2-b — Web business availability management page
**FR references**: FR-WEBAPP-13 (`/business/availability`), FR-AVL-01, FR-AVL-02, FR-AVL-04
**Status**: ✅ Implemented
**Prerequisites**: 2c ✅, 8c ✅ (AvailabilityWindow type in BusinessService), 8e2-a ✅
**Size check**: 3 files · 3 service functions · 1 layer (Angular source) · 1 screen · fits one session ✅

### What
Implement `/business/availability` as a real page. Adds `AvailabilityService` with three methods. The page displays a weekly grid (Sunday–Saturday) showing existing windows per day as deletable chips, and lets the business add new windows via an "Add Window" modal. The `AvailabilityWindow` type is imported from `business.service.ts`.

### Why
FR-AVL-01/02/04: business users must be able to define, view, and delete recurring weekly availability windows (max 14 total, max 2 per day).

### New / Modified Files
- `apps/web-app/src/app/services/availability.service.ts` *(new)* — `listMyAvailability(businessId)`, `addWindow(body)`, `removeWindow(windowId)`
- `apps/web-app/src/app/pages/business-availability.component.ts` *(new)* — weekly grid; add-window modal; delete chips; inline limit errors; business top-nav strip
- `apps/web-app/src/app/app.routes.ts` *(modify from 8e2-a)* — swap `PlaceholderComponent` → `BusinessAvailabilityComponent` for `/business/availability`

### Behavior
**`AvailabilityService`**: listMyAvailability → `GET /businesses/:businessId/availability`; addWindow → `POST /businesses/me/availability`; removeWindow → `DELETE /businesses/me/availability/:windowId`.

**Weekly grid**: 7 rows (Sun–Sat). Each row shows window chips (`startTime–endTime` + X delete button) sorted by startTime, plus a `+` button to open the add-window modal for that day. `deletingWindowId` signal disables the X during in-flight delete. Removing a window filters it from local state on success.

**Add-Window Modal**: Reactive Form — dayOfWeek (select, pre-filled from row click), startTime (time input, required), endTime (time input, required). Client-side `timeOrderError()` check: endTime ≤ startTime disables submit and shows inline message. On API error: 422 `DAY_LIMIT_REACHED` → "This day already has 2 windows."; 422 other → "You have reached the 14-window limit."; generic fallback.

**Loading skeleton**: 7 animated rows. On mount: decodes userId from JWT → `listMyAvailability(userId)`.

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] Weekly grid renders all 7 days with existing windows as chips
- [x] X on a chip removes the window; `deletingWindowId` disables button during call
- [x] `+` on a row opens modal with that day pre-filled
- [x] Client-side endTime > startTime validation blocks submit
- [x] Submit adds window to correct day; `LIMIT_REACHED`/`DAY_LIMIT_REACHED` shown inline
- [x] Loading skeleton present; business top-nav strip present
- [x] `app.routes.ts` wired for `/business/availability`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
