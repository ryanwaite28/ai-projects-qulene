## Spec: Phase 8e1 — Web business dashboard + profile (with avatar upload)
**FR references**: FR-WEBAPP-13 (`/business/dashboard`, `/business/profile`), FR-APT-05, FR-APT-06, FR-APT-07, FR-APT-08, FR-APT-10, FR-BIZ-02, FR-BIZ-06
**Status**: ⬜ Not Started
**Prerequisites**: 2a ✅, 3c ✅, 8a ✅
**Size check**: 3 files · 0 services (uses BusinessService from 8c + AppointmentService from 8d1) · 1 layer · 2 pages · fits one session ✅

### What
Web equivalents of Phases 2d (business profile) and 3e (incoming requests dashboard). Avatar upload via the presigned URL flow from Phase 2a.

### Why
FR-WEBAPP-13 business route group + the core operational surface for business users.

### New / Modified Files
- `apps/web-app/src/app/services/business.service.ts` (extend 8c) — add `updateMyProfile`, `requestAvatarUploadUrl`
- `apps/web-app/src/app/pages/business/dashboard/dashboard.component.ts` — incoming requests dashboard with status filter chips + per-row action buttons (Accept/Decline for PENDING; Complete/No-Show for past ACCEPTED) — uses AppointmentService.listBusinessRequests
- `apps/web-app/src/app/pages/business/profile/profile.component.ts` — Reactive Form for business profile fields; avatar upload via file input → presigned PUT → `PATCH /businesses/me { avatarUrl }`

### Behavior
**Dashboard page**: chip filter (All / Pending / Accepted / Past); list of AppointmentCard components; each card has Accept/Decline (if PENDING) or Complete/No-Show (if ACCEPTED & past). On action, optimistic UI update + API call + on-success toast. Empty state per filter.

**Profile page**: GET `/businesses/{userId}` on mount (may 404 → empty form); submit calls `updateMyProfile`. Avatar: file input → validate size + type → request presigned URL via `requestAvatarUploadUrl` → upload to S3 directly → call `updateMyProfile({ avatarUrl })`. Show upload progress + preview.

**Standards**: Reactive Forms; signals; standalone; service-layer HTTP only.

### Done When
- [ ] Dashboard renders requests with correct action buttons per status
- [ ] Accept/Decline/Complete/No-Show all work + update row
- [ ] Profile form submits + persists; avatar upload works end-to-end
- [ ] Empty + loading states present
- [ ] Navigation entry points: business sidebar links
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
