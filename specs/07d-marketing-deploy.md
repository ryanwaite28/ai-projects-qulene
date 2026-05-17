## Spec: Phase 7d — Marketing Terraform deploy (S3 + CloudFront + Route 53)
**FR references**: FR-MKT-01, FR-MKT-04
**Status**: ⬜ Not Started
**Prerequisites**: 7b ✅ (can deploy stubs before forms wired; 7c content fills in incrementally without infra changes)
**Size check**: 3 files · 0 service functions · 1 layer (Terraform + script) · 5 new Terraform resource groups (S3 bucket, CloudFront distribution, OAC, Route 53 A apex + www) ≤ 6 limit ✅

### What
Provision the static hosting infrastructure for the marketing SPA. Build a reusable `spa` Terraform module that wraps S3 bucket + CloudFront distribution + Origin Access Control + Route 53 A-record(s). Instantiate it as a thin `marketing` wrapper for `qulene-{env}-frontend`. Add the deploy script that runs `ng build && aws s3 sync && cloudfront create-invalidation`.

### Why
FR-MKT-01: marketing site at `qulene.com`. The `spa` module is also reused by Phase 8f for the Angular web app — building it once here amortizes the work.

### New / Modified Files
- `infra/terraform/modules/spa/main.tf` — reusable module: S3 bucket (private + public access blocked); CloudFront distribution with Origin Access Control; viewer cert from SSM `/qulene/{env}/acm_certificate_arn`; SPA-friendly 404→index.html behavior; Route 53 A-records for the given aliases passed by caller
- `infra/terraform/modules/marketing/main.tf` — instantiates `spa` with bucket name `qulene-{env}-frontend` and aliases `qulene.com` + `www.qulene.com` (for prod) or `dev.qulene.com` + `www.dev.qulene.com` (for dev)
- `infra/scripts/deploy-marketing.sh` — `cd apps/marketing && ng build && aws s3 sync dist/marketing/browser/ s3://qulene-{env}-frontend/ --delete && aws cloudfront create-invalidation --distribution-id {id from SSM} --paths "/*"`; takes `{env}` as arg; uses `--profile rmw-llc` locally, OIDC in CI

### Behavior
**`spa` module signature**:
```hcl
module "marketing" {
  source        = "../../modules/marketing"
  environment   = var.environment
  bucket_name   = "qulene-${var.environment}-frontend"
  domain_names  = var.environment == "prod" ? ["qulene.com", "www.qulene.com"] : ["dev.qulene.com", "www.dev.qulene.com"]
  hosted_zone_id     = data.aws_ssm_parameter.hosted_zone_id.value
  acm_certificate_arn = data.aws_ssm_parameter.acm_cert_arn.value
}
```

**CloudFront behavior**:
- Default cache behavior serves from S3 via OAC
- Custom error responses: 403 → 200 `/index.html` (SPA routing); 404 → 200 `/index.html`
- Compression enabled
- TTL: default 1 day; min 0; max 1 year
- Viewer protocol policy: redirect-to-https
- Aliases: passed by caller
- Cert: wildcard `*.qulene.com` from SSM (covers both apex and `www`)

**Deploy script**: idempotent; reads CloudFront distribution ID from SSM at `/qulene/{env}/marketing_cloudfront_distribution_id` (written by Terraform output post-apply). Exit code reflects either build or sync failure.

**Note on apex A-record**: CloudFront aliases need ALIAS A-records (not CNAME) for the apex (`qulene.com`). Route 53 supports this via `aws_route53_record` with `alias` block.

### Done When
- [ ] `terraform apply` provisions S3 + CloudFront + Route 53 A-records for both aliases
- [ ] CloudFront uses OAC (not legacy OAI)
- [ ] 403/404 → `/index.html` configured (SPA routing)
- [ ] Wildcard cert from SSM applied
- [ ] `deploy-marketing.sh dev` builds + syncs + invalidates without errors
- [ ] Visiting `dev.qulene.com` returns the SPA (HTTP→HTTPS redirect verified)
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
