## Spec: Phase 2a — Backend business profile (service + table + handler + S3 + TF)
**FR references**: FR-BIZ-01, FR-BIZ-02, FR-BIZ-03, FR-BIZ-04, FR-BIZ-05, FR-BIZ-06
**Status**: ⬜ Not Started
**Prerequisites**: 1b ✅
**Size check**: 8 files · 4 service functions · 1 layer (backend + TF) · 4 routes (GET list, GET by id, PATCH me, POST avatar) · fits one session ✅

### What
Implement the business profile read + write endpoints: public list/detail and authenticated profile update + avatar upload via S3 presigned URL. Provision the `business-profiles` DynamoDB table and the `lambda-businesses` Lambda. On BUSINESS user creation (from Phase 1a), the user record alone exists; this phase adds the `business-profiles` row creation flow (lazy on first `PATCH /businesses/me`).

### Why
FR-BIZ-01 through FR-BIZ-06 define the business-facing identity layer needed before services (Phase 2b) or appointments (Phase 3) can be associated with a business. Public browse endpoints (Phase 2e mobile, Phase 8c web) require the read APIs from this phase.

### New / Modified Files
- `backend/src/db/tables/business-profiles.table.ts` — `getBusinessById`, `listActiveByCategoryPaginated` (Query `category-index`), `listAllActivePaginated` (Scan with filter — acceptable for low-volume portfolio; documented), `putBusinessProfile`, `updateBusinessProfile`, `setActiveFlag`
- `backend/src/services/business.service.ts` — `getBusinessById`, `listActiveBusinesses`, `updateOwnProfile`, `generateAvatarUploadUrl` (4 service functions ≤ 4 limit ✅)
- `backend/src/handlers/business.handler.ts` — routes `GET /businesses`, `GET /businesses/:businessId`, `PATCH /businesses/me`, `POST /businesses/me/avatar`
- `backend/src/clients/s3.client.ts` — `createS3Client()`; `generatePresignedPutUrl(bucket, key, contentType)` with 5-minute expiry
- `infra/terraform/modules/dynamodb-business-profiles/main.tf` — table `qulene-{env}-business-profiles` (PK: `businessId`); GSI `category-index` (PK: `category`, SK: `businessId`, projection ALL)
- `infra/terraform/modules/lambda-businesses/main.tf` — Lambda + IAM (dynamodb:* on business-profiles table, s3:PutObject on media bucket)
- `infra/terraform/envs/dev/main.tf` (modify) — instantiate modules, add 4 routes
- `backend/src/services/__tests__/business.service.test.ts` + `backend/tests/integration/business.handler.test.ts`

### Behavior
**`listActiveBusinesses(dynamo, { category?, cursor? })`**: if `category` provided, Query `category-index`; else Scan with `isActive=true` filter (acceptable for portfolio scale per CLAUDE.md DynamoDB rules — documented in code). Paginated via `LastEvaluatedKey`.

**`getBusinessById(dynamo, businessId)`**: simple GetItem; returns 404 envelope if missing.

**`updateOwnProfile(dynamo, { userId, role, updates })`**: handler must verify `role === 'BUSINESS'` before calling (403 if not). Service merges allowed fields (`businessName`, `category`, `description`, `address`, `city`, `state`, `phone`); on first call (no record), creates with PutItem. Sets `isActive = (businessName !== null && hasActiveService)` — `hasActiveService` lookup deferred until Phase 2b is integrated (call returns based on profile state only for now; Phase 2b will re-evaluate `isActive` on service create/delete).

**`generateAvatarUploadUrl(s3, { userId, contentType })`**: validates `contentType` is `image/jpeg|png|webp`; key = `business-profiles/{userId}/avatar.{ext}`; returns presigned PUT URL. Client uploads directly; on upload success, client calls `PATCH /businesses/me` with `avatarUrl: https://{bucket}.s3.amazonaws.com/{key}`.

**Role enforcement (handler)**: `PATCH /businesses/me` and `POST /businesses/me/avatar` require `role=BUSINESS` → 403 if not.

### Done When
- [ ] `GET /businesses` returns paginated list, filterable by `category`
- [ ] `GET /businesses/:businessId` returns 404 for missing IDs
- [ ] `PATCH /businesses/me` (BUSINESS) creates or merges profile
- [ ] `POST /businesses/me/avatar` returns presigned URL with 5-min expiry
- [ ] CUSTOMER calling business-only endpoints → 403 (regression-tested)
- [ ] `dist/lambdas/businesses/index.js` bundle present
- [ ] API GW integration block for all 4 routes added to Terraform
- [ ] Lambda env vars match `process.env.*` reads exactly
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
