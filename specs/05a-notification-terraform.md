## Spec: Phase 5a — Terraform SQS + SNS + DLQ + lambda-notification IAM
**FR references**: (infrastructure for FR-EMAIL-01 through FR-EMAIL-07 and FR-NOTIF-06)
**Status**: ⬜ Not Started
**Prerequisites**: 0c ✅
**Size check**: 3 files · 0 service functions · 1 layer (Terraform) · 5 new Terraform resource groups (SNS topic, SQS queue, DLQ, subscription, Lambda + event source mapping + IAM) ≤ 6 limit ✅

### What
Provision the SNS topic `qulene-{env}-events`, the SQS queue `qulene-{env}-notifications` + its DLQ, the SNS→SQS subscription, the `lambda-notification` deploy with SQS event source mapping, and the IAM role (sqs:Receive/Delete, ses:SendEmail, dynamodb:GetItem on multiple tables for record lookups). Updates `qulene-{env}-secrets` JSON to include the SNS topic ARN. The Lambda code is implemented in Phase 5c — this phase deploys an empty handler stub.

### Why
PROJECT.md Section 5.6: notification-queue with 120s visibility timeout, maxReceiveCount 3, DLQ. The infrastructure must exist before Phase 5c can wire the consumer logic.

### New / Modified Files
- `infra/terraform/modules/sns/main.tf` — SNS topic `qulene-{env}-events`
- `infra/terraform/modules/sqs/main.tf` — `qulene-{env}-notifications` (visibility 120s) + `qulene-{env}-notifications-dlq`; redrive policy maxReceiveCount=3; SNS→SQS subscription including raw message delivery option (false; we want the SNS envelope for the consumer to parse `envelope.Message`)
- `infra/terraform/modules/lambda-notification/main.tf` — Lambda deployment (stub handler returns OK), event source mapping from SQS, IAM role with: sqs:ReceiveMessage / DeleteMessage / GetQueueAttributes on the notification queue; ses:SendEmail / SendRawEmail; dynamodb:GetItem on appointment-requests, users, business-profiles, services, waitlist-entries

### Behavior
`terraform apply` provisions all four resources + the IAM role. The SNS topic ARN is added to the `qulene-{env}-secrets` JSON via a post-apply script (small `aws secretsmanager update-secret` shell call wired into the Terraform output workflow or run by `9c` later — both paths acceptable).

The stub handler:
```typescript
export const handler = async () => ({ statusCode: 200 });
```
…lets the event source mapping be wired without runtime errors. Phase 5c replaces the stub with the real consumer.

DLQ alarming is deferred to Phase 9b (which adds the CloudWatch alarm on `ApproximateNumberOfMessages > 0`).

### Done When
- [ ] `terraform apply` provisions SNS topic, SQS queue, DLQ, subscription, Lambda + ESM, IAM
- [ ] Visibility timeout: 120s; redrive maxReceiveCount: 3
- [ ] SNS→SQS subscription does NOT use raw message delivery (envelope preserved)
- [ ] IAM grants exactly the permissions listed (no wildcards beyond what's listed)
- [ ] `SNS_TOPIC_ARN` written to `qulene-{env}-secrets`
- [ ] Stub handler deploys and ESM successfully attaches
- [ ] Spec status updated to ✅ Implemented; `IMPLEMENTATION_PLAN.md` updated
