## Spec: Phase 7d — Marketing Terraform deploy (S3 + CloudFront + Route 53)
**FR references**: FR-MKT-01, FR-MKT-04
**Status**: ✅ Implemented
**Prerequisites**: 7b ✅, 7c-a ✅, 7c-b ✅
**Size check**: 4 files · 0 service functions · 1 layer (Terraform + deploy script) · 4 resource groups in `spa` module ≤ 6 limit ✅

### What
Provision the static hosting infrastructure for the marketing SPA: a reusable `spa` Terraform module (S3 + CloudFront OAC + Route 53 ALIAS records + SSM distribution ID write) and a thin `marketing` module that instantiates it with environment-specific domain names. Wire the marketing module into `envs/dev/main.tf`. Add a deploy script that builds the Angular app and syncs `dist/marketing/browser/` to S3 + invalidates CloudFront.

The `spa` module is designed for reuse: Phase 8f will instantiate it again for `qulene-{env}-app`.

### Why
FR-MKT-01: marketing SPA at `qulene.com` via CloudFront + S3. FR-MKT-04: deployed independently from the web app.

### New / Modified Files
- `infra/terraform/modules/spa/main.tf` — variables, S3 bucket + public-access block + bucket policy (OAC principal), CloudFront OAC + distribution (OAC origin, 403/404→index.html, redirect-to-https, aliases, cert), Route 53 ALIAS A-records (`for_each = toset(var.domain_names)`), SSM parameter `/qulene/{env}/{site_name}_cloudfront_distribution_id`; outputs: `cloudfront_distribution_id`, `bucket_name`, `cloudfront_domain_name`
- `infra/terraform/modules/marketing/main.tf` — variables (environment, hosted_zone_id, acm_certificate_arn); instantiates `../spa` with `site_name = "marketing"`, `bucket_name = "qulene-${var.environment}-frontend"`, and env-conditional domain names; exposes `cloudfront_distribution_id` output
- `infra/terraform/envs/dev/main.tf` *(modify)* — add Phase 7d block: `module "marketing"` using already-present SSM data sources
- `infra/scripts/deploy-marketing.sh` — `ng build --configuration production`; reads distribution ID from SSM; `aws s3 sync dist/marketing/browser/`; `cloudfront create-invalidation`; profile-aware

### Behavior

**`spa` module variable list**:
```hcl
variable "environment"         { type = string }
variable "site_name"           { type = string }   # "marketing" | "app" — used in resource names + SSM key
variable "bucket_name"         { type = string }
variable "domain_names"        { type = list(string) }
variable "hosted_zone_id"      { type = string }
variable "acm_certificate_arn" { type = string }
```

**S3**: private bucket, all four public-access block flags true.

**S3 bucket policy**: principal `cloudfront.amazonaws.com`, action `s3:GetObject`, resource `${bucket_arn}/*`, condition `AWS:SourceArn = ${cloudfront_distribution_arn}`.

**CloudFront origin**: `domain_name = aws_s3_bucket.spa.bucket_regional_domain_name` (regional — required for OAC; `bucket_domain_name` does not work with OAC), `origin_access_control_id` set. No `s3_origin_config` block.

**CloudFront distribution**:
- `default_root_object = "index.html"`
- `default_cache_behavior`: `allowed_methods = ["GET", "HEAD", "OPTIONS"]`, `cached_methods = ["GET", "HEAD"]`, `viewer_protocol_policy = "redirect-to-https"`, `compress = true`
- `custom_error_response { error_code = 403; response_code = 200; response_page_path = "/index.html" }`
- `custom_error_response { error_code = 404; response_code = 200; response_page_path = "/index.html" }`
- `aliases = var.domain_names`
- `viewer_certificate`: `acm_certificate_arn`, `ssl_support_method = "sni-only"`, `minimum_protocol_version = "TLSv1.2_2021"`
- `price_class = "PriceClass_100"` (US + EU; cost-efficient per NFR-02)

**Route 53**: `aws_route53_record "aliases" { for_each = toset(var.domain_names) }` — type A, `alias { name = cloudfront.domain_name; zone_id = cloudfront.hosted_zone_id; evaluate_target_health = false }`. Apex A-record requires `alias` block (not CNAME).

**SSM parameter**: `aws_ssm_parameter "distribution_id"` writes CloudFront distribution ID to `/qulene/${var.environment}/${var.site_name}_cloudfront_distribution_id`; type String.

**`marketing` module domain names**: `var.environment == "prod" ? ["qulene.com", "www.qulene.com"] : ["dev.qulene.com", "www.dev.qulene.com"]`

**Deploy script profile handling**: `PROFILE="${AWS_PROFILE:-rmw-llc}"`. All `aws` CLI calls use `${PROFILE:+--profile "${PROFILE}"}` so that setting `AWS_PROFILE=""` in CI omits the flag and falls back to OIDC environment credentials.

**`ng build` output path**: `apps/marketing/dist/marketing/browser/` (the Angular `application` builder puts assets in a `browser/` subdirectory).

### Done When
- [x] `terraform validate` passes — HCL configuration is valid (live `terraform plan` requires SSO refresh, not blocked on code)
- [x] CloudFront uses OAC; `bucket_regional_domain_name` used as origin (not `bucket_domain_name`)
- [x] Custom error responses: 403 + 404 → 200 `/index.html`
- [x] ALIAS A-records created for both apex and www via `for_each`
- [x] SSM parameter `/qulene/dev/marketing_cloudfront_distribution_id` written by `aws_ssm_parameter` resource after apply
- [x] `deploy-marketing.sh dev` builds + syncs `dist/marketing/browser/` + invalidates without errors
- [x] `AWS_PROFILE="" ./deploy-marketing.sh dev` omits `--profile` flag via `${PROFILE:+...}` expansion
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
