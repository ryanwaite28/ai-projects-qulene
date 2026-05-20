## Spec: Phase 9b — CloudWatch log groups + alarms + DLQ monitoring
**FR references**: NFR-06 (observability)
**Status**: ✅ Implemented
**Prerequisites**: 5a ✅
**Size check**: 2 files · 0 service functions · 1 layer (Terraform) · ≤ 6 resource groups (log groups module + alarms module) ✅

### What
Provision CloudWatch log group retention (14 days per PROJECT.md) for every Lambda, plus alarms on DLQ depth > 0 and per-Lambda error rate > 1%. Wraps existing per-Lambda Terraform modules' log groups with a retention block; adds a dedicated `observability` module for alarms.

### Why
NFR-06 + PROJECT.md Section 9.2 + CLAUDE.md DLQ requirement: silent failures are forbidden; alarms surface them.

### New / Modified Files
- `infra/terraform/modules/observability/main.tf` — CloudWatch alarms: `qulene-{env}-notifications-dlq-depth` (metric: `ApproximateNumberOfMessages` on the DLQ; threshold > 0), `qulene-{env}-lambda-errors-{name}` (per Lambda; metric: `Errors`; threshold > 1% of `Invocations` over 5-minute window — uses metric math)
- Modify each `infra/terraform/modules/lambda*/main.tf` — add `aws_cloudwatch_log_group` resource explicitly with `retention_in_days = 14` (instead of relying on Lambda auto-creation with no retention)

### Behavior
**Log retention**: every Lambda's log group is now `aws_cloudwatch_log_group.this`, name `/aws/lambda/qulene-{env}-{name}`, retention 14 days. The Lambda's `logging_config` (Node.js 20+ feature) emits JSON-formatted lines so CloudWatch Insights can query structured fields.

**DLQ alarm**: any message in the notification DLQ for > 1 evaluation period triggers the alarm. Alarm action: SNS notification to admin (re-use the events topic? — better: a separate `qulene-{env}-alarms` SNS topic with an email subscription; the topic and subscription are provisioned by this module).

**Lambda error rate alarm**: metric math `(Errors / Invocations) * 100 > 1` over 5 minutes; only when Invocations > 10 (don't alarm on idle Lambdas). Per-Lambda alarm.

**No custom dashboards in this phase** (deferred to Phase 10 if scope allows). The default CloudWatch console + the configured alarms are sufficient for portfolio observability.

### Done When
- [x] Every Lambda has an explicit log group with `retention_in_days = 14`
- [x] DLQ depth alarm provisioned + subscribed to alarms SNS topic
- [x] Per-Lambda error rate alarm provisioned
- [x] Admin email subscribed to alarms SNS topic
- [x] Verify by manually pushing a malformed message to the queue → DLQ depth alarm fires within 5 minutes
- [x] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
