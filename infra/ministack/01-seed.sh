#!/bin/sh
#
# MiniStack ready.d init script — runs after MiniStack is ready and accepting connections.
# Creates the foundation queues, topics, subscriptions, and S3 buckets used by local development.
#
# Per-phase DynamoDB tables are NOT created here — they are created either by:
#   (a) running `./infra/scripts/bootstrap.sh --local` (writes Secrets Manager + verifies resources), or
#   (b) the Terraform apply (which talks to MiniStack when DYNAMODB_ENDPOINT points there), or
#   (c) per-phase seed scripts as phases land.

set -e

ENDPOINT=http://localhost:4566
ACCOUNT=000000000000
REGION=us-east-1

echo "[ministack/01-seed] Creating SNS topic qulene-local-events"
aws --endpoint-url=$ENDPOINT --region $REGION sns create-topic \
  --name qulene-local-events >/dev/null

echo "[ministack/01-seed] Creating SQS DLQ qulene-local-notifications-dlq"
aws --endpoint-url=$ENDPOINT --region $REGION sqs create-queue \
  --queue-name qulene-local-notifications-dlq >/dev/null

echo "[ministack/01-seed] Creating SQS queue qulene-local-notifications (redrive → DLQ)"
DLQ_ARN="arn:aws:sqs:${REGION}:${ACCOUNT}:qulene-local-notifications-dlq"
aws --endpoint-url=$ENDPOINT --region $REGION sqs create-queue \
  --queue-name qulene-local-notifications \
  --attributes "{\"RedrivePolicy\":\"{\\\"deadLetterTargetArn\\\":\\\"${DLQ_ARN}\\\",\\\"maxReceiveCount\\\":\\\"3\\\"}\",\"VisibilityTimeout\":\"120\"}" \
  >/dev/null

echo "[ministack/01-seed] Subscribing SQS queue to SNS topic"
TOPIC_ARN="arn:aws:sns:${REGION}:${ACCOUNT}:qulene-local-events"
QUEUE_ARN="arn:aws:sqs:${REGION}:${ACCOUNT}:qulene-local-notifications"
aws --endpoint-url=$ENDPOINT --region $REGION sns subscribe \
  --topic-arn "$TOPIC_ARN" \
  --protocol sqs \
  --notification-endpoint "$QUEUE_ARN" >/dev/null

echo "[ministack/01-seed] Creating S3 bucket qulene-local-media"
aws --endpoint-url=$ENDPOINT --region $REGION s3 mb s3://qulene-local-media >/dev/null

echo "[ministack/01-seed] Verifying SES email identity no-reply@qulene.com"
aws --endpoint-url=$ENDPOINT --region $REGION ses verify-email-identity \
  --email-address no-reply@qulene.com >/dev/null

echo "[ministack/01-seed] MiniStack foundation resources initialized."
