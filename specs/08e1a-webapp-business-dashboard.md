## Spec: Phase 8e1-a — Web business dashboard (list + accept + decline)
**FR references**: FR-WEBAPP-13 (`/business/dashboard`), FR-APT-05, FR-APT-06, FR-APT-07, FR-APT-10
**Status**: ✅ Implemented
**Prerequisites**: 3c ✅, 8a-c ✅, 8d1-a ✅ (AppointmentService exists; this extends it)
**Size check**: 3 files · 3 service functions · 1 layer (Angular source) · 1 screen · fits one session ✅

### What
Implement `/business/dashboard` as a real page. Extends `AppointmentService` with three business-facing methods. The dashboard lists all incoming appointment requests for the business, filterable by status. PENDING rows show Accept and Decline action buttons. ACCEPTED rows display status-only (Complete/No-Show buttons added in 8e1-b). Includes a business top-nav strip for all business routes (entry point for all business pages).

**Note**: 8e1 is split into 8e1-a (this spec) and 8e1-b (complete/noshow + profile page) because the full scope exceeds the 4-function limit. 8e1-b depends on this spec.

### Why
FR-APT-05/06/07/10: business users must be able to view, accept, and decline incoming appointment requests.

### New / Modified Files
- `apps/web-app/src/app/services/appointment.service.ts` *(modify from 8d1-a)* — add `listBusinessRequests(status?, cursor?)`, `acceptRequest(requestId)`, `declineRequest(requestId)`
- `apps/web-app/src/app/pages/business-dashboard.component.ts` *(new)* — filter chips + request list; Accept/Decline buttons on PENDING rows; status badges; top-nav strip
- `apps/web-app/src/app/app.routes.ts` *(modify from 8d2)* — swap `PlaceholderComponent` → `BusinessDashboardComponent` for `/business/dashboard`

### Behavior

**`AppointmentService` additions**:
- `listBusinessRequests(status?: AppointmentStatus, cursor?: string)` → `GET /businesses/me/appointments?status=<status>&cursor=<cursor>` — returns `{ data: AppointmentRequest[]; nextCursor: string | null }`
- `acceptRequest(requestId: string)` → `PATCH /businesses/me/appointments/:requestId/accept` — returns `{ data: AppointmentRequest }`
- `declineRequest(requestId: string)` → `PATCH /businesses/me/appointments/:requestId/decline` — returns `{ data: AppointmentRequest }`

**`BusinessDashboardComponent`** signals: `requests`, `loading`, `nextCursor`, `activeFilter`, `actionInProgress` (Set of requestIds currently being actioned).

**Filter chips**: All · Pending · Accepted · Declined · Cancelled · Completed · No Show. Selecting a chip resets the list and fetches with that status filter. Active chip highlighted with brand color.

**Request rows**: serviceId, customerId, proposedAt (formatted), status badge. PENDING rows additionally show Accept and Decline buttons. Clicking sets requestId in `actionInProgress`, calls service, updates row in-place on success.

**Load More**: cursor-based pagination.

**Business top-nav**: horizontal strip with RouterLinks to Dashboard · Profile · Services · Availability · Waitlist · Notifications, with `routerLinkActive` highlighting.

### Done When
- [x] `ng build` exits 0
- [x] `ng lint` exits 0
- [x] Dashboard renders request list with status badges and Load More pagination
- [x] Filter chips switch between status views; "All" shows unfiltered list
- [x] PENDING rows show Accept and Decline buttons; clicking either updates row in-place
- [x] `actionInProgress` prevents double-click during in-flight request
- [x] Empty state shown when list is empty (both unfiltered and filtered)
- [x] Loading skeleton present on initial load
- [x] Business top-nav strip links to all 6 business routes
- [x] `app.routes.ts` wired for `/business/dashboard`
- [x] IMPLEMENTATION_PLAN.md updated with 8e1-a/8e1-b sub-spec split
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
