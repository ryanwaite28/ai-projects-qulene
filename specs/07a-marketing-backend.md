## Spec: Phase 7a — Backend web/contact + web/signup endpoints
**FR references**: FR-MKT-03, FR-MKT-05
**Status**: ⬜ Not Started
**Prerequisites**: 0c ✅
**Size check**: 6 files · 2 service functions (submitContactForm, joinWaitlistEmail) · 1 layer · 2 routes · fits one session ✅

### What
Implement the public (no-auth) endpoints used by the marketing SPA contact form and waitlist signup. Provision the `web-signups` DynamoDB table and the `lambda-contact` Lambda. Each submission stores a record and sends a notification email to the admin address.

### Why
FR-MKT-03 + FR-MKT-05: the marketing site is the only thing public visitors interact with; without these endpoints the contact form and waitlist signup are dead.

### New / Modified Files
- `backend/src/db/tables/web-signups.table.ts` — `putSignup` (idempotent on email PK; second insert returns existing record), `getSignupByEmail`
- `backend/src/services/contact.service.ts` — `submitContactForm(dynamo, ses, { name, email, message })` sends admin email; `joinWaitlistEmail(dynamo, { email })` puts row + sends admin notification
- `backend/src/handlers/contact.handler.ts` — routes `POST /web/contact`, `POST /web/signup`; no auth (API Gateway route configured without authorizer)
- `infra/terraform/modules/dynamodb-web-signups/main.tf` — table `qulene-{env}-web-signups` (PK: `email`)
- `infra/terraform/modules/lambda-contact/main.tf` — Lambda + IAM (dynamodb:PutItem/GetItem on web-signups, ses:SendEmail)
- tests: `backend/src/services/__tests__/contact.service.test.ts` + `backend/tests/integration/contact.handler.test.ts`

### Behavior
**`submitContactForm(dynamo, ses, { name, email, message })`**:
1. Shape validation in handler: `name` 1–100 chars, `email` valid format, `message` 1–2000 chars
2. Service: send admin email to `ADMIN_EMAIL` env var (configured per env in Secrets Manager) with subject "Qulene contact form: {name}" and body "From: {name} <{email}>\n\n{message}"
3. Do NOT store contact-form submissions in DynamoDB (no FR requires retention; email delivery is the artifact)
4. Return `{ data: { received: true } }`

**`joinWaitlistEmail(dynamo, { email })`**:
1. Shape validation in handler: valid email format
2. Service: `putSignup(dynamo, { email, createdAt: now })` — idempotent; PutItem with `ConditionExpression: attribute_not_exists(email)` (no error on conflict — just return existing)
3. Send admin notification "New marketing waitlist signup: {email}"
4. Return `{ data: { joined: true } }`

**No auth**: API Gateway routes `POST /web/contact` + `POST /web/signup` are configured without the Cognito authorizer. CORS is relaxed (marketing site origins: `qulene.com`, `www.qulene.com`, `dev.qulene.com`).

**Rate limiting**: deferred to Phase 9b (CloudWatch/WAF basic protection if needed). For portfolio scale, single-shot submissions are acceptable.

### Done When
- [ ] `POST /web/contact` accepts valid payload → admin email sent
- [ ] `POST /web/signup` accepts valid email → row in `web-signups` + admin email
- [ ] Duplicate signup → returns success without duplicate write (idempotent)
- [ ] CORS configured for marketing origins
- [ ] No auth on these two routes (verified — sending Authorization header has no effect; missing header succeeds)
- [ ] `dist/lambdas/contact/index.js` bundle present
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
