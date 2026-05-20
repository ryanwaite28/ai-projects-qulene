## Spec: Phase 8e3 — Web business waitlist + notifications pages
**FR references**: FR-WEBAPP-13 (`/business/waitlist`, `/business/notifications`), FR-WAIT-05, FR-NOTIF-03, FR-NOTIF-04, FR-NOTIF-05
**Status**: ✅ Implemented
**Prerequisites**: 4a ✅, 6a ✅, 8d1-b ✅ (WaitlistService), 8d2 ✅ (NotificationService + UserService), 8e2-a ✅ (ServiceManagementService)
**Size check**: 4 files · 1 service function · 1 layer (Angular source) · 2 screens · fits one session ✅

### What
Implement `/business/waitlist` and `/business/notifications`, completing the business route group. Extends `WaitlistService` with one business-facing read method. The waitlist page has a service dropdown (populated from `ServiceManagementService`) and lists queue entries for the selected service. The notifications page reuses `NotificationService` and `UserService` directly — same behavior as the customer page.

### Why
FR-WAIT-05: businesses must be able to view the waitlist per service. FR-NOTIF-03/04/05: both roles share the same notifications inbox behavior.

### New / Modified Files
- `apps/web-app/src/app/services/waitlist.service.ts` *(modify from 8d1-b)* — add `listBusinessWaitlistForService(serviceId)` → `GET /businesses/me/waitlist/:serviceId`
- `apps/web-app/src/app/pages/business-waitlist.component.ts` *(new)* — service selector dropdown + queue list with `#N` position; business top-nav strip
- `apps/web-app/src/app/pages/business-notifications.component.ts` *(new)* — paginated notifications + unread badge + mark-as-read; business top-nav strip
- `apps/web-app/src/app/app.routes.ts` *(modify from 8e2-b)* — swap `PlaceholderComponent` → real components for both routes

### Behavior
**Waitlist page**: on mount decodes userId → `listMyServices(userId)` populates dropdown. On service select → `listBusinessWaitlistForService(serviceId)` → entries listed with 1-based `#N` position + customerId + joined date. Read-only. Empty state per selection.

**Notifications page**: identical logic to `CustomerNotificationsComponent` — same `NotificationService`/`UserService` injections, same mark-as-read in-place behavior, same Load More. Business top-nav instead of customer top-nav.

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] Waitlist page populates service dropdown; selecting a service loads queue entries with `#N` positions
- [x] Empty state shown when service has no active waitlist entries
- [x] Notifications page renders paginated list; unread rows visually distinct; mark-as-read on click
- [x] Load More appends next page; empty state and loading skeleton on notifications
- [x] Both pages include business top-nav strip
- [x] `app.routes.ts` wired for both `/business/waitlist` and `/business/notifications`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
