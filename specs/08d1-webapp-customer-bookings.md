## Spec: Phase 8d1 — Web customer appointments + waitlist pages
**FR references**: FR-WEBAPP-13 (`/customer/appointments`, `/customer/waitlist`), FR-APT-01, FR-APT-09, FR-APT-11, FR-WAIT-01, FR-WAIT-02, FR-WAIT-03
**Status**: ⬜ Not Started
**Prerequisites**: 3b ✅, 4a ✅, 8a ✅
**Size check**: 4 files · 2 services · 1 layer · 2 pages · fits one session ✅

### What
Web equivalents of Phases 3d + 4b: appointments page (with new-request modal flow) and waitlist page. Adds the Angular services `AppointmentService` and `WaitlistService`.

### Why
FR-WEBAPP-13 customer route group: parity with mobile customer booking flows.

### New / Modified Files
- `apps/web-app/src/app/services/appointment.service.ts` — `createRequest`, `cancelRequest`, `listCustomerRequests` — all `Observable<T>`
- `apps/web-app/src/app/services/waitlist.service.ts` — `joinWaitlist`, `leaveWaitlist`, `listCustomerEntries` — all `Observable<T>`
- `apps/web-app/src/app/pages/customer/appointments/appointments.component.ts` — list of customer requests, status badges, per-row Cancel, new-request modal (opens from `/businesses/:id` "Request Appointment" or from the "+" FAB)
- `apps/web-app/src/app/pages/customer/waitlist/waitlist.component.ts` — list of entries, per-row Leave, "Book Now" CTA on PROMOTED rows linking to new-request modal pre-filled

### Behavior
**Appointments page**: paginated list using `appointmentService.listCustomerRequests`. Each row uses signal-derived status badge. Cancel confirms via Angular Material-free modal (custom Tailwind dialog). New-request modal contains the form (serviceId — from query param or service picker, proposedAt datetime, notes) with one-shot `idempotencyKey = crypto.randomUUID()` per modal mount.

**Waitlist page**: similar list + per-row Leave action. PROMOTED row's "Book Now" opens the appointment modal pre-filled with the serviceId.

**Cross-page wiring**: business detail (Phase 8c) "Request Appointment" button on a service → navigates to `/customer/appointments?openModal=true&serviceId=...`; the appointments page reads the query params and auto-opens the modal.

**Error UX**: 409 (duplicate active request OR waitlist conflict) → inline message in modal; 422 (past time) → inline message; 404 (service deleted) → toast + close modal.

**Standards**: signals for all state; Reactive Forms for the modal; standalone; service layer HTTP only.

### Done When
- [ ] Appointments page renders + paginates; Cancel works with confirmation
- [ ] New-request modal validates + submits with idempotencyKey; replay creates no duplicate
- [ ] Waitlist page renders + Leave works
- [ ] PROMOTED row's Book Now opens pre-filled modal
- [ ] Empty + loading states present
- [ ] Reactive Forms only; signals only; no HTTP in components
- [ ] Navigation entry points: customer sidebar links to both
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
