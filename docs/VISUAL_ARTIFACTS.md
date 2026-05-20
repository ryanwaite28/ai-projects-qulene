# Visual Artifacts — Capture Guide

This file documents the manual steps required to produce the architecture diagram and screenshots referenced in `README.md`. Code generation cannot produce these; follow the steps below after the local stack is running.

---

## Architecture Diagram

**Target file**: `docs/architecture.png` (also save source as `docs/architecture.excalidraw`)

**Tool**: [Excalidraw](https://excalidraw.com) (free, browser-based)

**Topology to draw** (per PROJECT.md Section 4.1):

```
Clients
  ├── Mobile App (Expo Go)            ─┐
  └── Web App (app.qulene.com)        ─┤──→ Cognito (JWT issuance)
  └── Marketing SPA (qulene.com)      ─┘

API Layer
  └── API Gateway v2 (Cognito JWT Authorizer)
        └── Lambda Handlers (thin)
              └── backend/src/services/ (business logic)
                    ├── DynamoDB (6 tables)
                    ├── S3 (media / avatars)
                    └── SNS Topic (qulene-{env}-events)
                          └── SQS Queue → Lambda (notification worker)
                                └── SES (email delivery)

Hosting
  ├── S3 + CloudFront → app.qulene.com  (Angular web app)
  └── S3 + CloudFront → qulene.com      (marketing SPA)
```

**Export steps**:
1. Draw the diagram in Excalidraw
2. File → Export image → PNG, width ≥ 1600 px
3. Save PNG to `docs/architecture.png`
4. File → Save to → save the `.excalidraw` JSON to `docs/architecture.excalidraw`
5. Commit both files

---

## Screenshots

Capture at **1242 × 2688 px** for mobile (iPhone 14 Pro Max simulator, light mode) and **1920 × 1080 px** for web (Chrome, light mode). Save as PNG to `docs/screenshots/`.

### Mobile screenshots (Expo Go / iOS Simulator)

| Filename | Screen | Pre-conditions |
|---|---|---|
| `mobile-auth.png` | Login screen | App cold-launched, not logged in |
| `mobile-browse.png` | Browse businesses page | Logged in as customer; seed businesses visible |
| `mobile-appointment-request.png` | Appointment request form | Customer viewing a service; form partially filled |
| `mobile-customer-appointments.png` | Customer appointments list | Customer has ≥ 2 appointment requests (seed data) |
| `mobile-business-dashboard.png` | Business dashboard | Logged in as `salon@demo.qulene.com`; PENDING request visible |

**Steps**:
1. Start MiniStack: `docker run -p 4566:4566 nahuelnucera/ministack`
2. Seed: `npm run seed:local`
3. Open Expo Go on iOS Simulator: `npx expo start --ios`
4. Register all three seed accounts (email matches seed data, password `Demo1234!`)
5. Capture each screen using Simulator → File → Save Screen

### Web screenshots (Chrome)

| Filename | Screen | Pre-conditions |
|---|---|---|
| `web-landing.png` | Marketing home page (`qulene.com`) | Static SPA running locally (`npm run start -w apps/marketing`) |
| `web-browse.png` | Browse businesses | Logged in as customer; seed businesses visible |
| `web-business-dashboard.png` | Business dashboard | Logged in as `salon@demo.qulene.com`; requests listed |
| `web-customer-appointments.png` | Customer appointments | Logged in as customer; appointment list showing all statuses |

**Steps**:
1. Start web app: `npm run start -w apps/web-app`
2. Open `http://localhost:4200` in Chrome
3. Log in with seed accounts
4. Capture each screen using Chrome DevTools → Device emulation off → Full-page screenshot (or macOS ⇧⌘4)

---

## After capturing

1. Commit all files under `docs/screenshots/` and `docs/architecture.png`
2. Update `README.md` image links if filenames differ from the table above
3. Tick the Done When checkboxes in `specs/10c-portfolio-prep.md`
