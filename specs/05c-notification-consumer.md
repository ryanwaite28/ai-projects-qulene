## Spec: Phase 5c — Notification consumer (routing + handler + E2E test)
**FR references**: FR-EMAIL-02, FR-EMAIL-03, FR-EMAIL-04, FR-EMAIL-05, FR-EMAIL-06, FR-EMAIL-07, FR-NOTIF-06, FR-SVC-05 (cascade)
**Status**: ✅ Implemented
**Prerequisites**: 3c ✅, 4a ✅, 5a ✅, 5b ✅
**Size check**: 3 files · 6 send functions (one per email type) + 1 router + 1 cascade for SERVICE_REMOVED. The 6 send functions are mechanically similar — each is `fetch records → render template → ses.sendEmail`; cohesive enough to live in one module. Counting as 1 service group + 1 router · 1 layer · 0 routes (SQS-triggered) ✅

### What
The SQS consumer Lambda that pulls events from `qulene-{env}-notifications`, parses the SNS envelope, routes by `eventType`, fetches the necessary DynamoDB records, renders the appropriate Handlebars template, and sends the email via SES. Implements the `SERVICE_REMOVED` cascade: cancels affected PENDING/ACCEPTED appointments and emails each affected customer (FR-SVC-05).

### Why
Closes the loop on every async lifecycle event. Without this, SNS publishes from Phases 3b/3c/4a + service deletes from Phase 2b are silent — customers and businesses never receive emails.

### New / Modified Files
- `backend/src/services/notification.service.ts` (extend Phase 6a will add more) — `sendRequestReceived`, `sendRequestAccepted`, `sendRequestDeclined`, `sendRequestCancelled`, `sendWaitlistPromoted`, `sendServiceRemovedCascade` (latter does the FR-SVC-05 cascade)
- `backend/src/handlers/notification.handler.ts` — replaces the stub from Phase 5a; SQS event handler that parses `Records[i].body → SNS envelope → envelope.Message → { eventType, payload }` and routes
- tests: `backend/tests/integration/notification.e2e.test.ts` — full E2E: create appointment via 3b API → wait for SQS message in MiniStack → verify SES captured email payload via MiniStack inspection endpoint

### Behavior
**Handler `handler(event: SQSEvent)`**: for each record:
1. Parse `record.body` as JSON → SNS envelope; parse `envelope.Message` as JSON → `{ eventType, payload }`
2. Switch on `eventType`:
   - `REQUEST_RECEIVED` → `sendRequestReceived(dynamo, ses, { appointmentRequestId })`
   - `REQUEST_ACCEPTED` → `sendRequestAccepted(...)`
   - `REQUEST_DECLINED` → `sendRequestDeclined(...)`
   - `REQUEST_CANCELLED` → `sendRequestCancelled(...)`
   - `WAITLIST_PROMOTED` → `sendWaitlistPromoted(dynamo, ses, { waitlistEntryId })`
   - `SERVICE_REMOVED` → `sendServiceRemovedCascade(dynamo, ses, sns, { serviceId })`
   - **default**: log warn "Unknown event type" + ACK (do NOT throw — never poison DLQ with unknown events per CLAUDE.md Async Event Contracts)
3. Each send function:
   1. Loads referenced records (appointment + business + service + customer)
   2. `renderTemplate(templateName, data)` — Phase 5b
   3. `sendEmail(ses, { to, subject, html })`
   4. **Failure handling**: try/catch the entire send flow — log `{ level: 'error', action: 'send*', error }` and return without throwing (FR-NOTIF-06 — never fail the SQS message; emails are best-effort, originating operations already succeeded)

**`sendServiceRemovedCascade(dynamo, ses, sns, { serviceId })`**:
1. Query appointment-requests via `serviceId-index` filter `status IN [PENDING, ACCEPTED]`
2. For each: UpdateItem `status='CANCELLED'`, update `updatedAt`, write notification row for customer with type `SERVICE_REMOVED`, send service-removed.hbs email
3. Publish a single `REQUEST_CANCELLED` SNS event per affected request? — NO; we already cancelled them above and emailed them; re-publishing would double-email. Document this decision.

### Done When
- [x] All 6 `send*` functions render + SES.send the correct template
- [x] Unknown event type → silent ACK (never re-thrown, never DLQ'd)
- [x] Email send failures caught + logged but do not throw (early return on missing records tested)
- [x] E2E test: 8/8 tests pass — all 6 eventTypes exercised + unknown + missing record cases
- [x] `SERVICE_REMOVED` cascade cancels affected requests (PENDING+ACCEPTED) + emails each customer; COMPLETED unaffected (verified in DynamoDB)
- [x] `dist/lambdas/notification/index.js` bundle replaces Phase 5a stub; templates inlined confirmed
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
