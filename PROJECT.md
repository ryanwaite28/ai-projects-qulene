# Qulene — Waitlist & Appointment Request Manager

### Project Master Document v1.0

> This document is the **single source of truth** for the Qulene platform. All architecture decisions, requirements, API contracts, infrastructure configurations, security policies, implementation plans, and project rules are defined here. AI coding assistants (Claude Code, Cursor, Copilot, etc.) must generate specs, implementation tasks, and code directly from this document. **Do not store project decisions anywhere else.**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [System Architecture](#4-system-architecture)
5. [AWS Infrastructure & Resources](#5-aws-infrastructure--resources)
6. [Software Design](#6-software-design)
7. [Data Model](#7-data-model)
8. [API Documentation](#8-api-documentation)
9. [DevOps & Deployment](#9-devops--deployment)
10. [Local Development](#10-local-development)
11. [Implementation Plan](#11-implementation-plan)
12. [Project Rules & AI-IDE Guidelines](#12-project-rules--ai-ide-guidelines)
13. [Infrastructure Cost Estimates](#13-infrastructure-cost-estimates)
14. [Testing Plan](#14-testing-plan)

---

## 1. Project Overview

### 1.1 What Is Qulene?

> **Portfolio Note**: Qulene is a **portfolio project** demonstrating full-stack mobile + serverless engineering, AWS architecture, and real-world two-sided marketplace patterns. The architecture and feature depth are intentionally production-grade — not tutorial-grade. It is designed to resemble what a freelance or agency developer would build for a small business client.

Qulene is a waitlist and appointment request management platform for small service businesses — think salons, independent contractors, tutors, fitness trainers, and repair shops. It enables businesses to post their services and availability windows, and allows customers to join a waitlist or submit a booking request. Businesses are notified of new requests and can accept or decline them. Customers receive real-time status updates on their requests.

Qulene ships two client interfaces backed by the same API: a **React Native mobile app** (Expo) for on-the-go access and a **web application** (Angular 17+) that provides identical functionality in the browser. Both share the same Cognito authentication, API surface, and feature set — the web app is a full functional mirror of the mobile app, not a marketing-only site.

### 1.2 How It Works

```
BUSINESS (Provider)
  → Registers and creates a business profile
  → Posts services with name, description, duration, and price
  → Sets availability windows (days of week + time ranges)
  → Views incoming waitlist/appointment requests
  → Accepts or declines requests (customer is notified)
  → Can mark accepted appointments as completed or no-show

CUSTOMER
  → Browses or searches businesses/services
  → Submits an appointment request for a service
  → Joins the waitlist if no slots are available
  → Receives push notification + email when request is accepted, declined, or promoted from waitlist
  → Views their upcoming and past appointments
```

### 1.3 Key Entities

| Entity | Description |
| --- | --- |
| **User** | Any registered user — role is either `BUSINESS` or `CUSTOMER` |
| **BusinessProfile** | Extended profile for `BUSINESS` users; contains name, category, description, location |
| **Service** | A bookable offering posted by a business (name, duration, price, status) |
| **AvailabilityWindow** | A recurring weekly time block when a business accepts appointments (day + start/end time) |
| **AppointmentRequest** | A customer's request to book a specific service at a proposed time |
| **WaitlistEntry** | A customer's place in queue for a service with no current availability |
| **Notification** | In-app notification record for a user (request accepted, declined, promoted, etc.) |

### 1.4 User Roles

| Role | Description |
| --- | --- |
| `BUSINESS` | Can create/manage a business profile, post services, manage availability, and action appointment requests |
| `CUSTOMER` | Can browse businesses/services, submit appointment requests, and join waitlists |

A user may only have one role. Role is set at registration and cannot be changed.

### 1.5 Project Identity

| Property | Value |
| --- | --- |
| **Project name** | Qulene |
| **Domain** | `qulene.com` |
| **API (dev)** | `https://api.dev.qulene.com` |
| **API (prod)** | `https://api.qulene.com` |
| **Web app (dev)** | `https://app.dev.qulene.com` |
| **Web app (prod)** | `https://app.qulene.com` |
| **Marketing site (dev)** | `https://dev.qulene.com` |
| **Marketing site (prod)** | `https://qulene.com` |
| **AWS Region** | `us-east-1` |
| **Environments** | `dev`, `prod` (single shared account, name-prefixed) |
| **Resource prefix** | `qulene-{env}-{descriptor}` |
| **Email sender** | `no-reply@qulene.com` |

### 1.6 Mission

To demonstrate a production-grade, two-sided service marketplace: a React Native mobile app and an Angular web application sharing the same backend, serverless AWS infrastructure, per-user role-based access, real-time-style notifications, and a polished Angular marketing SPA — all at near-zero cost on a shared AWS account.

---

## 2. Functional Requirements

### 2.1 Authentication & Registration

- **FR-AUTH-01**: Users register with `email`, `password`, `firstName`, `lastName`, and `role` (`BUSINESS` | `CUSTOMER`)
- **FR-AUTH-02**: Email must be unique across all users
- **FR-AUTH-03**: Passwords are hashed with bcrypt (cost 12); plaintext passwords are never stored or logged
- **FR-AUTH-04**: Login accepts `email` + `password`; returns a signed JWT (HS256) with payload `{ userId, email, role, iat, exp }`
- **FR-AUTH-05**: JWT validity is 24 hours; no refresh tokens (portfolio simplicity)
- **FR-AUTH-06**: All non-public routes require `Authorization: Bearer <token>`
- **FR-AUTH-07**: Role-specific routes enforce the role claim from the JWT — a `CUSTOMER` cannot access `BUSINESS`-only endpoints and vice versa

### 2.2 Business Profile Management

- **FR-BIZ-01**: Upon registration with `role = BUSINESS`, a `BusinessProfile` record is created with default/empty fields
- **FR-BIZ-02**: Business users can update their profile: `businessName`, `category`, `description`, `address`, `city`, `state`, `phone`
- **FR-BIZ-03**: Business profiles are publicly viewable (no auth required) by `businessId`
- **FR-BIZ-04**: A paginated public endpoint lists all active business profiles, filterable by `category`
- **FR-BIZ-05**: A business profile is considered "active" when `businessName` is set and the profile has at least one active service
- **FR-BIZ-06**: Business users can upload a profile photo; stored in S3 at `qulene-{env}-media/business-profiles/{businessId}/avatar.{ext}`; URL stored on the profile record

### 2.3 Service Management

- **FR-SVC-01**: Business users create services: `name`, `description`, `durationMinutes`, `price`, `status` (`ACTIVE` | `PAUSED`)
- **FR-SVC-02**: A business may have up to 20 active services at a time
- **FR-SVC-03**: Business users can update or delete their own services
- **FR-SVC-04**: Customers can view all active services for a given business (public endpoint)
- **FR-SVC-05**: Deleting a service sets `status = DELETED` (soft delete); existing appointment requests against a deleted service are cancelled with reason `SERVICE_REMOVED` and customers are notified

### 2.4 Availability Windows

- **FR-AVL-01**: Business users define recurring weekly availability windows: `dayOfWeek` (0–6, Sunday=0), `startTime` (HH:MM), `endTime` (HH:MM)
- **FR-AVL-02**: A business may define up to 14 availability windows (2 per day max)
- **FR-AVL-03**: Availability windows are publicly readable
- **FR-AVL-04**: Business users can add or delete availability windows
- **FR-AVL-05**: Availability windows are informational — they guide customers when proposing appointment times but do not enforce hard booking slot locks (portfolio simplicity)

### 2.5 Appointment Requests

- **FR-APT-01**: Customers submit appointment requests: `serviceId`, `proposedAt` (ISO datetime), `notes` (optional)
- **FR-APT-02**: `proposedAt` must be in the future at time of submission
- **FR-APT-03**: A customer may not have more than one `PENDING` or `ACCEPTED` request for the same service at the same time
- **FR-APT-04**: On creation, request status is `PENDING`; the business is notified of the new request
- **FR-APT-05**: Business users can `ACCEPT` or `DECLINE` a `PENDING` request
- **FR-APT-06**: On `ACCEPT`: status → `ACCEPTED`; customer receives an in-app notification + email
- **FR-APT-07**: On `DECLINE`: status → `DECLINED`; customer receives an in-app notification + email; the next `WaitlistEntry` for the same service (if any) is promoted automatically (FR-WAIT-04)
- **FR-APT-08**: Business users can mark an `ACCEPTED` request as `COMPLETED` or `NO_SHOW` after the appointment time has passed
- **FR-APT-09**: Customers can cancel a `PENDING` or `ACCEPTED` request; status → `CANCELLED`; business is notified
- **FR-APT-10**: Business users view all requests for their services, filterable by `status`, sorted by `proposedAt` ascending
- **FR-APT-11**: Customers view their own requests across all businesses, sorted by `proposedAt` descending

### 2.6 Waitlist

- **FR-WAIT-01**: When a customer submits a `WaitlistEntry` for a service, they receive a position number based on `createdAt` ordering
- **FR-WAIT-02**: A customer may not join the same waitlist more than once (unique constraint: `customerId + serviceId` where `status = ACTIVE`)
- **FR-WAIT-03**: Customers can leave a waitlist (sets entry `status = REMOVED`)
- **FR-WAIT-04**: When an appointment request for a service is `DECLINED` or `CANCELLED`, the system checks for the oldest `ACTIVE` `WaitlistEntry` for that service and promotes it: the customer receives an in-app notification + email informing them a slot has opened and inviting them to book
- **FR-WAIT-05**: Businesses can view the current waitlist for each of their services (count + list of entries)
- **FR-WAIT-06**: A waitlist promotion does not auto-create an appointment request — it only notifies the customer to take action

### 2.7 Notifications (In-App)

- **FR-NOTIF-01**: Every relevant event creates a `Notification` record for the target user
- **FR-NOTIF-02**: Notification types: `REQUEST_RECEIVED`, `REQUEST_ACCEPTED`, `REQUEST_DECLINED`, `REQUEST_CANCELLED`, `WAITLIST_PROMOTED`, `SERVICE_REMOVED`
- **FR-NOTIF-03**: Notifications are retrieved via `GET /notifications` (paginated, sorted by `createdAt` descending)
- **FR-NOTIF-04**: Notifications can be marked as read: `PATCH /notifications/:notificationId/read`
- **FR-NOTIF-05**: Unread count is returned on the user profile endpoint for badge display in the mobile app
- **FR-NOTIF-06**: Notification delivery failures do not fail the originating operation

### 2.8 Email Notifications

- **FR-EMAIL-01**: All emails sent via AWS SES from `no-reply@qulene.com`
- **FR-EMAIL-02**: Request received email → business; includes customer name, service name, proposed time, notes
- **FR-EMAIL-03**: Request accepted email → customer; includes business name, service name, confirmed time
- **FR-EMAIL-04**: Request declined email → customer; includes business name, service name, note that they may rebook or join the waitlist
- **FR-EMAIL-05**: Request cancelled email → business; includes customer name, service name, proposed time
- **FR-EMAIL-06**: Waitlist promotion email → customer; includes business name, service name, invitation to book
- **FR-EMAIL-07**: Service removed email → customer (for affected `PENDING`/`ACCEPTED` requests); includes business name, service name, apology message

### 2.9 Angular Web Application

- **FR-WEBAPP-01**: A full web application is hosted at `app.qulene.com`, served via CloudFront + S3 (`qulene-{env}-app`)
- **FR-WEBAPP-02**: The web app is built with Angular 17+ (standalone components, new control flow syntax `@if`/`@for`/`@switch`) and Tailwind CSS
- **FR-WEBAPP-03**: The web app provides **identical functionality** to the mobile app — all features, all screens, all user flows available in the browser
- **FR-WEBAPP-04**: Authentication uses Cognito via the AWS Amplify Auth SDK (same User Pool + App Client as the mobile app); JWT stored in `localStorage` under key `qulene_access_token`
- **FR-WEBAPP-05**: An Angular `AuthInterceptor` injects `Authorization: Bearer <token>` on all non-public HTTP requests automatically
- **FR-WEBAPP-06**: An Angular `AuthGuard` protects all authenticated routes; unauthenticated users are redirected to `/login`
- **FR-WEBAPP-07**: A `RoleGuard` protects role-specific route groups — `/business/**` redirects non-`BUSINESS` users; `/customer/**` redirects non-`CUSTOMER` users
- **FR-WEBAPP-08**: On `401`/`403` API response the `AuthInterceptor` clears the stored token and redirects to `/login`
- **FR-WEBAPP-09**: All Angular components are **standalone** — no `NgModule` anywhere
- **FR-WEBAPP-10**: Angular **Signals** are used for component state — not `BehaviorSubject`, not `ngrx`, not raw `Observable` subscriptions where signals suffice
- **FR-WEBAPP-11**: **Reactive Forms** are used for all forms — not template-driven forms
- **FR-WEBAPP-12**: All HTTP calls live in `apps/web-app/src/app/services/` — components never call `HttpClient` directly
- **FR-WEBAPP-13**: The web app routes mirror the mobile app's screen structure:

**Public routes (no auth)**
- `/` — Landing / home (redirect to `/login` if authenticated)
- `/login` — Login form
- `/register` — Registration form (with role selection: Business or Customer)
- `/businesses` — Browse active businesses (public)
- `/businesses/:businessId` — Business detail + services + availability (public)

**Customer routes (`/customer/**`, auth + `CUSTOMER` role required)**
- `/customer/appointments` — My appointment requests
- `/customer/waitlist` — My waitlist entries
- `/customer/notifications` — Notification inbox
- `/customer/profile` — My profile

**Business routes (`/business/**`, auth + `BUSINESS` role required)**
- `/business/dashboard` — Incoming appointment requests (filterable by status)
- `/business/profile` — Edit business profile + avatar upload
- `/business/services` — Manage services (create, edit, pause, delete)
- `/business/availability` — Manage availability windows
- `/business/waitlist` — View waitlist per service
- `/business/notifications` — Notification inbox

### 2.10 Static Marketing Site

- **FR-MKT-01**: A marketing SPA is hosted at `qulene.com`, served via CloudFront + S3 (`qulene-{env}-frontend`)
- **FR-MKT-02**: Pages: Home, About, How It Works, Pricing (placeholder), Contact, Privacy Policy, Terms of Service — all rendered client-side via Angular Router; no full-page reloads between pages
- **FR-MKT-03**: The site links to the web app (`app.qulene.com`) and includes app store placeholder links; includes a waitlist signup form (stores email in DynamoDB table `qulene-{env}-web-signups`)
- **FR-MKT-04**: Built with Angular 17+ (standalone components, Tailwind CSS); no authentication, no Cognito dependency, no protected routes — all pages are public. The distinction from the web app is content scope, not technology. Deployed independently from `apps/web-app/`
- **FR-MKT-05**: Contact form and waitlist signup POST to `lambda-contact` behind API Gateway; stores submission in DynamoDB and sends notification email to the admin address. These are the only API calls the marketing site makes

---

## 3. Non-Functional Requirements

- **NFR-01 — Serverless compute**: All backend logic runs on Lambda; no continuously running servers
- **NFR-02 — Cost efficiency**: Near-zero cost at rest on the shared AWS account; DynamoDB on-demand billing; S3/CloudFront for static assets
- **NFR-03 — Two-role security**: JWT role claim is enforced server-side on every protected route; no client-side-only access control
- **NFR-04 — Idempotency**: Appointment request creation is protected from duplicate submissions via a client-supplied `idempotencyKey`
- **NFR-05 — Environment isolation**: `dev` and `prod` coexist in a shared AWS account. All Qulene resources are prefixed `qulene-{env}-*` and tagged `Project=qulene` to logically separate them from other projects
- **NFR-06 — Observability**: All Lambdas emit structured JSON logs to CloudWatch. No silent failures
- **NFR-07 — Security**: No secrets in code or committed env files. All secrets in Secrets Manager. IAM follows least-privilege per Lambda
- **NFR-08 — Dual-client parity**: The mobile app and web app expose identical functionality. Any feature available in one must be available in the other. The backend API is designed to be client-agnostic — it makes no assumptions about the calling client
- **NFR-09 — Handler Thinness**: Lambda handlers are thin dispatch only. All business logic lives in the service layer (`src/services/`). Handlers parse input, call the service, and return the result. No domain logic in handlers

---

## 4. System Architecture

### 4.1 Architecture Overview

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│     MOBILE APP (Expo)       │  │     WEB APP (Angular 17+)   │
│  React Native + NativeWind  │  │  Tailwind CSS + Signals      │
│  app.qulene.com (Expo Go)   │  │  app.qulene.com (browser)   │
└──────────────┬──────────────┘  └──────────────┬──────────────┘
               │ HTTPS                           │ HTTPS
               └──────────────┬──────────────────┘
                              │
               ┌──────────────▼──────────────┐
               │       Cognito User Pool      │
               │   JWT issuance + validation  │
               └──────────────┬──────────────┘
                              │ Bearer token
               ┌──────────────▼──────────────┐
               │      API Gateway v2          │
               │  (Cognito JWT Authorizer)    │
               └──────────────┬──────────────┘
                              │ invoke
         ┌────────────────────▼───────────────────┐
         │            Lambda Handlers              │
         │  auth | users | businesses | services  │
         │  appointments | waitlist | notifications│
         └────────────────────┬───────────────────┘
                              │ (service layer in same bundle)
         ┌────────────────────▼───────────────────┐
         │            Service Layer                │
         │      backend/src/services/*.service.ts  │
         │       All business logic lives here     │
         └──────┬──────────┬──────────┬────────────┘
                │          │          │
         ┌──────▼──┐ ┌─────▼──┐ ┌────▼──────────┐
         │DynamoDB │ │   S3   │ │Secrets Manager│
         │(tables) │ │(media) │ │               │
         └─────────┘ └────────┘ └───────────────┘
                              │
               ┌──────────────▼──────────────┐
               │        SNS Topic             │
               │    qulene-{env}-events       │
               └──────────────┬──────────────┘
                              │ fan-out
               ┌──────────────▼──────────────┐
               │          SQS Queue           │
               │       notification-queue     │
               └──────────────┬──────────────┘
                              │
               ┌──────────────▼──────────────┐
               │      Notification Lambda     │
               │      (SES email sender)      │
               └─────────────────────────────┘

┌──────────────────────────────────────────────────┐
│              ANGULAR WEB APP (SPA)               │
│   S3 (qulene-{env}-app) + CloudFront            │
│              served at app.qulene.com            │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│           MARKETING SPA (Angular 17+)            │
│   S3 (qulene-{env}-frontend) + CloudFront       │
│              served at qulene.com                │
│   Public pages only — no auth, no Cognito       │
└──────────────────────────────────────────────────┘
```

### 4.2 Service Layer Pattern

Lambda handlers are **thin dispatch only**. The service layer (`src/services/`) is the single home of all business logic. Each handler does exactly three things:

1. Parse and validate the request input
2. Call the appropriate service function
3. Return the result as an HTTP response

This makes the entire business logic independently testable without invoking Lambda runtimes or HTTP.

### 4.3 Async Event Flow

```
Customer submits appointment request
  → AppointmentHandler validates input
      → appointmentService.createRequest()
          → writes AppointmentRequest to DynamoDB (status: PENDING)
          → writes Notification record for business user
          → publishes SNS { REQUEST_RECEIVED, appointmentId }
              → SQS notification-queue
                  → Notification Lambda
                      → sends request-received email to business (FR-EMAIL-02)

Business accepts request
  → AppointmentHandler validates + role-checks
      → appointmentService.acceptRequest()
          → updates AppointmentRequest status → ACCEPTED
          → writes Notification record for customer
          → publishes SNS { REQUEST_ACCEPTED, appointmentId }
              → SQS notification-queue
                  → Notification Lambda
                      → sends accepted email to customer (FR-EMAIL-03)

Business declines request
  → appointmentService.declineRequest()
      → updates status → DECLINED
      → writes Notification for customer
      → publishes SNS { REQUEST_DECLINED, appointmentId }
          → notification Lambda → sends declined email (FR-EMAIL-04)
      → checks for oldest ACTIVE WaitlistEntry for the service
          → if found: writes Notification for waitlisted customer
          → publishes SNS { WAITLIST_PROMOTED, waitlistEntryId }
              → notification Lambda → sends promotion email (FR-EMAIL-06)
```

---

## 5. AWS Infrastructure & Resources

### 5.1 Resource Naming Convention

`qulene-{env}-{descriptor}` — e.g.:
- `qulene-dev-lambda-auth`
- `qulene-prod-sqs-notifications`
- `qulene-dev-dynamodb-users`

### 5.2 Standard Tags

```hcl
tags = {
  Project     = "qulene"
  Environment = var.environment   # "dev" | "prod"
  ManagedBy   = "terraform"
}
```

### 5.2a Terraform AWS Profile Convention

Every Terraform `provider "aws"` block must use a variable for the AWS profile — never a hardcoded string:

```hcl
variable "aws_profile" {
  type    = string
  default = "rmw-llc"   # local default; overridden to "" in CI via TF_VAR_aws_profile
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile   # empty string in CI → falls back to OIDC env credentials
}
```

In all GitHub Actions CI steps that run Terraform, set:
```yaml
env:
  TF_VAR_aws_profile: ""
```

This causes the provider to ignore the profile and use the OIDC-injected environment credentials instead. Without this, CI would attempt to load the `rmw-llc` named profile from `~/.aws/credentials`, which does not exist on the runner, and the step would fail.

### 5.3 AWS Services Used

| Service | Resource | Purpose |
| --- | --- | --- |
| **API Gateway v2** | HTTP API | Public REST API for mobile app |
| **Lambda** | lambda-auth | Register + login |
| **Lambda** | lambda-users | User profile + notifications |
| **Lambda** | lambda-businesses | Business profile management |
| **Lambda** | lambda-services | Service CRUD |
| **Lambda** | lambda-appointments | Appointment request lifecycle |
| **Lambda** | lambda-waitlist | Waitlist management |
| **Lambda** | lambda-notification | SQS consumer — sends emails via SES |
| **Lambda** | lambda-contact | Web contact form handler |
| **SQS** | notification-queue + DLQ | Async email delivery |
| **SNS** | events topic | Fan-out from service layer |
| **DynamoDB** | users | User accounts |
| **DynamoDB** | business-profiles | Business profile data |
| **DynamoDB** | services | Business services |
| **DynamoDB** | availability-windows | Business availability |
| **DynamoDB** | appointment-requests | Appointment request records |
| **DynamoDB** | waitlist-entries | Waitlist entries |
| **DynamoDB** | notifications | In-app notification records |
| **DynamoDB** | web-signups | Marketing site waitlist emails |
| **S3** | qulene-{env}-media | Business profile photos, user avatars |
| **S3** | qulene-{env}-app | Angular web app SPA static assets |
| **S3** | qulene-{env}-frontend | Marketing SPA build artifacts (`ng build` output) |
| **CloudFront** | qulene-{env}-app-cdn | CDN for Angular web app; terminates TLS; serves `app.qulene.com` |
| **CloudFront** | qulene-{env}-cdn | CDN for marketing SPA; serves `qulene.com` and `www.qulene.com` |
| **ACM** | per-env wildcard cert | Prod: primary `qulene.com` + `*.qulene.com` (and `*.api/gateway/service/ui.qulene.com`). Dev: primary `dev.qulene.com` + `*.dev.qulene.com` (mirrored subdomain SANs). Covers apex + `app.*` + `api.*` for each env. |
| **Route 53** | `qulene.com.` | Hosted zone; A-records: apex + www → marketing CloudFront; `app.*` → web app CloudFront; `api.*` → API Gateway |
| **Cognito** | qulene-{env}-user-pool | App user authentication (JWT issuer) |
| **Cognito** | qulene-{env}-user-pool-client | Mobile app client (no client secret) |
| **SES** | no-reply@qulene.com | Transactional email |
| **Secrets Manager** | qulene-{env}-secrets | App secrets (SES config, SNS ARNs, etc.) |
| **CloudWatch Logs** | per-Lambda log groups | Structured logs, 14-day retention |
| **S3** | qulene-{env}-tf-state | Terraform remote state |
| **DynamoDB** | qulene-{env}-tf-locks | Terraform state locking |

### 5.4 Authentication: Cognito

Qulene uses **AWS Cognito** as the identity provider for mobile app users.

- Users are stored in a Cognito User Pool (`qulene-{env}-user-pool`)
- Registration and login are handled via the Cognito SDK in the mobile app (Expo `amazon-cognito-identity-js` or AWS Amplify Auth)
- Cognito issues JWTs (access tokens + ID tokens); the API Gateway is configured with a Cognito JWT authorizer
- The `role` attribute (`BUSINESS` | `CUSTOMER`) is stored as a Cognito custom attribute (`custom:role`) set at registration
- Lambda handlers extract `custom:role` and `sub` (userId) from the verified JWT claims — no separate auth Lambda needed for most routes
- The `lambda-auth` Lambda handles supplemental flows: fetching user profile, updating profile fields stored in DynamoDB (Cognito holds credentials; DynamoDB holds app-level profile data)

### 5.5 Lambda Configuration

| Lambda | Memory | Timeout | Trigger |
| --- | --- | --- | --- |
| lambda-auth | 256 MB | 15s | API Gateway |
| lambda-users | 256 MB | 15s | API Gateway |
| lambda-businesses | 256 MB | 15s | API Gateway |
| lambda-services | 256 MB | 15s | API Gateway |
| lambda-appointments | 256 MB | 30s | API Gateway |
| lambda-waitlist | 256 MB | 15s | API Gateway |
| lambda-notification | 256 MB | 60s | SQS |
| lambda-contact | 128 MB | 10s | API Gateway |

### 5.6 SQS Queue Configuration

| Queue | Visibility Timeout | Max Receive Count | DLQ |
| --- | --- | --- | --- |
| notification-queue | 120s | 3 | notification-dlq |

### 5.7 DynamoDB Table Design

All tables use `PAY_PER_REQUEST` billing. See Section 7 for full schema.

### 5.8 IAM Roles — Least Privilege Summary

Each Lambda has a dedicated execution role. No role is shared across functions.

| Lambda | Key Permissions |
| --- | --- |
| lambda-auth | `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:UpdateItem` on `users` table |
| lambda-users | `dynamodb:GetItem`, `dynamodb:UpdateItem`, `dynamodb:Query` on `users`, `notifications` tables; `s3:PutObject` on media bucket |
| lambda-businesses | `dynamodb:*` on `business-profiles`, `availability-windows` tables; `s3:PutObject` on media bucket |
| lambda-services | `dynamodb:*` on `services` table; `sns:Publish` on events topic |
| lambda-appointments | `dynamodb:*` on `appointment-requests`, `notifications` tables; `sns:Publish` on events topic |
| lambda-waitlist | `dynamodb:*` on `waitlist-entries`, `notifications` tables; `sns:Publish` on events topic |
| lambda-notification | `sqs:ReceiveMessage`, `sqs:DeleteMessage` on notification-queue; `ses:SendEmail`; `dynamodb:GetItem` on multiple tables |
| lambda-contact | `dynamodb:PutItem` on `web-signups`; `ses:SendEmail` |

---

## 6. Software Design

### 6.1 Monorepo Structure

```
qulene/
├── apps/
│   ├── mobile/                        # Expo React Native app
│   │   ├── app/                       # Expo Router file-based routes
│   │   │   ├── (auth)/
│   │   │   │   ├── login.tsx
│   │   │   │   └── register.tsx
│   │   │   ├── (customer)/
│   │   │   │   ├── index.tsx          # Browse businesses
│   │   │   │   ├── business/[id].tsx  # Business detail + services
│   │   │   │   ├── appointments.tsx   # My appointments
│   │   │   │   ├── waitlist.tsx       # My waitlist entries
│   │   │   │   └── notifications.tsx  # Notification inbox
│   │   │   ├── (business)/
│   │   │   │   ├── dashboard.tsx      # Incoming requests
│   │   │   │   ├── profile.tsx        # Edit business profile
│   │   │   │   ├── services.tsx       # Manage services
│   │   │   │   ├── availability.tsx   # Manage availability windows
│   │   │   │   └── waitlist.tsx       # View waitlist per service
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   │   ├── ui/                    # Reusable NativeWind-styled components
│   │   │   ├── AppointmentCard.tsx
│   │   │   ├── ServiceCard.tsx
│   │   │   └── NotificationBadge.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts             # Cognito auth state
│   │   │   └── useApi.ts              # Typed API client wrapper
│   │   ├── lib/
│   │   │   ├── api.ts                 # Base API client (fetch + auth header injection)
│   │   │   └── cognito.ts             # Cognito SDK config
│   │   ├── app.json
│   │   ├── babel.config.js
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   ├── web-app/                       # Angular 17+ SPA (full web version of the mobile app)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.routes.ts          # Full route table (mirrors mobile screen structure)
│   │   │   │   ├── app.config.ts          # provideRouter, provideHttpClient, withInterceptors
│   │   │   │   ├── guards/
│   │   │   │   │   ├── auth.guard.ts      # Redirects unauthenticated users to /login
│   │   │   │   │   └── role.guard.ts      # Redirects wrong-role users to /login
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── auth.interceptor.ts  # Injects Bearer token; handles 401/403 redirect
│   │   │   │   ├── services/              # All HTTP calls — components never call HttpClient directly
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── user.service.ts
│   │   │   │   │   ├── business.service.ts
│   │   │   │   │   ├── appointment.service.ts
│   │   │   │   │   ├── waitlist.service.ts
│   │   │   │   │   └── notification.service.ts
│   │   │   │   ├── pages/
│   │   │   │   │   ├── login/
│   │   │   │   │   ├── register/
│   │   │   │   │   ├── businesses/        # /businesses — browse + search (public)
│   │   │   │   │   ├── business-detail/   # /businesses/:businessId (public)
│   │   │   │   │   ├── customer/
│   │   │   │   │   │   ├── appointments/  # /customer/appointments
│   │   │   │   │   │   ├── waitlist/      # /customer/waitlist
│   │   │   │   │   │   ├── notifications/ # /customer/notifications
│   │   │   │   │   │   └── profile/       # /customer/profile
│   │   │   │   │   └── business/
│   │   │   │   │       ├── dashboard/     # /business/dashboard
│   │   │   │   │       ├── profile/       # /business/profile
│   │   │   │   │       ├── services/      # /business/services
│   │   │   │   │       ├── availability/  # /business/availability
│   │   │   │   │       ├── waitlist/      # /business/waitlist
│   │   │   │   │       └── notifications/ # /business/notifications
│   │   │   │   └── components/            # Shared standalone UI components
│   │   │   │       ├── notification-badge/
│   │   │   │       ├── appointment-card/
│   │   │   │       ├── service-card/
│   │   │   │       └── business-card/
│   │   │   ├── environments/
│   │   │   │   ├── environment.ts         # apiUrl: 'http://localhost:3000'
│   │   │   │   └── environment.prod.ts    # apiUrl: 'https://api.qulene.com'
│   │   │   ├── index.html
│   │   │   ├── main.ts
│   │   │   └── styles.css                 # Tailwind directives
│   │   ├── angular.json
│   │   ├── tailwind.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── marketing/                     # Angular 17+ marketing SPA (public pages only — no auth)
│       ├── src/
│       │   ├── app/
│       │   │   ├── app.routes.ts          # Client-side routes for all marketing pages
│       │   │   ├── app.config.ts          # provideRouter, provideHttpClient (for contact/signup forms)
│       │   │   └── pages/
│       │   │       ├── home/              # /
│       │   │       ├── about/             # /about
│       │   │       ├── how-it-works/      # /how-it-works
│       │   │       ├── pricing/           # /pricing (placeholder)
│       │   │       ├── contact/           # /contact (posts to lambda-contact)
│       │   │       ├── privacy/           # /privacy
│       │   │       └── terms/             # /terms
│       │   ├── index.html
│       │   ├── main.ts
│       │   └── styles.css                 # Tailwind directives
│       ├── angular.json
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── api-types/                     # Shared TypeScript types — used by backend, mobile, AND web-app
│   │   ├── src/
│   │   │   ├── auth.types.ts
│   │   │   ├── business.types.ts
│   │   │   ├── appointment.types.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── shared-utils/                  # Shared utility functions
│       ├── src/
│       │   ├── date.utils.ts
│       │   └── validation.utils.ts
│       └── package.json
│
├── backend/
│   ├── src/
│   │   ├── services/                  # All business logic — framework-agnostic
│   │   │   ├── auth.service.ts
│   │   │   ├── user.service.ts
│   │   │   ├── business.service.ts
│   │   │   ├── service.service.ts     # Service (offering) management
│   │   │   ├── appointment.service.ts
│   │   │   ├── waitlist.service.ts
│   │   │   └── notification.service.ts
│   │   ├── handlers/                  # Lambda handlers (thin dispatch only)
│   │   │   ├── auth.handler.ts
│   │   │   ├── user.handler.ts
│   │   │   ├── business.handler.ts
│   │   │   ├── service.handler.ts
│   │   │   ├── appointment.handler.ts
│   │   │   ├── waitlist.handler.ts
│   │   │   ├── notification.handler.ts  # SQS consumer
│   │   │   └── contact.handler.ts
│   │   ├── db/
│   │   │   ├── dynamo.client.ts       # DynamoDB DocumentClient singleton
│   │   │   └── tables/                # Table-scoped query helpers
│   │   │       ├── users.table.ts
│   │   │       ├── business-profiles.table.ts
│   │   │       ├── services.table.ts
│   │   │       ├── availability-windows.table.ts
│   │   │       ├── appointment-requests.table.ts
│   │   │       ├── waitlist-entries.table.ts
│   │   │       └── notifications.table.ts
│   │   ├── clients/
│   │   │   ├── ses.client.ts
│   │   │   ├── sns.client.ts
│   │   │   ├── s3.client.ts
│   │   │   └── cognito.client.ts
│   │   ├── emails/
│   │   │   ├── templates/             # Handlebars HTML templates
│   │   │   │   ├── request-received.hbs
│   │   │   │   ├── request-accepted.hbs
│   │   │   │   ├── request-declined.hbs
│   │   │   │   ├── request-cancelled.hbs
│   │   │   │   ├── waitlist-promoted.hbs
│   │   │   │   └── service-removed.hbs
│   │   │   └── email.renderer.ts      # Handlebars compile + render helper
│   │   ├── middleware/
│   │   │   └── auth.middleware.ts     # JWT extraction + role enforcement
│   │   └── types/
│   │       └── index.ts               # Internal backend types
│   ├── package.json
│   └── tsconfig.json
│
├── infra/
│   ├── terraform/
│   │   ├── modules/
│   │   │   ├── lambda/
│   │   │   ├── dynamodb/
│   │   │   ├── sqs/
│   │   │   ├── cognito/
│   │   │   ├── api-gateway/
│   │   │   ├── spa/                   # Reusable S3 + CloudFront + Route 53 module (used for web-app AND marketing)
│   │   │   └── marketing/             # Thin wrapper around spa/ module for qulene-{env}-frontend
│   │   ├── envs/
│   │   │   ├── dev/
│   │   │   │   ├── main.tf
│   │   │   │   ├── variables.tf
│   │   │   │   └── terraform.tfvars
│   │   │   └── prod/
│   │   │       ├── main.tf
│   │   │       ├── variables.tf
│   │   │       └── terraform.tfvars
│   │   └── bootstrap/                 # Remote state S3 + DynamoDB lock table
│   │       ├── main.tf
│   │       └── variables.tf
│   ├── ministack/
│   │   └── 01-seed.sh                 # MiniStack ready.d init script
│   └── scripts/
│       ├── deploy-web-app.sh          # ng build → sync to qulene-{env}-app S3 + CloudFront invalidation
│       ├── deploy-marketing.sh        # ng build apps/marketing → sync dist/ to qulene-{env}-frontend S3 + CloudFront invalidation
│       └── seed-local.ts              # Local dev seed data
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-dev.yml
│       └── deploy-prod.yml
│
├── package.json                       # Root workspace (npm workspaces)
├── PROJECT.md
├── CLAUDE.md
└── tsconfig.base.json
```

### 6.2 Tech Stack

| Layer | Technology |
| --- | --- |
| **Mobile framework** | Expo (SDK 51+) with Expo Router (file-based routing) |
| **Mobile UI** | React Native + NativeWind (Tailwind for React Native) |
| **Mobile auth** | AWS Amplify Auth / `amazon-cognito-identity-js` |
| **Web framework** | Angular 17+ (standalone components, new control flow syntax) |
| **Web UI** | Tailwind CSS |
| **Web auth** | AWS Amplify Auth (same Cognito User Pool as mobile) |
| **Web state** | Angular Signals |
| **Web forms** | Angular Reactive Forms |
| **Web build** | `ng build` → `dist/web-app/` |
| **Web hosting** | S3 (`qulene-{env}-app`) + CloudFront → `app.qulene.com` |
| **Web local dev** | `ng serve` at `:4200`; proxy to backend at `:3000` |
| **Backend language** | TypeScript (Node.js 20) |
| **Backend auth** | AWS Cognito (JWT issuer); API Gateway Cognito authorizer |
| **Database** | DynamoDB (DocumentClient v3) |
| **Email rendering** | Handlebars (HTML `.hbs` templates) |
| **Email delivery** | AWS SES SDK v3 |
| **File storage** | AWS S3 SDK v3 |
| **Messaging** | AWS SNS + SQS SDK v3 |
| **Build (backend)** | esbuild (one bundle per Lambda) |
| **IaC** | Terraform |
| **CI/CD** | GitHub Actions |
| **Marketing SPA** | Angular 17+ (standalone components, Tailwind CSS, Angular Router) → S3 (`qulene-{env}-frontend`) + CloudFront → `qulene.com`; public pages only, no auth |
| **Local AWS emulation** | MiniStack (`nahuelnucera/ministack`) — 35+ services on port 4566; MIT licensed; drop-in compatible with AWS SDKs and Terraform |
| **Testing** | Vitest (unit + integration) |
| **Monorepo tooling** | npm workspaces |

---

## 7. Data Model

All DynamoDB tables use `PAY_PER_REQUEST` billing mode. Primary keys and GSIs are defined below.

### 7.1 `qulene-{env}-users`

| Attribute | Type | Notes |
| --- | --- | --- |
| `userId` (PK) | String | Cognito `sub` claim |
| `email` | String | |
| `firstName` | String | |
| `lastName` | String | |
| `role` | String | `BUSINESS` \| `CUSTOMER` |
| `unreadNotificationCount` | Number | Incremented on new notification; decremented on read |
| `createdAt` | String | ISO datetime |
| `updatedAt` | String | ISO datetime |

**GSI**: `email-index` — PK: `email` (for uniqueness checks)

### 7.2 `qulene-{env}-business-profiles`

| Attribute | Type | Notes |
| --- | --- | --- |
| `businessId` (PK) | String | Same as `userId` of the business owner |
| `businessName` | String | |
| `category` | String | e.g. `SALON`, `TUTOR`, `CONTRACTOR`, `FITNESS`, `OTHER` |
| `description` | String | |
| `address` | String | |
| `city` | String | |
| `state` | String | |
| `phone` | String | |
| `avatarUrl` | String | S3 URL |
| `isActive` | Boolean | True when name is set + has ≥1 active service |
| `createdAt` | String | |
| `updatedAt` | String | |

**GSI**: `category-index` — PK: `category`, SK: `businessId` (for filtered listing)

### 7.3 `qulene-{env}-services`

| Attribute | Type | Notes |
| --- | --- | --- |
| `serviceId` (PK) | String | UUID |
| `businessId` (SK) | String | |
| `name` | String | |
| `description` | String | |
| `durationMinutes` | Number | |
| `price` | Number | Stored in cents (integer) |
| `status` | String | `ACTIVE` \| `PAUSED` \| `DELETED` |
| `createdAt` | String | |
| `updatedAt` | String | |

**GSI**: `businessId-index` — PK: `businessId`, SK: `createdAt` (list services by business)

### 7.4 `qulene-{env}-availability-windows`

| Attribute | Type | Notes |
| --- | --- | --- |
| `windowId` (PK) | String | UUID |
| `businessId` (SK) | String | |
| `dayOfWeek` | Number | 0 (Sun) – 6 (Sat) |
| `startTime` | String | `HH:MM` |
| `endTime` | String | `HH:MM` |
| `createdAt` | String | |

**GSI**: `businessId-index` — PK: `businessId` (list windows for a business)

### 7.5 `qulene-{env}-appointment-requests`

| Attribute | Type | Notes |
| --- | --- | --- |
| `requestId` (PK) | String | UUID |
| `customerId` | String | Cognito `sub` |
| `businessId` | String | |
| `serviceId` | String | |
| `proposedAt` | String | ISO datetime |
| `notes` | String | Optional |
| `status` | String | `PENDING` \| `ACCEPTED` \| `DECLINED` \| `CANCELLED` \| `COMPLETED` \| `NO_SHOW` |
| `idempotencyKey` | String | Client-supplied; used to prevent duplicate submissions |
| `createdAt` | String | |
| `updatedAt` | String | |

**GSI**: `businessId-status-index` — PK: `businessId`, SK: `status` (business view by status)
**GSI**: `customerId-index` — PK: `customerId`, SK: `createdAt` (customer view of own requests)
**GSI**: `serviceId-index` — PK: `serviceId` (for waitlist promotion lookup)
**GSI**: `idempotencyKey-index` — PK: `idempotencyKey` (duplicate submission check)

### 7.6 `qulene-{env}-waitlist-entries`

| Attribute | Type | Notes |
| --- | --- | --- |
| `entryId` (PK) | String | UUID |
| `customerId` | String | |
| `serviceId` | String | |
| `businessId` | String | |
| `status` | String | `ACTIVE` \| `PROMOTED` \| `REMOVED` |
| `createdAt` | String | ISO datetime (used for ordering) |
| `updatedAt` | String | |

**GSI**: `serviceId-status-index` — PK: `serviceId`, SK: `createdAt` (oldest entry first for promotion)
**GSI**: `customerId-index` — PK: `customerId` (customer's own waitlist entries)
**Unique constraint (application-enforced)**: one `ACTIVE` entry per `customerId + serviceId`

### 7.7 `qulene-{env}-notifications`

| Attribute | Type | Notes |
| --- | --- | --- |
| `notificationId` (PK) | String | UUID |
| `userId` | String | Recipient |
| `type` | String | `REQUEST_RECEIVED` \| `REQUEST_ACCEPTED` \| `REQUEST_DECLINED` \| `REQUEST_CANCELLED` \| `WAITLIST_PROMOTED` \| `SERVICE_REMOVED` |
| `relatedId` | String | `requestId`, `entryId`, or `serviceId` depending on type |
| `message` | String | Human-readable notification text |
| `isRead` | Boolean | Default: `false` |
| `createdAt` | String | |

**GSI**: `userId-createdAt-index` — PK: `userId`, SK: `createdAt` (paginated notification inbox)

### 7.8 `qulene-{env}-web-signups`

| Attribute | Type | Notes |
| --- | --- | --- |
| `email` (PK) | String | |
| `createdAt` | String | |

---

## 8. API Documentation

### 8.1 Base URLs

| Environment | API URL | Web URL |
| --- | --- | --- |
| Local | `http://localhost:3000` | `http://localhost:8080` |
| Dev | `https://api.dev.qulene.com` | `https://dev.qulene.com` |
| Prod | `https://api.qulene.com` | `https://qulene.com` |

### 8.2 Authentication

All protected routes require `Authorization: Bearer <cognito-access-token>`.

API Gateway uses a Cognito JWT authorizer. Lambda handlers extract `sub` (userId) and `custom:role` from the JWT context injected by API Gateway.

### 8.3 Response Envelope

```json
// Success
{ "data": { ... } }

// List
{ "data": [...], "nextCursor": "..." }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
```

### 8.4 Endpoints

#### Auth / Users

| Method | Path | Auth | Role | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/profile` | ✅ | Any | Create/sync user profile in DynamoDB after Cognito registration |
| `GET` | `/users/me` | ✅ | Any | Get current user profile (includes `unreadNotificationCount`) |
| `PATCH` | `/users/me` | ✅ | Any | Update `firstName`, `lastName` |
| `GET` | `/notifications` | ✅ | Any | List notifications (paginated) |
| `PATCH` | `/notifications/:notificationId/read` | ✅ | Any | Mark notification as read |

#### Businesses

| Method | Path | Auth | Role | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/businesses` | ❌ | — | List active businesses (paginated, filterable by `category`) |
| `GET` | `/businesses/:businessId` | ❌ | — | Get business profile |
| `PATCH` | `/businesses/me` | ✅ | BUSINESS | Update own business profile |
| `POST` | `/businesses/me/avatar` | ✅ | BUSINESS | Upload profile photo (multipart) |

#### Services

| Method | Path | Auth | Role | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/businesses/:businessId/services` | ❌ | — | List active services for a business |
| `POST` | `/businesses/me/services` | ✅ | BUSINESS | Create a service |
| `PATCH` | `/businesses/me/services/:serviceId` | ✅ | BUSINESS | Update a service |
| `DELETE` | `/businesses/me/services/:serviceId` | ✅ | BUSINESS | Soft-delete a service |

#### Availability

| Method | Path | Auth | Role | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/businesses/:businessId/availability` | ❌ | — | Get availability windows |
| `POST` | `/businesses/me/availability` | ✅ | BUSINESS | Add availability window |
| `DELETE` | `/businesses/me/availability/:windowId` | ✅ | BUSINESS | Remove availability window |

#### Appointments

| Method | Path | Auth | Role | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/appointments` | ✅ | CUSTOMER | Submit appointment request |
| `GET` | `/appointments/me` | ✅ | CUSTOMER | List own requests |
| `DELETE` | `/appointments/:requestId` | ✅ | CUSTOMER | Cancel own request |
| `GET` | `/businesses/me/appointments` | ✅ | BUSINESS | List incoming requests (filterable by `status`) |
| `PATCH` | `/businesses/me/appointments/:requestId/accept` | ✅ | BUSINESS | Accept a request |
| `PATCH` | `/businesses/me/appointments/:requestId/decline` | ✅ | BUSINESS | Decline a request |
| `PATCH` | `/businesses/me/appointments/:requestId/complete` | ✅ | BUSINESS | Mark as completed |
| `PATCH` | `/businesses/me/appointments/:requestId/noshow` | ✅ | BUSINESS | Mark as no-show |

#### Waitlist

| Method | Path | Auth | Role | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/waitlist` | ✅ | CUSTOMER | Join waitlist for a service |
| `GET` | `/waitlist/me` | ✅ | CUSTOMER | List own waitlist entries |
| `DELETE` | `/waitlist/:entryId` | ✅ | CUSTOMER | Leave waitlist |
| `GET` | `/businesses/me/waitlist/:serviceId` | ✅ | BUSINESS | View waitlist for a service |

#### Web / Contact

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/web/contact` | ❌ | Submit contact form |
| `POST` | `/web/signup` | ❌ | Join marketing waitlist |

### 8.5 Error Codes

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Input failed validation |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but wrong role or ownership |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Duplicate resource (e.g., already on waitlist) |
| `UNPROCESSABLE` | 422 | Business rule violation (e.g., past `proposedAt`) |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## 9. DevOps & Deployment

### 9.1 Environments

| Environment | Purpose |
| --- | --- |
| `dev` | AWS testing environment — deployed on every push to `main` |
| `prod` | AWS portfolio / live environment — requires manual approval gate |

There is no `staging` or `local` AWS environment. Both `dev` and `prod` deploy to a shared AWS account. All Qulene resources are isolated by the `qulene-{env}-` name prefix and `Project=qulene` tag. Local development uses MiniStack (`nahuelnucera/ministack`) to emulate all AWS services (SQS, SNS, SES, S3, DynamoDB, and more) on a single port (4566) — it does not connect to any AWS environment.

### 9.2 CI/CD (GitHub Actions)

```
push to main
  → lint + typecheck (backend + mobile type-check + ng lint web-app)
  → unit tests (vitest)
  → esbuild Lambda bundles → verify all bundles present in dist/lambdas/
  → ng build web-app → verify dist/web-app/ produced
  → terraform validate + plan (dev)
  → terraform apply (dev)                    [auto; TF_VAR_aws_profile="" + OIDC role]
  → deploy web-app to S3 (qulene-dev-app)   [auto; ng build → aws s3 sync + CloudFront invalidation]
  → deploy marketing SPA to S3 (qulene-dev-frontend) [auto; ng build → sync + CloudFront invalidation]
  → integration smoke tests (dev)
  → manual approval gate (prod-approval GitHub environment)
  → terraform apply (prod)
  → deploy web-app to S3 (qulene-prod-app)
  → deploy marketing SPA to S3 (qulene-prod-frontend)
```

**AWS auth in CI**: All GitHub Actions workflows that access AWS use OIDC — `id-token: write` permission + `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`. `AWS_ROLE_ARN` is the ARN of `GitHubActionsDevOpsDeployRole`, a shared org-level role that already exists in the AWS account — it is not provisioned per-project. No IAM user keys; no long-lived credentials anywhere.

**Terraform profile override in CI**: All Terraform steps set `TF_VAR_aws_profile=""` to override the local `"rmw-llc"` default and fall back to the OIDC environment credential chain. Without this, Terraform would attempt to load a named profile that does not exist on the CI runner and fail.

**Bundle audit**: The CI build step must verify that a bundle artifact exists in `dist/lambdas/{name}/index.js` for every Lambda defined in `esbuild.config.ts`. A missing bundle is a silent deployment failure — the Lambda would deploy with stale code or fail to deploy at all.

### 9.3 Pre-Provisioned Infrastructure

The following resources were provisioned before the project started and are shared across environments. Terraform **reads** these via SSM — it does not create or manage them. `bootstrap.sh` verifies they exist and writes their values to SSM Parameter Store.

| Resource | Status | SSM Key |
| --- | --- | --- |
| Route 53 hosted zone (`qulene.com`) | ✅ Active | `/qulene/hosted_zone_id` |
| ACM cert `dev.qulene.com` + `*.dev.qulene.com` (dev) | ✅ Issued | `/qulene/dev/acm_certificate_arn` |
| ACM cert `qulene.com` + `*.qulene.com` (prod) | ✅ Issued | `/qulene/prod/acm_certificate_arn` |
| SES domain identity (`qulene.com`) | ✅ Verified | — |
| SES sender `no-reply@qulene.com` | ✅ Authorised via verified domain identity | — |
| IAM role `GitHubActionsDevOpsDeployRole` | ✅ Exists (shared org role) | — |

### 9.4 Bootstrap Script

`infra/scripts/bootstrap.sh` is idempotent and safe to re-run. It has two modes:

```bash
# Production AWS (default) — uses rmw-llc profile
./infra/scripts/bootstrap.sh

# Local MiniStack — provisions queues, topics, secrets at localhost:4566
./infra/scripts/bootstrap.sh --local
```

**Production mode provisions:**
- Terraform remote state: `qulene-{env}-tf-state` S3 + `qulene-{env}-tf-locks` DynamoDB (both envs)
- Lambda packages: `qulene-{env}-lambda-packages` S3 (CI uploads ZIPs before `terraform apply`)
- SSM parameters: `/qulene/{env}/acm_certificate_arn`, `/qulene/hosted_zone_id` (read from pre-provisioned infra)
- Secrets Manager: `qulene-{env}-secrets` with placeholder JSON structure
- GitHub: repo secrets (`AWS_ROLE_ARN`, `AWS_REGION`) and environments (`dev`, `prod`, `prod-approval`) via `gh` CLI if available; otherwise prints manual instructions

**Local mode provisions** (against MiniStack at `:4566`):
- SQS queues + DLQs for all consumers
- SNS topic + subscriptions to all queues
- S3 bucket for media
- Secrets Manager stubs
- SES identity

### 9.5 SSM ↔ Terraform Pattern

All Terraform modules read shared infra values from SSM — never hardcoded ARNs or IDs in `.tf` files:

```hcl
data "aws_ssm_parameter" "acm_cert" {
  name = "/qulene/${var.environment}/acm_certificate_arn"
}

data "aws_ssm_parameter" "hosted_zone_id" {
  name = "/qulene/hosted_zone_id"
}
```

After `terraform apply` provisions Cognito, a post-apply script writes the User Pool ID and App Client ID back to SSM so the mobile/web apps and subsequent Terraform modules can read them without hardcoding.

### 9.6 Build & Deploy Scripts

```bash
npm run build                    # esbuild all Lambda bundles → dist/lambdas/{name}/
npm run test                     # vitest unit tests
npm run build:web-app            # ng build apps/web-app → dist/web-app/
npm run build:marketing          # ng build apps/marketing → dist/marketing/
npm run deploy:dev               # terraform apply envs/dev
npm run deploy:prod              # terraform apply envs/prod (requires manual approval)
npm run deploy:web-app:dev       # ng build → sync to qulene-dev-app S3 + CloudFront invalidation
npm run deploy:web-app:prod      # ng build → sync to qulene-prod-app S3 + CloudFront invalidation
npm run deploy:marketing:dev     # ng build apps/marketing → sync dist/ to qulene-dev-frontend S3 + invalidation
npm run deploy:marketing:prod    # ng build apps/marketing → sync dist/ to qulene-prod-frontend S3 + invalidation
```

---

## 10. Local Development

### 10.1 Prerequisites

- Node.js 20+
- Docker + Docker Compose
- AWS CLI (any credentials for local use — MiniStack ignores real credentials)
- Expo CLI (`npm install -g expo-cli`)
- An iOS Simulator or Android Emulator, or Expo Go on a physical device

### 10.2 Environment Variables (`.env.example`)

```bash
# Backend (never committed — local development only)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
DYNAMODB_ENDPOINT=http://localhost:4566        # MiniStack
SNS_ENDPOINT=http://localhost:4566             # MiniStack
SQS_ENDPOINT=http://localhost:4566             # MiniStack
SES_ENDPOINT=http://localhost:4566             # MiniStack (emails stored in-memory, not sent)
S3_ENDPOINT=http://localhost:4566              # MiniStack
SES_FROM_EMAIL=no-reply@qulene.com
NOTIFICATION_QUEUE_URL=http://localhost:4566/000000000000/qulene-local-notifications
SNS_TOPIC_ARN=arn:aws:sns:us-east-1:000000000000:qulene-local-events
COGNITO_USER_POOL_ID=us-east-1_localpool       # mock value for local dev
COGNITO_CLIENT_ID=localclientid                # mock value for local dev
MEDIA_BUCKET=qulene-local-media

# Mobile (apps/mobile/.env — never committed)
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_localpool
EXPO_PUBLIC_COGNITO_CLIENT_ID=localclientid
```

In `dev` and `prod` environments, all secrets and configuration are stored in `qulene-{env}-secrets` in Secrets Manager and injected as Lambda environment variables by Terraform. No `.env` files exist in deployed environments.

### 10.3 docker-compose.yml (summary)

```yaml
services:
  ministack:
    image: nahuelnucera/ministack:latest
    ports:
      - "4566:4566"
    environment:
      MINISTACK_ACCOUNT_ID: "000000000000"
      MINISTACK_REGION: us-east-1
    volumes:
      - ./infra/ministack:/docker-entrypoint-initaws.d/ready.d
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4566/_ministack/health"]
      interval: 5s
      timeout: 3s
      retries: 10
```

MiniStack runs all emulated AWS services (DynamoDB, SQS, SNS, SES, S3, and 30+ more) on a single port — no separate DynamoDB Local container needed.

### 10.4 MiniStack Init Script (`infra/ministack/01-seed.sh`)

MiniStack executes scripts in `/docker-entrypoint-initaws.d/ready.d/` after the server is ready and accepting connections. Use this to pre-create queues, topics, and S3 buckets:

```bash
#!/bin/sh
set -e

ENDPOINT=http://localhost:4566
ACCOUNT=000000000000

# Create SNS topic
aws --endpoint-url=$ENDPOINT sns create-topic \
  --name qulene-local-events

# Create notification SQS queue + DLQ
aws --endpoint-url=$ENDPOINT sqs create-queue \
  --queue-name qulene-local-notifications-dlq

aws --endpoint-url=$ENDPOINT sqs create-queue \
  --queue-name qulene-local-notifications \
  --attributes RedrivePolicy="{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:${ACCOUNT}:qulene-local-notifications-dlq\",\"maxReceiveCount\":\"3\"}"

# Subscribe notification queue to SNS topic
TOPIC_ARN="arn:aws:sns:us-east-1:${ACCOUNT}:qulene-local-events"
QUEUE_ARN="arn:aws:sqs:us-east-1:${ACCOUNT}:qulene-local-notifications"
aws --endpoint-url=$ENDPOINT sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol sqs \
  --notification-endpoint $QUEUE_ARN

# Create media S3 bucket
aws --endpoint-url=$ENDPOINT s3 mb s3://qulene-local-media

echo "MiniStack resources initialized."
```

### 10.5 Starting the Local Stack

```bash
# Start MiniStack (35+ AWS services on :4566, init script runs automatically)
docker-compose up -d

# Verify MiniStack is ready
curl http://localhost:4566/_ministack/health

# Install dependencies
npm install

# Start the backend API (ts-node-dev hot reload)
npm run dev:api             # http://localhost:3000

# Start the Angular web app (proxies API calls to :3000)
cd apps/web-app
ng serve                    # http://localhost:4200

# Start the mobile app
cd apps/mobile
npx expo start

# Start the marketing SPA (local preview)
cd apps/marketing
ng serve --port 8080         # http://localhost:8080
```

### 10.6 Inspecting Local State

```bash
# List SQS queues
aws --endpoint-url=http://localhost:4566 sqs list-queues

# List DynamoDB tables
aws --endpoint-url=http://localhost:4566 dynamodb list-tables

# View SES emails captured in-memory (not actually sent)
curl http://localhost:4566/_ministack/health

# Reset all MiniStack state between test runs
curl -X POST http://localhost:4566/_ministack/reset
```

---

## 11. Implementation Plan

Working backwards from a fully deployed, end-to-end operational system.

### Phase 0 — Monorepo Scaffold & Infra Bootstrap

- [ ] Init npm workspaces: `apps/mobile`, `apps/web-app`, `apps/marketing`, `packages/api-types`, `packages/shared-utils`, `backend/`
- [ ] TypeScript config: `tsconfig.base.json` + per-package `tsconfig.json`
- [ ] ESLint + Prettier config at root (`argsIgnorePattern: "^_"` in ESLint from day one)
- [ ] `docker-compose.yml`: MiniStack (`nahuelnucera/ministack:latest`) on port 4566 + init script
- [ ] `infra/scripts/bootstrap.sh`: written and executable; dual-mode (`--local` / production); idempotent
- [ ] Run `./infra/scripts/bootstrap.sh` — verifies pre-provisioned infra (hosted zone, ACM certs, SES), provisions Terraform state S3 + DynamoDB lock tables, Lambda packages S3, writes SSM parameters, creates Secrets Manager secrets, sets GitHub secrets + environments
- [ ] `infra/terraform/envs/dev/` + `infra/terraform/envs/prod/`: provider configured with `profile = var.aws_profile`; backend reads from `qulene-{env}-tf-state`; all ACM/hosted zone values read from SSM via `data "aws_ssm_parameter"`
- [ ] `.env.example`, `PROJECT.md`, `CLAUDE.md` committed
- [ ] GitHub Actions CI skeleton: lint + typecheck + `ng lint` (all three Angular workspaces)

### Phase 1 — AWS Cognito & Auth Flow

- [ ] Terraform: Cognito User Pool + App Client (`qulene-{env}-user-pool`); `custom:role` attribute declared in schema
- [ ] Post-apply script: writes Cognito User Pool ID + App Client ID to SSM (`/qulene/{env}/cognito_user_pool_id`, `/qulene/{env}/cognito_app_client_id`) so Terraform modules and apps can read them without hardcoding
- [ ] Mobile: Amplify Auth config reads Cognito IDs from environment variables (populated from SSM values at build/deploy time)
- [ ] Mobile: registration screen (email, password, role selection) → JWT stored securely (Expo SecureStore)
- [ ] Mobile: Login screen
- [ ] Backend: `lambda-auth` — `POST /auth/profile` creates/syncs DynamoDB user record on first login
- [ ] Backend: `users` DynamoDB table + `users.table.ts` query helpers
- [ ] API Gateway: Cognito JWT authorizer wired
- [ ] End-to-end: register → login → get profile

### Phase 2 — Business Profile & Services

- [ ] DynamoDB tables: `business-profiles`, `services`, `availability-windows`
- [ ] `business.service.ts`: profile CRUD, avatar upload (S3 presigned URL)
- [ ] `service.service.ts`: create, update, soft-delete service
- [ ] `lambda-businesses` + `lambda-services` handlers
- [ ] API Gateway routes: businesses + services (public + authenticated)
- [ ] Mobile: Business registration flow (profile setup after auth)
- [ ] Mobile: Business dashboard → manage services + availability screens
- [ ] Mobile: Customer browse screen — list businesses, view business detail + services

### Phase 3 — Appointment Requests

- [ ] DynamoDB table: `appointment-requests`
- [ ] `appointment.service.ts`: submit request, accept, decline, cancel, complete, no-show
- [ ] Idempotency check on `POST /appointments`
- [ ] Notifications DynamoDB table + `notifications.table.ts`
- [ ] SNS publish on all appointment lifecycle events
- [ ] `lambda-appointments` handler + API Gateway routes
- [ ] Mobile: Customer appointment request screen (service picker + datetime + notes)
- [ ] Mobile: Customer "My Appointments" screen
- [ ] Mobile: Business "Incoming Requests" screen (accept/decline actions)

### Phase 4 — Waitlist

- [ ] DynamoDB table: `waitlist-entries`
- [ ] `waitlist.service.ts`: join, leave, promote (called from appointment decline/cancel flow)
- [ ] Promotion logic: find oldest ACTIVE entry for service → update status + notify
- [ ] SNS publish on `WAITLIST_PROMOTED`
- [ ] `lambda-waitlist` handler + API Gateway routes
- [ ] Mobile: "Join Waitlist" button on service detail (when no availability)
- [ ] Mobile: Customer "My Waitlist" screen
- [ ] Mobile: Business "Waitlist" screen per service

### Phase 5 — Email Notifications

- [ ] SES domain verification for `qulene.com` (in Terraform)
- [ ] Handlebars templates for all 6 email types (FR-EMAIL-01 through FR-EMAIL-07)
- [ ] `email.renderer.ts` — compile + render helpers
- [ ] SNS → SQS fan-out: `qulene-{env}-events` topic → `notification-queue`
- [ ] `lambda-notification` SQS consumer: routes event type → correct email + in-app notification
- [ ] Terraform: SNS topic + SQS queue + DLQ + Lambda trigger
- [ ] Integration test: full appointment lifecycle → verify email payloads

### Phase 6 — In-App Notifications

- [ ] `GET /notifications` endpoint with cursor pagination
- [ ] `PATCH /notifications/:id/read` endpoint
- [ ] `unreadNotificationCount` increment/decrement on `users` table (atomic UpdateItem)
- [ ] Mobile: Notifications screen with unread badge on tab bar icon
- [ ] Mobile: Mark as read on open

### Phase 7 — Marketing SPA

- [ ] Angular 17+ workspace scaffolded in `apps/marketing/` with Tailwind CSS; no Cognito or auth dependency
- [ ] `app.routes.ts`: client-side routes for all 7 pages (Home, About, How It Works, Pricing, Contact, Privacy, Terms); all components standalone
- [ ] Contact page component: POSTs to `POST /web/contact` via `HttpClient` (no auth header); `lambda-contact` → DynamoDB + admin email
- [ ] Waitlist signup component: POSTs to `POST /web/signup` via `HttpClient` (no auth header) → DynamoDB `web-signups` table
- [ ] Terraform: `spa` module instantiated for marketing — S3 (`qulene-{env}-frontend`) + CloudFront (404 → `index.html` for SPA routing) + Route 53 A-records for apex/www
- [ ] `deploy-marketing.sh`: `ng build` → `aws s3 sync dist/marketing/browser/` + CloudFront invalidation
- [ ] `ng build` and `ng lint` exit 0; verify site at `dev.qulene.com` → `qulene.com`

### Phase 8 — Angular Web Application

- [ ] Angular 17+ workspace scaffolded in `apps/web-app/` with Tailwind CSS
- [ ] `app.routes.ts`: full route table matching FR-WEBAPP-13 (public, customer, business route groups)
- [ ] `AuthGuard` + `RoleGuard` wired to all protected route groups
- [ ] `AuthInterceptor`: injects `Authorization: Bearer` on all non-public requests; clears token + redirects on 401/403
- [ ] `AuthService`: Cognito `signIn` / `signUp`, token stored in `localStorage` under `qulene_access_token`
- [ ] All six Angular services (`user`, `business`, `appointment`, `waitlist`, `notification`, `auth`) returning typed `Observable<T>`
- [ ] All components standalone — no `NgModule`; Angular Signals for state; Reactive Forms for all forms
- [ ] Public pages: browse businesses (`/businesses`), business detail (`/businesses/:id`)
- [ ] Customer pages: appointments, waitlist, notifications, profile
- [ ] Business pages: dashboard, profile (with avatar upload), services (CRUD), availability (CRUD), waitlist view, notifications
- [ ] Proxy config (`proxy.conf.json`): `/api/**` → `http://localhost:3000` for local dev
- [ ] Terraform: `spa` module — S3 (`qulene-{env}-app`) + CloudFront + Route 53 A-record for `app.*`
- [ ] `deploy-web-app.sh`: `ng build` → `aws s3 sync dist/web-app/` + CloudFront invalidation
- [ ] Empty states and loading skeletons on all list pages
- [ ] `ng build` exits 0; `ng lint` exits 0; manual smoke test against `dev` API

### Phase 9 — DevOps & Hardening

- [ ] GitHub Actions: `ci.yml` (lint, typecheck, vitest, `ng lint`, `ng build`), `deploy-dev.yml`, `deploy-prod.yml`
- [ ] CloudWatch log groups: 14-day retention per Lambda
- [ ] CloudWatch alarms: DLQ depth > 0, Lambda error rate > 1%
- [ ] Secrets Manager: populate `qulene-{env}-secrets` with SNS ARN, SES config, etc.
- [ ] IAM roles: least-privilege per Lambda (verified against Section 5.8)
- [ ] README.md with architecture diagram, local setup, deploy instructions, and links to both web app and mobile app

### Phase 10 — Polish & Portfolio Prep

- [ ] NativeWind design pass on all mobile screens (consistent spacing, colors, typography)
- [ ] Tailwind design pass on all Angular web app pages — visual language consistent with mobile
- [ ] Empty states and loading skeletons on all list screens (both mobile and web)
- [ ] Error handling: user-facing error messages on all API failures (both clients)
- [ ] App icon + splash screen (Expo)
- [ ] Demo seed script: creates 2 businesses, 4 services, 3 customers, sample requests + waitlist entries
- [ ] Screen recordings / screenshots for both mobile and web for portfolio README
- [ ] Architecture diagram (Excalidraw) exported to `docs/architecture.png`

---

## 12. Project Rules & AI-IDE Guidelines

### 12.1 Handler Thinness Rule

Lambda handlers in `backend/src/handlers/` are **dispatch only**. A handler should be reducible to:

1. Extract and validate input from the Lambda event (shape validation only)
2. Check role claim from `event.requestContext.authorizer.jwt.claims['custom:role']` against the required role
3. Call the appropriate service function
4. Return the formatted HTTP response

Any conditional logic, data transformation, or domain decision that appears inside a handler is a violation. Move it to the service layer.

### 12.2 Service Layer Authority

All business logic lives in `backend/src/services/`. Services are framework-agnostic — they accept plain TypeScript inputs and return typed outputs. They may call DynamoDB table helpers, SNS/SES clients, and other services. They must never import from `handlers/` or reference Lambda event shapes.

### 12.3 DynamoDB Query Encapsulation

Raw DynamoDB DocumentClient calls (`GetCommand`, `PutCommand`, `QueryCommand`, `UpdateCommand`) are only made inside `backend/src/db/tables/*.table.ts` files. Services call these helpers — never the DocumentClient directly. This makes queries swappable and testable with mocked clients.

### 12.4 Naming Conventions

- AWS resources: `qulene-{env}-{descriptor}` (kebab-case)
- TypeScript files: `camelCase.ts` for utilities; `camelCase.service.ts`, `camelCase.handler.ts`, `camelCase.table.ts` for domain files
- DynamoDB attributes: `camelCase` (not snake_case)
- Environment variables: `SCREAMING_SNAKE_CASE`
- Mobile route files: Expo Router convention — lowercase with hyphens for multi-word routes

### 12.5 Secrets Management

No secrets, credentials, or environment-specific values in committed code. All secrets are in Secrets Manager under `qulene-{env}-secrets` and injected as Lambda environment variables by Terraform. The `.env` file (local only) is in `.gitignore`. Never commit `.env`, `.env.dev`, or `.env.prod`.

### 12.6 Role Enforcement

Every route that is role-restricted must enforce the role server-side inside the Lambda handler, extracted from the pre-verified Cognito JWT claims injected by API Gateway. Do not rely on client-side or API Gateway route separation alone. A `CUSTOMER` calling a `BUSINESS` endpoint must receive `403 FORBIDDEN`. Role enforcement is a handler concern (protocol layer) — not a service layer concern.

### 12.7 Idempotency

Appointment request creation requires a client-supplied `idempotencyKey` (UUID format). The service function checks the `idempotencyKey-index` GSI before writing. If a record exists with the same key, return the existing record — do not create a duplicate and do not publish a second SNS event.

### 12.8 esbuild & Lambda Bundle Discipline

When adding a new Lambda handler:
- Add the entry point to `esbuild.config.ts` in the **same commit** as the handler file
- Add a Done When checklist item: `bundle appears in dist/lambdas/{name}/index.js`
- Never add a Lambda to Terraform without a corresponding esbuild entry

### 12.9 API Gateway Route Discipline

When adding a new API route:
- Add the API Gateway integration block to Terraform in the **same commit** as the Lambda handler
- Add a Done When checklist item: `API Gateway Terraform integration block present and validated`
- A route that exists in code but not in Terraform returns 404 in all deployed environments

### 12.10 Lambda Environment Variable Discipline

Before marking any phase complete, cross-reference the Lambda's Terraform `environment` block against the actual `process.env.*` reads in the handler code. Variables set but never read are noise and indicate drift between IaC and application code. Variables read but not set cause silent runtime failures.

### 12.11 Test Factory Helper Convention

Any `makeUser()` / `makeRequest()` / `makeEntry()` / `makeService()` test helper that creates a DynamoDB item must generate unique values for any attribute that has a uniqueness constraint (PKs, GSI keys used for uniqueness enforcement). Use a module-level counter reset in `beforeEach`:

```typescript
let seq = 0;
beforeEach(() => { seq = 0; });

function makeUser(overrides = {}) {
  return { userId: `user-${++seq}`, email: `user${seq}@test.com`, ...overrides };
}
```

Never hardcode `email: 'test@test.com'` or any other value that would collide on a second call within the same test file.

### 12.12 Date Fixture Convention

Test fixtures for date-based assertions must use clearly past values for "before" states. Never use a specific future date as a fixture — it will eventually become stale and break the test in a way that is hard to diagnose:

```typescript
// ✅ CORRECT
const pastExpiry = new Date('2023-01-01');
const renewed = await renewSomething({ expiry: pastExpiry });
expect(renewed.expiry > pastExpiry).toBe(true);

// ❌ WRONG — will fail after 2027-06-01
const expiry = new Date('2027-06-01');
```

### 12.13 Navigation Completeness

Every implemented route in **both** the mobile app and the Angular web app must have at least one navigation entry point — a tab bar tab, sidebar link, navbar item, button on a sibling screen, or in-screen link. A route accessible only by typing a URL directly is a portfolio defect. Navigation completeness is a Done When checklist item in every client-facing spec.

### 12.14 Angular Web App Standards

These rules apply to `apps/web-app/` and are non-negotiable:

- All components are **standalone** — no `NgModule` anywhere in the codebase
- Use the **new control flow syntax** (`@if`, `@for`, `@switch`) — never `*ngIf`, `*ngFor`
- **Signals** for all component state — not `BehaviorSubject`, not raw `Observable` subscriptions where signals suffice
- **Reactive Forms** for all forms — never template-driven forms
- All HTTP calls live in `apps/web-app/src/app/services/` — components never call `HttpClient` directly
- `AuthInterceptor` injects the JWT on every non-public request automatically — never manually add headers in service calls
- `AuthGuard` protects all authenticated routes; `RoleGuard` protects role-specific route groups
- JWT stored in `localStorage` under key `qulene_access_token` — never in cookies, never in session storage
- On `401`/`403` response: `AuthInterceptor` clears the token and redirects to `/login`
- All Angular service methods return `Observable<T>` typed to the response shape — no `any`
- `environment.ts` / `environment.prod.ts` are the **only** place where `apiUrl` is configured — no hardcoded URLs in services
- Every page component must have an empty state and a loading skeleton — never render an empty container while data is loading
- When the backend type is updated in `packages/api-types/`, the Angular service interfaces must be updated **in the same commit**

---

## 13. Infrastructure Cost Estimates

All estimates assume shared AWS account with no dedicated VPC or NAT Gateway.

| Service | Usage assumption | Monthly estimate |
| --- | --- | --- |
| DynamoDB (on-demand) | Low portfolio traffic | ~$0–1 |
| Lambda | Sporadic invocations | ~$0 (free tier) |
| API Gateway v2 | Low request volume | ~$0–1 |
| S3 (media + frontend) | < 1 GB storage | ~$0.02 |
| CloudFront | Low traffic | ~$0–1 |
| SNS + SQS | Low message volume | ~$0 |
| SES | < 1,000 emails/month | ~$0 (free tier) |
| Cognito | < 50,000 MAU | ~$0 (free tier) |
| Secrets Manager | 1 secret per env | ~$0.40/secret/month |
| CloudWatch Logs | 14-day retention | ~$0.50 |
| Route 53 | 1 hosted zone | ~$0.50 |
| **Total** | | **~$2–5/month per environment** |

---

## 14. Testing Plan

### 14.1 Unit Tests (Vitest)

- All service layer functions tested with mocked DynamoDB helpers and AWS SDK clients
- Test coverage targets: appointment lifecycle (submit, accept, decline, cancel), waitlist promotion logic, role enforcement, idempotency
- Located in `backend/src/services/__tests__/`

### 14.2 Integration Tests

- Full HTTP round-trips against local stack (MiniStack on port 4566)
- Key scenarios:
  - Register as BUSINESS → create service → register as CUSTOMER → submit request → business accepts → verify email payload in MiniStack SES (inspect via `GET http://localhost:4566/_ministack/ses` or equivalent internal API)
  - Submit duplicate request with same `idempotencyKey` → verify single record
  - Business declines request → verify waitlist promotion fires → verify notification record created
- Located in `backend/tests/integration/`

### 14.3 Mobile Testing

- Expo component tests with React Native Testing Library for critical UI flows (auth screens, appointment submission form)
- Manual smoke testing on iOS Simulator + Android Emulator before each deploy

### 14.4 Angular Web App Testing

- Angular component tests using the Angular Testing Library (`@testing-library/angular`) for critical page components (login, register, appointment form, business dashboard)
- All Angular service unit tests: mock `HttpClient` with `HttpClientTestingModule`; verify correct URLs, payloads, and error handling for every service method
- Guard and interceptor unit tests: verify redirect behavior on unauthenticated/wrong-role access and 401/403 responses
- `ng build` must exit 0 and `ng lint` must exit 0 before any deploy

### 14.5 End-to-End (Manual)

- Full persona walkthroughs against `dev` environment on **both** clients (Expo Go and Angular web at `app.dev.qulene.com`)
- Business persona: register → set up profile → add service → add availability → view/action requests
- Customer persona: register → browse → submit request → check notifications → join waitlist
- Feature parity check: every action completed in the mobile app must be completable in the web app