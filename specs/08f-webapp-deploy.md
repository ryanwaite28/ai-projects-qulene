## Spec: Phase 8f — Web-app Terraform deploy (S3 + CloudFront + Route 53)
**FR references**: FR-WEBAPP-01
**Status**: ⬜ Not Started
**Prerequisites**: 8a ✅ (can deploy incrementally as pages get added)
**Size check**: 2 files · 0 service functions · 1 layer (Terraform + script) · 5 resource groups via reused `spa` module ✅

### What
Provision S3 (`qulene-{env}-app`) + CloudFront + Route 53 A-record for `app.{env}.qulene.com` (or `app.qulene.com` for prod) by reusing the `spa` module from Phase 7d. Add the deploy script.

### Why
FR-WEBAPP-01: web app served at `app.qulene.com`. Reuses the work in 7d to amortize infra.

### New / Modified Files
- `infra/terraform/modules/webapp/main.tf` — thin wrapper around `spa` module with bucket name `qulene-{env}-app` and aliases `app.qulene.com` (prod) / `app.dev.qulene.com` (dev)
- `infra/scripts/deploy-web-app.sh` — `cd apps/web-app && ng build --configuration={env} && aws s3 sync dist/web-app/browser/ s3://qulene-{env}-app/ --delete && aws cloudfront create-invalidation --distribution-id {from SSM} --paths "/*"`

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
- [ ] `terraform apply` provisions `qulene-{env}-app` S3 + CloudFront + Route 53
- [ ] CloudFront uses wildcard cert from SSM
- [ ] 403/404 → /index.html configured
- [ ] `deploy-web-app.sh dev` builds + syncs + invalidates
- [ ] Visiting `app.dev.qulene.com` returns the SPA over HTTPS
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
