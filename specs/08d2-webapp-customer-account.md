## Spec: Phase 8d2 — Web customer notifications + profile pages
**FR references**: FR-WEBAPP-13 (`/customer/notifications`, `/customer/profile`), FR-NOTIF-03, FR-NOTIF-04, FR-NOTIF-05
**Status**: ⬜ Not Started
**Prerequisites**: 6a ✅, 8a ✅
**Size check**: 4 files · 2 services · 1 layer · 2 pages · fits one session ✅

### What
Web equivalents of Phase 6b notifications screen and customer profile editing. `NotificationService` + `UserService` Angular services added. Notifications page with unread badge in the sidebar; profile page with editable firstName / lastName.

### Why
FR-WEBAPP-13 customer route group: completes the customer-facing surface.

### New / Modified Files
- `apps/web-app/src/app/services/notification.service.ts` — `listNotifications({ cursor? })`, `markAsRead(notificationId)`
- `apps/web-app/src/app/services/user.service.ts` — `getMyProfile()`, `updateMyName({ firstName, lastName })`
- `apps/web-app/src/app/pages/customer/notifications/notifications.component.ts` — list, unread visual, click-to-mark-read + navigate by type
- `apps/web-app/src/app/pages/customer/profile/profile.component.ts` — Reactive Form for firstName/lastName; email + role read-only

### Behavior
**Notifications page**: paginated list using `notificationService.listNotifications`. Unread rows have colored left border + bold text. Tapping a row optimistically marks read + calls API + navigates by type (mirrors mobile mapping in 6b).

**Profile page**: on mount, `userService.getMyProfile()` populates form; submit calls `updateMyName`. Email field shown but disabled (Cognito controls it); role field shown but disabled (immutable). Avatar upload **not** in this spec (customers don't have avatars per FR-BIZ-06 which is business-only).

**Unread badge in sidebar**: signal-based count fetched on app init from `userService.getMyProfile()`; updated when `markAsRead` succeeds. (Polling not implemented in web — Phase 10b can add WebSocket or polling if scope allows; for portfolio MVP, the count is fresh at page load.)

**Standards**: signals; Reactive Forms; standalone; service-layer HTTP only.

### Done When
- [ ] Notifications page renders, paginates, marks-read on tap
- [ ] Tap navigation by notification type works
- [ ] Profile page edits firstName/lastName; email/role read-only
- [ ] Sidebar unread badge visible when count > 0
- [ ] Empty/loading states present
- [ ] Navigation entry points: customer sidebar links
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
