## Spec: Phase 0c — Terraform skeleton + CI workflow
**FR references**: (foundational — supports NFR-05 isolation, NFR-07 secrets, all phases needing Terraform deploy)
**Status**: 🔄 In Progress
**Prerequisites**: none (parallel with 0a, 0b)
**Size check**: 8 files · 0 service functions · 1 layer (infra/CI) · fits one session ✅

### What
Place the Terraform env directories (`dev`, `prod`) with provider blocks using `profile = var.aws_profile` and remote backend pointing at `qulene-{env}-tf-state`. Stand up the GitHub Actions CI skeleton that runs lint + typecheck + `ng lint` (placeholder for all three Angular workspaces) on every push and PR. No resources defined yet beyond the provider — those are added in later phases.

### Why
PROJECT.md Section 5.2a + CLAUDE.md "Lessons from Prior Projects" require the `var.aws_profile` pattern from day one — hardcoding `profile = "rmw-llc"` in the provider broke CI in PixiCred. The CI skeleton enforces the lint-on-every-push discipline before any code is written, so the first real code is already gated.

### New / Modified Files
- `infra/terraform/envs/dev/main.tf` — provider with `profile = var.aws_profile`; backend `s3` pointing at `qulene-dev-tf-state` + lock table `qulene-dev-tf-locks`; no resources yet
- `infra/terraform/envs/dev/variables.tf` — `aws_region`, `aws_profile` (default `"rmw-llc"`), `environment` (default `"dev"`)
- `infra/terraform/envs/dev/terraform.tfvars` — region `us-east-1`
- `infra/terraform/envs/prod/main.tf` — same shape, backend `qulene-prod-tf-state`
- `infra/terraform/envs/prod/variables.tf` — same vars, `environment` default `"prod"`
- `infra/terraform/envs/prod/terraform.tfvars` — region `us-east-1`
- `infra/terraform/bootstrap/main.tf` — placeholder file documenting that `infra/scripts/bootstrap.sh` provisions state buckets; no Terraform code (bootstrap is shell-only)
- `.github/workflows/ci.yml` — workflow with two jobs: `lint-typecheck` (Node setup, `npm ci`, `npm run lint`, `npm run typecheck`) and `ng-lint` (placeholder — `cd apps/web-app && ng lint` once that workspace exists; same for `apps/marketing`); both run on push to `main` and on pull_request

### Behavior
`terraform init` from `infra/terraform/envs/dev/` succeeds against the (already provisioned by `bootstrap.sh`) `qulene-dev-tf-state` bucket. `terraform validate` succeeds. `terraform plan` returns "No changes" because no resources are defined. The CI workflow uses OIDC auth (`id-token: write` + `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`) but does not yet run apply — that wiring is for Phase 9a. The `TF_VAR_aws_profile=""` env var is set on any future Terraform step in the workflow to bypass the local default profile.

The `ng lint` jobs are placeholders that early-exit gracefully when the Angular `package.json` lacks the `lint` script (the case until Phases 7b/8a scaffold those workspaces).

### Done When
- [ ] `terraform init` succeeds from both env directories
- [ ] `terraform validate` exits 0
- [ ] `terraform plan` returns "No changes"
- [ ] Every `provider "aws"` block uses `profile = var.aws_profile`
- [ ] Backend `s3` blocks reference `qulene-{env}-tf-state`
- [ ] CI workflow runs on push + pull_request to `main`
- [ ] CI workflow uses OIDC (`id-token: write` + `role-to-assume: ${{ secrets.AWS_ROLE_ARN }}`)
- [ ] Spec status updated to ✅ Implemented
- [ ] `IMPLEMENTATION_PLAN.md` progress tracker row updated
