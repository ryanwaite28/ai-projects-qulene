## Spec: Phase 10c — Seed script + demo data + screenshots + architecture diagram
**FR references**: Phase 10 PROJECT.md items (demo seed, screenshots, architecture diagram)
**Status**: ⬜ Not Started
**Prerequisites**: 10a ✅, 10b ✅
**Size check**: 4 files · 0 service functions · 1 layer (scripts + docs) · fits one session ✅

### What
Author the portfolio artifacts: a seed script that creates 2 businesses + 4 services + 3 customers + sample appointment requests + sample waitlist entries in the local MiniStack stack; an architecture diagram (Excalidraw export) of the deployed system; screen recordings / screenshots for both mobile and web. Update `README.md` with portfolio-grade content.

### Why
Phase 10 PROJECT.md: portfolio prep — without this, a recruiter cannot easily evaluate the project.

### New / Modified Files
- `infra/scripts/seed-local.ts` — TypeScript script invoked with `npx tsx infra/scripts/seed-local.ts`; uses the same MiniStack endpoints from `.env`; creates: 3 Cognito users (2 businesses, 1 customer), 2 business profiles, 4 services across them (`Hair cut`, `Color`, `Tutoring`, `Personal Training`), 6 availability windows total, 4 appointment requests in various statuses, 2 waitlist entries
- `docs/architecture.png` — Excalidraw-exported diagram showing the full deployed architecture per PROJECT.md Section 4.1
- `README.md` (new) — portfolio README with: project description, live URLs (web app + marketing), feature list, architecture diagram, local setup, deploy instructions, links to source code, screenshots/recordings
- `docs/screenshots/` — folder with PNGs of: mobile auth, mobile browse, mobile appointment request, mobile business dashboard, web landing, web browse, web business dashboard, web customer appointments, marketing home

### Behavior
**Seed script**: idempotent (uses `ConditionExpression: attribute_not_exists` for puts; ignores conflicts). Outputs a summary of created records and emits each user's credentials so the reviewer can log in directly. Default password matches `.env.example`. Run via `npm run seed:local`.

**Architecture diagram**: a single Excalidraw export showing: clients (mobile, web app, marketing) → Cognito + API Gateway → Lambdas → DynamoDB / S3 / SNS / SQS → SES. Includes the dual-CloudFront topology (app + marketing). Saved as PNG; source `.excalidraw` JSON checked in too for future editing.

**README**: target audience is a portfolio reviewer. Lead with screenshots + a short pitch + the live URLs + the architecture diagram. Follow with sections: Features (linking to FRs in PROJECT.md), Architecture (linking to PROJECT.md Section 4), Local development (one-paragraph quickstart), Deploy (high-level CI/CD overview), Tech stack table.

**Screenshots**: capture at 1242×2688 (mobile, iPhone 14 Pro Max) and 1920×1080 (web), light mode only for portfolio MVP.

### Done When
- [ ] `npm run seed:local` creates all sample records idempotently
- [ ] `docs/architecture.png` exists and matches PROJECT.md Section 4.1 topology
- [ ] `README.md` reads as a portfolio piece; live URLs present; screenshots embedded
- [ ] All 9 screenshots committed under `docs/screenshots/`
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
