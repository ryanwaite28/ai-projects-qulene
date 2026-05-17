## Spec: Phase 8e3 — Web business waitlist + notifications pages
**FR references**: FR-WEBAPP-13 (`/business/waitlist`, `/business/notifications`), FR-WAIT-05, FR-NOTIF-03, FR-NOTIF-04, FR-NOTIF-05
**Status**: ⬜ Not Started
**Prerequisites**: 4a ✅, 6a ✅, 8a ✅
**Size check**: 2 files · 0 services (extends WaitlistService 8d1 + NotificationService 8d2) · 1 layer · 2 pages · fits one session ✅

### What
Two web pages for business users: waitlist view per service and notifications inbox (same component as customer-side notifications — both roles use the same screen, mirroring mobile).

### Why
FR-WEBAPP-13: completes the business-side route group.

### New / Modified Files
- `apps/web-app/src/app/services/waitlist.service.ts` (extend 8d1) — add `listBusinessWaitlistForService(serviceId)`
- `apps/web-app/src/app/pages/business/waitlist/business-waitlist.component.ts` — service selector at top + queue list below; reused per service
- `apps/web-app/src/app/pages/business/notifications/business-notifications.component.ts` — thin wrapper around the shared notifications list component (also used by customer 8d2)

### Behavior
**Business waitlist page**: signal-based `selectedServiceId`. Top: dropdown listing the business's active services. Below: list of active waitlist entries for that service in queue order with `#N` position, customer first name, joined-at timestamp. Read-only — businesses cannot remove entries.

**Business notifications page**: identical to customer notifications page — same `<NotificationsList>` component, same mark-read behavior, same type-to-route mapping.

**Refactor opportunity**: the notifications page in 8d2 should be extracted into a shared component (`shared/notifications-list/notifications-list.component.ts`) when both business + customer use it. If 8d2 already centralized the logic, this phase just imports and renders it.

**Standards**: signals; standalone; service-layer HTTP only.

### Done When
- [ ] Waitlist page lets business pick a service + view queue
- [ ] Notifications page mirrors customer notifications behavior
- [ ] Empty + loading states present
- [ ] Navigation entry points: business sidebar links
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
