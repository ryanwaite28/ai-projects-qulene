## Spec: Phase 6b — Mobile notifications screen + unread badge
**FR references**: FR-NOTIF-03, FR-NOTIF-04, FR-NOTIF-05
**Status**: ⬜ Not Started
**Prerequisites**: 1c ✅, 6a ✅
**Size check**: 3 files · 0 service functions · 1 layer (mobile) · 1 screen (shared between customer and business tabs) · fits one session ✅

### What
Fill in the placeholder "Notifications" tab in both customer and business tab bars with the notifications inbox screen. Add the `NotificationBadge` component that displays `unreadNotificationCount` as a small dot+number badge on the tab icon. Marks notifications as read when opened.

### Why
FR-NOTIF-03/04/05: customers and businesses need to see in-app notifications and have an unread badge for visibility.

### New / Modified Files
- `apps/mobile/app/(customer)/notifications.tsx` and `apps/mobile/app/(business)/notifications.tsx` (replace placeholders) — both render the same `<NotificationsList />` component
- `apps/mobile/components/NotificationsList.tsx` — shared between customer + business; paginated list rendering notifications with read/unread visual distinction; tapping a notification calls `PATCH /notifications/:id/read` and navigates to relevant detail (e.g., a REQUEST_ACCEPTED notif navigates to the corresponding appointment in My Appointments)
- `apps/mobile/components/NotificationBadge.tsx` — wraps a tab bar icon; reads `unreadNotificationCount` from a polled `GET /users/me` (every 60s when foregrounded); displays badge dot with count

### Behavior
**Notifications screen**: `GET /notifications` paginated with infinite scroll. Each row shows icon (by `type`), title (e.g., "Appointment accepted"), the `message` string, relative timestamp. Unread rows have a colored left border and bolder text. Tapping a row:
1. If `isRead === false`, optimistically updates UI + calls `PATCH /notifications/:id/read`
2. Navigates to a context-appropriate destination based on `type`:
   - `REQUEST_RECEIVED` (business) → business dashboard with PENDING filter
   - `REQUEST_ACCEPTED`/`REQUEST_DECLINED`/`REQUEST_CANCELLED` (customer) → my appointments
   - `WAITLIST_PROMOTED` (customer) → appointment request form for the service (pre-filled)
   - `SERVICE_REMOVED` (customer) → my appointments

**NotificationBadge**: polls `GET /users/me` every 60 seconds via a `useUserProfile` hook that exposes `unreadNotificationCount` reactively. Badge visible only when count > 0. Render as red circle with white number (cap at "99+").

**Empty state**: "No notifications yet — you're all caught up."

**Navigation completeness**: Notifications is a tab in both tab bars.

### Done When
- [ ] Both notifications tabs render the shared list
- [ ] Unread badge shows on tab icon when count > 0; updates after marking read
- [ ] Mark-as-read fires on tap; unread count decrements visibly
- [ ] Navigation by notification type works
- [ ] Empty state + loading skeleton present
- [ ] Polling stops when app backgrounded (battery)
- [ ] All NativeWind
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
