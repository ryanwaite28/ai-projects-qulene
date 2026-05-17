## Spec: Phase 0b — Frontend app stubs + Local stack (MiniStack)
**FR references**: (foundational — supports FR-WEBAPP-01, FR-MKT-01 by reserving workspace slots; supports local dev for all subsequent phases)
**Status**: ✅ Implemented (2026-05-17 — files written; MiniStack runtime verification deferred until Docker storage is repaired)
**Prerequisites**: none (parallel with 0a, 0c)
**Size check**: 5 files · 0 service functions · 1 layer (tooling/infra) · fits one session ✅

### What
Declare the three frontend workspace members (`apps/mobile`, `apps/web-app`, `apps/marketing`) as package.json stubs only — no Expo init, no `ng new`. Stand up the local MiniStack development stack via `docker-compose.yml` + the seed init script from PROJECT.md Section 10.4 so subsequent phases can run integration tests against real local AWS service emulation.

### Why
Reserves the workspace slots required by Phase 1c (mobile), Phase 7b (marketing), and Phase 8a (web-app). The local MiniStack stack is the foundation for every backend integration test from Phase 1a onward; it must exist before any handler integration test can run.

### New / Modified Files
- `apps/mobile/package.json` — workspace member stub (name: `@qulene/mobile`, private: true)
- `apps/mobile/app.json` — minimal Expo config skeleton (name + slug)
- `apps/web-app/package.json` — workspace member stub (name: `@qulene/web-app`, private: true)
- `apps/marketing/package.json` — workspace member stub (name: `@qulene/marketing`, private: true)
- `docker-compose.yml` — MiniStack (`nahuelnucera/ministack:latest`) on `:4566` with healthcheck + ready.d volume mount
- `infra/ministack/01-seed.sh` — MiniStack init script per PROJECT.md Section 10.4 (SNS topic + SQS queues + DLQ + subscription + S3 bucket)

### Behavior
Running `docker-compose up -d` from the repo root starts a single MiniStack container exposing port 4566. The container's healthcheck must pass within 50 seconds. The init script `01-seed.sh` runs after MiniStack is ready and creates the local SNS topic, the notification SQS queue with redrive to the DLQ (`maxReceiveCount=3`), the SNS→SQS subscription, and the `qulene-local-media` S3 bucket. After `docker-compose up -d`, `aws --endpoint-url=http://localhost:4566 sqs list-queues` returns both `qulene-local-notifications` and `qulene-local-notifications-dlq`.

The frontend package stubs declare workspace membership so `npm install` from root succeeds, but contain no actual Expo or Angular project files — those come in their respective phases (1c for mobile, 7b for marketing, 8a for web-app). Each `package.json` stub uses `"private": true` to prevent accidental publish.

### Done When
- [ ] `docker-compose up -d` succeeds; MiniStack healthcheck passes  ← **deferred: Docker/colima storage I/O error blocks this; verify after `colima restart` (or `colima delete && colima start`)**
- [ ] `aws --endpoint-url=http://localhost:4566 sns list-topics` returns `qulene-local-events`  ← deferred (same)
- [ ] `aws --endpoint-url=http://localhost:4566 sqs list-queues` returns both notification queue + DLQ  ← deferred (same)
- [ ] `aws --endpoint-url=http://localhost:4566 s3 ls` returns `qulene-local-media`  ← deferred (same)
- [x] `npm install` from root recognizes all three frontend workspace members
- [x] Each frontend `package.json` declares `"private": true`
- [x] Spec status updated to ✅ Implemented
- [x] `IMPLEMENTATION_PLAN.md` progress tracker row updated
