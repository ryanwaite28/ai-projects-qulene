## Spec: Phase 8f — Web-app Terraform deploy (S3 + CloudFront + Route 53)
**FR references**: FR-WEBAPP-01
**Status**: ✅ Implemented
**Prerequisites**: 8a ✅ (can deploy incrementally as pages get added)
**Size check**: 4 files · 0 service functions · 1 layer (Terraform + script) · 5 resource groups via reused `spa` module ✅

### What
Provision S3 (`qulene-{env}-app`) + CloudFront + Route 53 A-record for `app.{env}.qulene.com` (or `app.qulene.com` for prod) by reusing the `spa` module from Phase 7d. Add the deploy script.

### Why
FR-WEBAPP-01: web app served at `app.qulene.com`. Reuses the work in 7d to amortize infra.

### New / Modified Files
- `infra/terraform/modules/webapp/main.tf` *(new)* — thin wrapper around `spa` module: `site_name="webapp"`, `bucket_name="qulene-{env}-app"`, `domain_names` via locals (prod → `app.qulene.com`, dev → `app.dev.qulene.com`)
- `infra/terraform/envs/dev/main.tf` *(modify from 7d)* — add `module "webapp"` block after `module "marketing"`
- `infra/terraform/envs/prod/main.tf` *(modify from 7d)* — add `module "webapp"` block before outputs
- `infra/scripts/deploy-web-app.sh` *(new)* — build (`--configuration production|development` based on env), sync `dist/web-app/browser/` → `s3://qulene-{env}-app/`, invalidate via SSM-stored distribution ID

### Behavior
**`webapp` module signature** (mirrors `marketing`):
```hcl
module "webapp" {
  source        = "../../modules/webapp"
  environment   = var.environment
  bucket_name   = "qulene-${var.environment}-app"
  domain_names  = var.environment == "prod" ? ["app.qulene.com"] : ["app.dev.qulene.com"]
  hosted_zone_id     = data.aws_ssm_parameter.hosted_zone_id.value
  acm_certificate_arn = data.aws_ssm_parameter.acm_cert_arn.value
}
```

CloudFront distribution ID is written to SSM `/qulene/{env}/webapp_cloudfront_distribution_id` for the deploy script to read.

**Build configuration**: `ng build --configuration=dev|prod` produces a build that swaps in the right `environment.{env}.ts` (apiUrl, Cognito IDs).

**SPA routing**: same as marketing — 403/404 → /index.html.

### Done When
- [x] `infra/terraform/modules/webapp/main.tf` created; `terraform validate` passes
- [x] `module "webapp"` added to `envs/dev/main.tf` and `envs/prod/main.tf`
- [x] `terraform plan` shows `qulene-dev-app` S3 bucket + CloudFront distribution + Route 53 A-record + SSM parameter to be created
- [x] `deploy-web-app.sh dev` builds with `--configuration development`, syncs to `s3://qulene-dev-app/`, reads distribution ID from SSM, creates CloudFront invalidation
- [x] `deploy-web-app.sh prod` uses `--configuration production` and `s3://qulene-prod-app/`
- [x] Script is executable (`chmod +x`)
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
