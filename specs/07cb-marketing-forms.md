## Spec: Phase 7c-b — Marketing Contact form + Waitlist signup widget
**FR references**: FR-MKT-03, FR-MKT-05
**Status**: ✅ Implemented
**Prerequisites**: 7a ✅, 7c-a ✅
**Size check**: 6 files · 0 backend service functions · 1 layer (Angular frontend) · fits one session ✅

### What
Adds the two dynamic features of the marketing SPA: a Contact form (name, email, message → `POST /web/contact`) and a Waitlist signup widget (email → `POST /web/signup`). Both are backed by the Phase 7a `lambda-contact` handler. A new `MarketingApiService` owns both HTTP calls. The widget is embedded inline on the Home and How It Works pages. The `/contact` route is wired to a real `ContactComponent` (replacing the `PlaceholderComponent` stub).

### Why
FR-MKT-03: the marketing site must capture waitlist emails and store them in DynamoDB. FR-MKT-05: contact submissions must POST to `lambda-contact` and show success/error feedback to the user.

### New / Modified Files
- `apps/marketing/src/app/services/marketing-api.service.ts` — Angular injectable service; `submitContact` and `joinWaitlist` methods; uses `HttpClient`; reads `apiUrl` from `environment`
- `apps/marketing/src/app/pages/contact.component.ts` — Reactive Form (name/email/message), client-side validation, submit → `marketingApiService.submitContact`, success/error states
- `apps/marketing/src/app/components/waitlist-signup.component.ts` — standalone embeddable component; single email field Reactive Form; on success replaces form with confirmation
- `apps/marketing/src/app/app.routes.ts` *(modify from 7c-a)* — wire `/contact` to `ContactComponent`
- `apps/marketing/src/app/pages/home.component.ts` *(modify from 7b)* — import and embed `WaitlistSignupComponent`
- `apps/marketing/src/app/pages/how-it-works.component.ts` *(modify from 7b)* — import and embed `WaitlistSignupComponent`

### Behavior

**`MarketingApiService`**:
```typescript
@Injectable({ providedIn: 'root' })
export class MarketingApiService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  submitContact(body: { name: string; email: string; message: string }): Observable<{ data: { ok: boolean } }> {
    return this.http.post<{ data: { ok: boolean } }>(`${this.apiUrl}/web/contact`, body);
  }

  joinWaitlist(email: string): Observable<{ data: { email: string } }> {
    return this.http.post<{ data: { email: string } }>(`${this.apiUrl}/web/signup`, { email });
  }
}
```
No auth header — these are public endpoints. No manual header injection.

**Contact form** (`ContactComponent`):
- Reactive Form fields: `name` (required, maxLength 100), `email` (required, Validators.email), `message` (required, maxLength 2000)
- Submit button: disabled when form invalid OR when `submitting` signal is true
- On submit:
  1. Set `submitting = true`, `error = null`
  2. Call `marketingApiService.submitContact(...)` — subscribe, handle next/error
  3. On success: set `success = true`, `submitting = false`, reset form
  4. On error: set `error = 'Something went wrong, please try again.'`, `submitting = false`
- When `success` is true, hide form and show: "Thanks — we'll be in touch."
- Validation errors shown inline below each field (only when field is touched or form submitted)
- Use signals for `submitting`, `success`, `error`

**Waitlist signup widget** (`WaitlistSignupComponent`):
- Reactive Form: single `email` field (required, Validators.email)
- When `submitted` signal is false: render the form
- When `submitted` is true: hide the form, render "You're on the list! We'll be in touch." in its place
- On error: show error text below the input, keep form visible
- Use signals for `submitting`, `submitted`, `error`

**Embedding the widget**:
- `HomeComponent`: import `WaitlistSignupComponent`; add `<app-waitlist-signup />` in a new full-width band below the existing feature-cards section and above the CTA banner
- `HowItWorksComponent`: import `WaitlistSignupComponent`; add `<app-waitlist-signup />` after the CTA button block at the bottom of the page

**Widget band layout** (for reference — implement in the `WaitlistSignupComponent` template itself, not in the parent):
```
<section class="bg-indigo-50 py-16 px-4 ...">
  <h2>Stay in the loop</h2>
  <p>Be the first to hear about new features and Pro plan availability.</p>
  <form ...> email input + button </form>
</section>
```

### Done When
- [x] `MarketingApiService.submitContact` POSTs to `${environment.apiUrl}/web/contact`; `joinWaitlist` POSTs to `${environment.apiUrl}/web/signup`
- [x] Contact form validates all three fields and shows inline errors on touch
- [x] Contact form shows "Thanks — we'll be in touch." on success and resets
- [x] Contact form shows error message on HTTP failure
- [x] Waitlist widget shows "You're on the list!" on success and hides the form
- [x] Waitlist widget shows error text below input on HTTP failure
- [x] Reactive Forms used throughout — no template-driven forms
- [x] `/contact` route renders `ContactComponent` (not the stub)
- [x] `WaitlistSignupComponent` embedded on both Home and How It Works pages
- [x] `ng build` and `ng lint` exit 0
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
