## Spec: Phase 5b — Email rendering (renderer + ses.client + 6 Handlebars templates)
**FR references**: FR-EMAIL-01, FR-EMAIL-02, FR-EMAIL-03, FR-EMAIL-04, FR-EMAIL-05, FR-EMAIL-06, FR-EMAIL-07
**Status**: ⬜ Not Started
**Prerequisites**: 0a ✅
**Size check**: 8 files · 1 service (renderer) · 1 layer (backend) · 0 Terraform · fits one session ✅

### What
Implement the Handlebars rendering pipeline and the SES client wrapper. Author the 6 `.hbs` email templates (one per `FR-EMAIL-*` notification type). Configure esbuild to bundle `.hbs` files as text via the existing loader added in Phase 1a.

### Why
FR-EMAIL-01–07 specify exactly what each email contains. CLAUDE.md "Settled Decisions" pins Handlebars + `.hbs` files — never string interpolation for HTML. The Phase 5c consumer needs these rendering primitives to exist.

### New / Modified Files
- `backend/src/clients/ses.client.ts` — `createSesClient()`; `sendEmail(ses, { to, subject, html })` wraps SDK; uses `SES_FROM_EMAIL` env var
- `backend/src/emails/email.renderer.ts` — `renderTemplate(templateName, data)` Handlebars compile + render; lazy-cache compiled templates per cold start
- `backend/src/emails/templates/request-received.hbs` — to business: customer name, service name, formatted proposed time, optional notes
- `backend/src/emails/templates/request-accepted.hbs` — to customer: business name, service name, confirmed time
- `backend/src/emails/templates/request-declined.hbs` — to customer: business name, service name, "you may rebook or join the waitlist"
- `backend/src/emails/templates/request-cancelled.hbs` — to business: customer name, service name, proposed time
- `backend/src/emails/templates/waitlist-promoted.hbs` — to customer: business name, service name, invitation to book CTA
- `backend/src/emails/templates/service-removed.hbs` — to customer: business name, service name, apology message
- tests: `backend/src/emails/__tests__/email.renderer.test.ts` — snapshot tests for each template with representative data

### Behavior
**`renderTemplate(templateName, data)`**: loads the template file (text-loaded via esbuild), compiles with `Handlebars.compile`, caches the compiled function in a module-level Map keyed by templateName, renders with `data`. Returns the rendered HTML string. Throws `TemplateNotFoundError` if the template name isn't one of the 6.

**`sendEmail(ses, { to, subject, html })`**: SES `SendEmailCommand` with `Source: process.env.SES_FROM_EMAIL`, `Destination: { ToAddresses: [to] }`, `Message: { Subject, Body: { Html } }`. **Errors are caught and logged at the call site** (in `notification.service.ts` Phase 5c) — `sendEmail` itself does NOT swallow errors (so we don't lose visibility); the caller decides whether to swallow (FR-NOTIF-06 — for notifications, yes).

**Template variables** (common across all 6): `businessName`, `customerFirstName`, `serviceName`, `formattedProposedAt` (e.g., "Friday, March 6 at 2:30 PM"), `notes?`, plus type-specific (e.g., promoted email includes a `bookingUrl` placeholder for the eventual web-app URL).

**Template style**: minimal inline-CSS HTML; no external assets; mobile-friendly. Plaintext alternative is not required for portfolio scope.

### Done When
- [ ] All 6 `.hbs` templates exist with all required FR fields
- [ ] `renderTemplate` produces snapshot-tested output for each template
- [ ] Caching: second call for the same template does not re-compile (verified by spy on `Handlebars.compile`)
- [ ] esbuild bundles `.hbs` files as text loader; bundled `dist/lambdas/notification/index.js` includes the template strings
- [ ] `ses.client` reads `SES_FROM_EMAIL` env var
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
