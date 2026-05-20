## Spec: Phase 6b — Mobile notifications screen + unread badge
**FR references**: FR-NOTIF-03, FR-NOTIF-04, FR-NOTIF-05
**Status**: ✅ Implemented
**Prerequisites**: 1c ✅, 6a ✅
**Size check**: 6 files · 3 hook functions · 1 layer (mobile only) · fits one session ✅

### What
Add a Notifications screen for both customer and business users, wire it into both tab bars, and display a numeric unread badge sourced from `GET /users/me`. Tapping a notification row marks it as read via `PATCH /notifications/:id/read` and updates the row in-place. Screen supports pull-to-refresh and a Load More button for pagination. `useUserApi` exposes `getMyProfile` for the badge; `useNotificationApi` exposes `listNotifications` and `markAsRead`.

### Why
FR-NOTIF-03/04/05 — users need an inbox to view and clear notifications; the unread badge is the primary engagement signal in the mobile app.

### New / Modified Files
- `apps/mobile/hooks/useUserApi.ts` — new; `getMyProfile(): Promise<User>`
- `apps/mobile/hooks/useNotificationApi.ts` — new; `listNotifications(cursor?)`, `markAsRead(notificationId)`
- `apps/mobile/app/(customer)/notifications.tsx` — new screen; infinite-scroll list, mark-as-read on tap, skeleton, empty state
- `apps/mobile/app/(business)/notifications.tsx` — new screen; same behavior for business users
- `apps/mobile/app/(customer)/_layout.tsx` — modified; notifications tab enabled, `tabBarBadge` from `unreadCount` fetched on mount
- `apps/mobile/app/(business)/_layout.tsx` — modified; notifications tab added with same badge logic

### Behavior
**`useUserApi.getMyProfile()`**: Calls `GET /users/me` via `useApi().request<User>()`.

**`useNotificationApi.listNotifications(cursor?)`**: Calls `GET /notifications` with optional `?cursor=`. Returns `{ notifications, nextCursor }`.

**`useNotificationApi.markAsRead(notificationId)`**: Calls `PATCH /notifications/{notificationId}/read`.

**Notifications screen**:
- On mount: fetches first page; shows 3 skeleton rows while loading
- Empty state: "No notifications yet" when list is empty after load
- Each row: `message` text + relative timestamp; unread rows `bg-indigo-50 border-indigo-200`, bold text; read rows `bg-white border-gray-100`, muted text
- Tap an unread row: calls `markAsRead`; updates `isRead: true` in local state; no navigation
- Pull-to-refresh resets to first page; Load More button appends when `nextCursor` non-null

**Tab badge**: Both layouts call `getMyProfile()` on mount, store `unreadCount` in state, pass `tabBarBadge={unreadCount > 0 ? unreadCount : undefined}`. Badge refreshes on layout re-mount (documented limitation — avoids global state).

### Done When
- [x] `GET /notifications` list renders with skeleton, empty state, and Load More
- [x] Unread rows visually distinct from read rows
- [x] Tap mark-as-read updates row in-place; idempotent via service layer guard
- [x] Pull-to-refresh resets list to first page
- [x] Notifications tab visible in customer tab bar with `tabBarBadge`
- [x] Notifications tab visible in business tab bar with same badge logic
- [x] `apps/mobile/app/(business)/notifications.tsx` created
- [x] `npx tsc --noEmit` passes clean in `apps/mobile/`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
