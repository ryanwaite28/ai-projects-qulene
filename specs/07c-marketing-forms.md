## Spec: Phase 7c — Marketing remaining pages + Contact form + waitlist signup
**FR references**: FR-MKT-02 (Pricing, Contact, Privacy, Terms), FR-MKT-03, FR-MKT-05
**Status**: ✅ Implemented (superseded — split into specs/07ca-marketing-static.md and specs/07cb-marketing-forms.md, both ✅ Complete 2026-05-18)
**Prerequisites**: 7a ✅, 7b ✅
**Size check**: 6 files · 1 service · 1 layer · 4 pages — exceeds 3-screen limit. Justification: 3 of the 4 (Pricing, Privacy, Terms) are pure-static content components with zero state and one Tailwind layout each; the only logic-bearing page is Contact. Treating Pricing/Privacy/Terms as content fixtures (not "screens" in the Spec Sizing sense), this fits one session ✅

### What
Fill in the four remaining marketing pages and wire the Contact form + Waitlist signup widget to the Phase 7a backend endpoints. Adds the `MarketingApiService` Angular service that owns these two HTTP calls.

### Why
FR-MKT-02 + FR-MKT-03 + FR-MKT-05: completes the marketing surface; the contact form and waitlist signup are the only dynamic features.

### New / Modified Files
- `apps/marketing/src/app/services/marketing-api.service.ts` — `submitContact({ name, email, message })` POSTs to `/web/contact`; `joinWaitlist(email)` POSTs to `/web/signup`; uses `environment.apiUrl`
- `apps/marketing/src/app/pages/pricing.component.ts` — static "Coming soon" placeholder + pricing tier mockup cards
- `apps/marketing/src/app/pages/contact.component.ts` — Reactive Form (name, email, message), client-side validation, on submit calls `marketingApiService.submitContact`, success/error states
- `apps/marketing/src/app/pages/privacy.component.ts` — static privacy text
- `apps/marketing/src/app/pages/terms.component.ts` — static terms text
- `apps/marketing/src/app/components/waitlist-signup.component.ts` — embeddable footer widget (email input + button); on submit calls `marketingApiService.joinWaitlist`; renders on Home + How It Works pages
- `apps/marketing/src/environments/{environment.ts,environment.prod.ts}` — `apiUrl` per env
- `apps/marketing/src/app/app.routes.ts` (modify) — replace placeholder route refs with real component imports
- `apps/marketing/src/app/app.config.ts` (modify) — add `provideHttpClient(withFetch())`

### Behavior
**Contact form**: Angular Reactive Forms with `Validators.required`, `Validators.email`, `Validators.maxLength`. Submit button disabled until valid. On submit: spinner state → `marketingApiService.submitContact` → success message "Thanks — we'll be in touch" OR error message "Something went wrong, please try again". Form resets on success.

**Waitlist signup widget**: single-field email form embedded on Home + How It Works pages (in a footer-style band). Same Reactive Form pattern; on success replaces the form with "You're on the list."

**`MarketingApiService`**: returns `Observable<T>` for both methods; no auth header injection (these are public endpoints). `apiUrl` comes from `environment.apiUrl` exclusively.

**Static pages (Pricing, Privacy, Terms)**: pure content. Each is a standalone `Component` with HTML template, Tailwind classes. No state, no API calls.

### Done When
- [ ] Contact form validates and submits to `/web/contact`
- [ ] Waitlist signup widget validates and submits to `/web/signup`
- [ ] Pricing / Privacy / Terms pages render with Tailwind styling
- [ ] `MarketingApiService` uses `environment.apiUrl` exclusively (no hardcoded URLs)
- [ ] Reactive Forms used (no template-driven forms)
- [ ] All components standalone; new control flow syntax; no NgModule
- [ ] `ng build` and `ng lint` exit 0
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
