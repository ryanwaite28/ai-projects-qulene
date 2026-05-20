## Spec: Phase 8d2 — Web customer notifications + profile pages
**FR references**: FR-WEBAPP-13 (`/customer/notifications`, `/customer/profile`), FR-NOTIF-03, FR-NOTIF-04, FR-NOTIF-05
**Status**: ✅ Implemented
**Prerequisites**: 6a ✅, 8a-c ✅, 8d1-a ✅
**Size check**: 5 files · 4 service functions · 1 layer (Angular source) · 2 screens · fits one session ✅

### What
Implement `/customer/notifications` and `/customer/profile` as real pages, completing the customer route group. Adds `NotificationService` (`listNotifications`, `markAsRead`) and `UserService` (`getMyProfile`, `updateMyName`). Both new pages include a customer top-nav strip linking to all four customer routes — this is the navigation entry point for the new pages.

### Why
FR-WEBAPP-13: the two remaining customer routes must be real pages. FR-NOTIF-03/04: customers must be able to read and acknowledge notifications. FR-NOTIF-05: unread count surfaced on the notifications page at load.

### New / Modified Files
- `apps/web-app/src/app/services/notification.service.ts` *(new)* — `listNotifications(cursor?)`, `markAsRead(notificationId)`
- `apps/web-app/src/app/services/user.service.ts` *(new)* — `getMyProfile()`, `updateMyName({ firstName, lastName })`
- `apps/web-app/src/app/pages/customer-notifications.component.ts` *(new)* — paginated list; unread count badge; click-to-mark-read in-place; Load More; loading skeleton; top-nav strip
- `apps/web-app/src/app/pages/customer-profile.component.ts` *(new)* — Reactive Form for firstName/lastName (required, maxLength 50); email/role read-only display; loading skeleton; top-nav strip
- `apps/web-app/src/app/app.routes.ts` *(modify from 8d1-b)* — swap `PlaceholderComponent` → real components for `/customer/notifications` and `/customer/profile`

### Behavior
**Notifications page**: paginated list via `listNotifications`. Unread rows: yellow-50 background + left yellow border + bold text. Read rows: white background, muted text. Click on unread row calls `markAsRead`; updates row in-place and decrements local unread count; clicking a read row is a no-op. Load More appends next page when `nextCursor` non-null. Empty state: "No notifications yet." Skeleton: 3 animated rows while loading. Unread count fetched from `getMyProfile()` on mount; displayed as badge in top-nav Notifications tab.

**Profile page**: On mount, `getMyProfile()` pre-fills firstName/lastName and stores email/role in signals for read-only display. Submit calls `updateMyName`; success shows inline "Profile updated." green banner; 422 shows inline error; other errors show generic message.

**Top-nav**: Both pages include a horizontal strip with RouterLinks to Appointments · Waitlist · Notifications · Profile, with `routerLinkActive` class highlighting the active tab.

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] Notifications page renders paginated list; unread rows visually distinct; click marks read in-place
- [x] Load More appends next page; empty state and loading skeleton present
- [x] Profile page pre-fills from API; email/role read-only; save calls PATCH /users/me
- [x] Both pages include top-nav strip linking to all 4 customer routes
- [x] `app.routes.ts` routes wired to real components
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
