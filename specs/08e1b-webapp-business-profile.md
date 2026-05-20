## Spec: Phase 8e1-b — Web business complete/noshow + profile page
**FR references**: FR-WEBAPP-13 (`/business/profile`), FR-APT-08, FR-BIZ-02, FR-BIZ-06
**Status**: ✅ Implemented
**Prerequisites**: 2a ✅, 8c ✅ (BusinessService exists), 8e1-a ✅
**Size check**: 5 files · 4 service functions · 1 layer (Angular source) · 1 new screen + 1 modified screen · fits one session ✅

### What
Completes the business dashboard (adds Complete/No-Show buttons to ACCEPTED rows past their proposed time) and implements the `/business/profile` page. Extends `AppointmentService` with `completeRequest`/`noShowRequest` and `BusinessService` with `updateMyProfile`/`requestAvatarUploadUrl`. Avatar upload uses the presigned-URL flow: file input → validate → `POST /businesses/me/avatar` for presigned URL → native `fetch` PUT to S3 directly → `PATCH /businesses/me` with final URL.

### Why
FR-APT-08: business users can mark accepted requests as COMPLETED or NO_SHOW only after the appointment time has passed. FR-BIZ-02/06: business users must be able to edit their profile and upload an avatar photo.

### New / Modified Files
- `apps/web-app/src/app/services/appointment.service.ts` *(modify from 8e1-a)* — add `completeRequest(requestId)`, `noShowRequest(requestId)`
- `apps/web-app/src/app/services/business.service.ts` *(modify from 8c)* — add `updateMyProfile(updates)`, `requestAvatarUploadUrl(contentType)`
- `apps/web-app/src/app/pages/business-dashboard.component.ts` *(modify from 8e1-a)* — add Complete/No-Show buttons to ACCEPTED rows where `proposedAt < now`; `isPast(proposedAt)` helper
- `apps/web-app/src/app/pages/business-profile.component.ts` *(new)* — Reactive Form for all profile fields; avatar upload flow; business top-nav strip
- `apps/web-app/src/app/app.routes.ts` *(modify from 8e1-a)* — swap `PlaceholderComponent` → `BusinessProfileComponent` for `/business/profile`

### Behavior

**`AppointmentService` additions**:
- `completeRequest(requestId)` → `PATCH /businesses/me/appointments/:requestId/complete`
- `noShowRequest(requestId)` → `PATCH /businesses/me/appointments/:requestId/noshow`

**`BusinessService` additions**:
- `updateMyProfile(updates: Partial<BusinessProfile>)` → `PATCH /businesses/me`
- `requestAvatarUploadUrl(contentType: string)` → `POST /businesses/me/avatar` with `{ contentType }`; returns `{ data: { uploadUrl: string } }`

**Dashboard Complete/No-Show**: ACCEPTED rows show Complete + No-Show buttons only when `isPast(req.proposedAt)` (FR-APT-08). Uses existing `actionInProgress` Set; updates row in-place on success.

**`BusinessProfileComponent`**: On mount decodes userId via `atob(token.split('.')[1]).sub` → calls `getBusinessById(userId)` to pre-fill form (404 → empty form, no error). All profile fields optional. Submit calls `updateMyProfile`; success shows green "Profile saved." banner. Avatar: file input validates type + size ≤ 5 MB → `requestAvatarUploadUrl` → native `fetch` PUT to S3 → strips query params for final `avatarUrl` → `updateMyProfile({ avatarUrl })` → shows local object URL preview.

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] ACCEPTED rows on dashboard show Complete/No-Show only when `proposedAt < now`; actions update row in-place
- [x] Profile page loads existing profile into form (or shows empty form on 404)
- [x] Profile form saves all fields via `PATCH /businesses/me`; success banner shown
- [x] Avatar file input validates type and size; presigned-URL upload flow implemented
- [x] Avatar preview shown after successful upload
- [x] Business top-nav strip present on profile page
- [x] `app.routes.ts` wired for `/business/profile`
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
