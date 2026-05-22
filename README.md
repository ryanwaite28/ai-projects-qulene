# Qulene — Waitlist & Appointment Request Manager

> A full-stack, production-grade two-sided marketplace for service businesses and their customers. Businesses publish services and availability; customers browse, join waitlists, and submit appointment requests. Both sides receive real-time notifications via email.

**Live URLs**
- Web app: [app.qulene.com](https://app.qulene.com)
- Marketing: [qulene.com](https://qulene.com)

---

## Screenshots

> See [`docs/VISUAL_ARTIFACTS.md`](docs/VISUAL_ARTIFACTS.md) for capture instructions.

| Mobile — Customer | Mobile — Business | Web — Dashboard |
|---|---|---|
| *(docs/screenshots/mobile-browse.png)* | *(docs/screenshots/mobile-business-dashboard.png)* | *(docs/screenshots/web-business-dashboard.png)* |

---

## Architecture

![Architecture diagram](docs/architecture.png)

```
Mobile (Expo)  ╮
Web App (Angular) ╠──→ Cognito JWT ──→ API Gateway v2
Marketing SPA  ╯                            │
                                   Lambda Handlers (thin)
                                            │
                                   backend/src/services/
                                    ├── DynamoDB (6 tables)
                                    ├── S3 (avatars / media)
                                    └── SNS → SQS → Lambda
                                                      └── SES (email)
```

Both web clients are served from S3 + CloudFront distributions:
- `app.qulene.com` — Angular SPA
- `qulene.com` — marketing site

---

## Features

| Feature | Roles | Notes |
|---|---|---|
| Registration & login | Business, Customer | Cognito User Pool; `custom:role` attribute |
| Business profile management | Business | Name, category, description, location, avatar |
| Service catalogue | Business | Create / edit / pause / delete services |
| Availability windows | Business | Day-of-week time ranges |
| Browse businesses & services | Customer | Paginated; filter by category |
| Appointment request | Customer | Proposes a time; idempotent submission |
| Request management | Business | Accept / decline / complete / no-show |
| Customer waitlist | Customer | Join / leave per service |
| Business waitlist | Business | View live queue; promotes top entry on slot opening |
| Notifications | Both | In-app + email via SES for every status change |
| Error states | Both | Every list screen shows retry UI on fetch failure |
| Loading skeletons | Both | Every list screen shows skeleton while loading |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo (React Native) + NativeWind |
| Web app | Angular 17+ (standalone, signals, new control flow) |
| Marketing | Angular 17+ SPA |
| API | AWS API Gateway v2 (HTTP) |
| Auth | AWS Cognito User Pool + JWT Authorizer |
| Functions | AWS Lambda (Node.js 20 + TypeScript + esbuild) |
| Database | AWS DynamoDB (DocumentClient v3) |
| Async events | AWS SNS → SQS → Lambda consumer |
| Email | AWS SES + Handlebars templates |
| Storage | AWS S3 (avatars, Lambda packages, SPA hosting) |
| CDN | AWS CloudFront (web app + marketing) |
| IaC | Terraform |
| CI/CD | GitHub Actions (OIDC auth, no IAM keys) |
| Local dev | MiniStack (35+ AWS services on port 4566) |
| Monorepo | npm workspaces |

---

## Local Development

### Prerequisites

- Node.js ≥ 20, npm ≥ 10
- Docker (for MiniStack)
- Expo Go app on a simulator or physical device

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in local values
cp .env.example .env

# 3. Start MiniStack (local AWS emulation — keep this terminal open)
docker run -p 4566:4566 nahuelnucera/ministack
```

In a new terminal:

```bash
# 4. Provision local AWS resources (DynamoDB, Cognito, API Gateway, SQS, SNS, S3, Secrets)
npm run bootstrap:local
```

Bootstrap prints the Cognito Pool ID and Client ID. Copy them into `.env`:

```
COGNITO_USER_POOL_ID=<printed by bootstrap>
COGNITO_CLIENT_ID=<printed by bootstrap>
```

Also copy them into `apps/mobile/.env` (create if needed):

```
EXPO_PUBLIC_COGNITO_USER_POOL_ID=<same pool ID>
EXPO_PUBLIC_COGNITO_CLIENT_ID=<same client ID>
```

```bash
# 5. Build backend and deploy Lambda functions to MiniStack
npm run deploy:local

# 6. Seed demo data
npm run seed:local

# 7a. Start the mobile app
npx expo start --ios            # or --android

# 7b. Start the web app
npm run start -w apps/web-app   # → http://localhost:4200

# 7c. Start the marketing site
npm run start -w apps/marketing # → http://localhost:4201
```

> **Note:** MiniStack resets all state when the container restarts. Re-run steps 4–6 after each restart. Step 4 is idempotent — existing resources are skipped.

### Demo accounts

After running `npm run seed:local`, register these accounts in the app using password `Demo1234!`:

| Role | Email | Business |
|---|---|---|
| Business | salon@demo.qulene.com | Taylor's Salon |
| Business | fitness@demo.qulene.com | Rivera Fitness |
| Customer | customer@demo.qulene.com | — |

The seed script writes DynamoDB records only. Register each account through the app UI to create the matching Cognito user, then log in to see the pre-seeded data.

---

## Deploy

Deployments run via GitHub Actions on push to `main`:

1. **Build** — `npm run build --workspaces`
2. **Bundle Lambdas** — esbuild, one bundle per Lambda entry point
3. **Upload packages** — Lambda ZIPs pushed to `qulene-{env}-lambda-packages` S3 bucket
4. **Terraform apply** — provisions / updates all AWS infrastructure
5. **Deploy SPAs** — Angular builds synced to `qulene-{env}-app` and `qulene-{env}-frontend` S3 buckets; CloudFront cache invalidated

AWS auth uses OIDC (`GitHubActionsDevOpsDeployRole`) — no long-lived IAM keys.

---

## Project Structure

```
qulene/
├── apps/
│   ├── mobile/          # Expo React Native app
│   ├── web-app/         # Angular web app (app.qulene.com)
│   └── marketing/       # Angular marketing SPA (qulene.com)
├── backend/
│   └── src/
│       ├── handlers/    # Thin Lambda handlers (dispatch only)
│       ├── services/    # All business logic
│       ├── db/tables/   # DynamoDB table helpers
│       └── emails/      # Handlebars templates + render functions
├── packages/
│   ├── api-types/       # Shared TypeScript types (mobile + web + backend)
│   └── shared-utils/    # Design tokens + shared utilities
├── infra/
│   ├── terraform/       # All IaC
│   └── scripts/         # Bootstrap + seed + deploy helpers
└── docs/                # Architecture diagram + screenshot guide
```

---

## Key Design Decisions

- **Service layer supremacy**: all business logic lives in `backend/src/services/`. Lambda handlers do shape validation and dispatch only — no DB calls, no domain rules.
- **DynamoDB only**: no relational DB. All access patterns planned upfront; paginated via `LastEvaluatedKey`; counters via atomic `ADD` expressions.
- **SNS fan-out**: appointment and waitlist events publish to a single SNS topic which fans out to SQS; the notification Lambda consumes from SQS for decoupled, retry-safe email delivery.
- **Dual-client parity**: every feature exists in both the mobile app and the Angular web app, sharing the same API contract.
- **No IAM keys in CI**: GitHub Actions authenticates via OIDC; all Terraform provider blocks accept `profile = var.aws_profile` overridden to empty string in CI.

---

## License

UNLICENSED — portfolio project.
