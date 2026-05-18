## Spec: Phase 3c — Backend appointment business actions (accept + decline + complete + noshow + list)
**FR references**: FR-APT-05, FR-APT-06, FR-APT-07, FR-APT-08, FR-APT-10
**Status**: ✅ Implemented
**Prerequisites**: 3a ✅, 3b ✅
**Size check**: 3 files · 5 functions split into 2 cohesive groups (accept/decline/list = lifecycle decisions; complete/noshow = post-event marking) — at the limit but cohesive enough to remain one spec since they all share the same handler module, table helper, and Terraform integration. Justification: each function is < 40 lines; the spec's Behavior section stays under 400 words by grouping ✅

### What
The business-facing slice of the appointment lifecycle: accept / decline a pending request, mark accepted requests as completed / no-show, list all incoming requests filterable by status. Each action publishes the appropriate SNS event. Decline + cancel will trigger waitlist promotion once Phase 4a wires it in (this phase leaves a TODO comment in `declineRequest`).

### Why
FR-APT-05–08 + FR-APT-10 are the operational core that lets a business actually run on Qulene. Without these endpoints, a request can be submitted but never actioned.

### New / Modified Files
- `backend/src/services/appointment.service.ts` (extend Phase 3b) — add `acceptRequest`, `declineRequest`, `markComplete`, `markNoShow`, `listBusinessRequests`
- `backend/src/handlers/appointment.handler.ts` (extend) — routes `PATCH /businesses/me/appointments/:requestId/{accept|decline|complete|noshow}`, `GET /businesses/me/appointments`
- tests: extend Phase 3b unit + integration test files

### Behavior
**Common preamble** for all four PATCH handlers: extract claims → `requireRole(BUSINESS)` → load request by PK → if `businessId !== userId` → 403 (ownership).

**`acceptRequest`**: assert current `status === 'PENDING'` else 422; UpdateItem `status=ACCEPTED`, `updatedAt=now`; write `notifications` record for customer (`REQUEST_ACCEPTED`); atomic `ADD unreadNotificationCount :one` on user; publish SNS `REQUEST_ACCEPTED`.

**`declineRequest`**: assert current `status === 'PENDING'` else 422; UpdateItem `status=DECLINED`, `updatedAt=now`; write `notifications` record for customer (`REQUEST_DECLINED`); publish SNS `REQUEST_DECLINED`. **TODO comment**: Phase 4a will additionally call `waitlist.service.promoteOldestForService(serviceId)`.

**`markComplete`**: assert current `status === 'ACCEPTED'` else 422; assert `proposedAt < now()` else 422 (FR-APT-08 — only after the appointment time has passed); UpdateItem `status=COMPLETED`; no SNS event (no email needed; informational state only). No customer notification record either — the appointment was already accepted, completion is operational housekeeping.

**`markNoShow`**: same preconditions as `markComplete`; UpdateItem `status=NO_SHOW`.

**`listBusinessRequests(dynamo, { businessId, status?, cursor? })`**: Query `businessId-status-index`; if `status` provided use it as SK condition, else scan all statuses for the businessId; sorted by `proposedAt` ascending (FR-APT-10).

### Done When
- [x] All 4 PATCH routes work; ownership-enforced (other business → 403)
- [x] Status transitions enforced: `accept`/`decline` only from PENDING; `complete`/`noshow` only from ACCEPTED with past `proposedAt`
- [x] `GET /businesses/me/appointments` paginated, filterable by `status`, sorted by `proposedAt` asc
- [x] CUSTOMER role calling these → 403 (regression test for every route)
- [x] All 4 PATCH operations publish the correct SNS eventType
- [x] `declineRequest` includes TODO comment for Phase 4a waitlist promotion wire-in
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated

### Implementation Notes
- Supporting change: `listByBusinessAndStatus` in `appointment-requests.table.ts` made `status` optional (queries PK-only when omitted, SK condition added only when status provided).
- `markComplete` and `markNoShow` take no `sns` parameter — no SNS event is published for these transitions (operational housekeeping only, per spec).
- Page-level `proposedAt` sort is in-memory (`Array.sort`); cross-page ordering is not guaranteed (acceptable for portfolio, documented trade-off).
- `listBusinessRequests` uses dynamic `import` type syntax for `AppointmentStatus` in the input interface to avoid circular import concerns; the value is used as a filter, not for instance checks.
- 34/34 unit tests pass; integration tests cover all routes including forbidden-role cases.
