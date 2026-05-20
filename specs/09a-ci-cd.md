## Spec: Phase 9a — GitHub Actions CI/CD workflows
**FR references**: NFR-05 (env isolation), NFR-07 (no secrets in code)
**Status**: ✅ Implemented
**Prerequisites**: 0c ✅ (CI skeleton extended in this phase with deploy steps)
**Size check**: 3 files · 0 service functions · 1 layer (CI) · fits one session ✅

### What
Extend the Phase 0c CI skeleton with full deploy workflows: `deploy-dev.yml` (auto on push to main) and `deploy-prod.yml` (manual approval via `prod-approval` GitHub environment). Each workflow runs: lint + typecheck + tests + esbuild + ng build + terraform apply + deploy-web-app + deploy-marketing + integration smoke tests.

### Why
PROJECT.md Section 9.2 specifies the full CI/CD pipeline. Until this exists, deploys are manual.

### New / Modified Files
- `.github/workflows/ci.yml` (modify Phase 0c version) — add backend + Angular unit test jobs; verify Lambda bundles present in `dist/lambdas/` for every entry in `backend/esbuild.config.ts`
- `.github/workflows/deploy-dev.yml` (new) — triggers on push to `main`; jobs: lint+test → build → terraform apply (dev) → deploy-web-app dev → deploy-marketing dev → smoke tests; uses OIDC `AWS_ROLE_ARN` secret + `TF_VAR_aws_profile=""`
- `.github/workflows/deploy-prod.yml` (new) — triggers on workflow_dispatch + manual approval through `prod-approval` GitHub environment with required reviewers; same job structure but targeting prod env directories and prod S3 buckets

### Behavior
**Bundle audit step**: a shell step parses `backend/esbuild.config.ts` for declared entry points, then verifies a file exists at `dist/lambdas/{name}/index.js` for each. Missing bundle → workflow fails (mitigates the PixiCred "silent deployment gap" lesson).

**OIDC auth**: every job that touches AWS uses
```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
      aws-region: us-east-1
```

**Terraform profile override**: every `terraform` step sets
```yaml
env:
  TF_VAR_aws_profile: ""
```
…so the `rmw-llc` local default is bypassed and OIDC env credentials are used.

**Smoke tests**: simple HTTPS probe against `https://api.dev.qulene.com/healthz` (a placeholder route returning 200 OK; this route is added in this phase as part of `lambda-auth` for low overhead) and a curl of `https://app.dev.qulene.com` checking for HTTP 200 and the SPA bundle.

**Prod gating**: `deploy-prod.yml` uses `environment: prod-approval` on its main job → GitHub blocks the run until a required reviewer approves through the UI.

### Done When
- [x] Push to main runs `ci.yml` lint+test+build (no deploy yet) and exits 0
- [x] Push to main runs `deploy-dev.yml` which applies Terraform + deploys both SPAs and runs smoke tests against dev
- [x] Manually triggering `deploy-prod.yml` requires approval before any deploy step
- [x] Bundle audit step fails the workflow when an entry is missing
- [x] All AWS-touching steps use OIDC + `TF_VAR_aws_profile=""`
- [x] `AWS_ROLE_ARN` referenced via `secrets`; never hardcoded
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
