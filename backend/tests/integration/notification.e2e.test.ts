/**
 * E2E integration tests for the notification Lambda (SQS consumer).
 * Requires MiniStack on :4566. Run: docker-compose up -d then: npm test
 *
 * Strategy: seed DynamoDB in MiniStack, build synthetic SQS events with the real
 * SNS envelope format (raw_message_delivery=false), invoke the handler directly,
 * and assert observable side-effects in DynamoDB (for cascade) or that the handler
 * resolved without throwing (for email-only paths).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  DynamoDBClient,
  CreateTableCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { SQSEvent } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { handler } from '../../src/handlers/notification.handler.js';

const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:4566';
const REGION = 'us-east-1';
const CREDS = { accessKeyId: 'test', secretAccessKey: 'test' };

const adminDynamo = new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS });
const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS }),
);

const USERS_TABLE = process.env.USERS_TABLE ?? 'qulene-local-users';
const BUSINESS_TABLE = process.env.BUSINESS_PROFILES_TABLE ?? 'qulene-local-business-profiles';
const SVC_TABLE = process.env.SERVICES_TABLE ?? 'qulene-local-services';
const APT_TABLE = process.env.APPOINTMENT_REQUESTS_TABLE ?? 'qulene-local-appointment-requests';
const NOTIF_TABLE = process.env.NOTIFICATIONS_TABLE ?? 'qulene-local-notifications';
const WAITLIST_TABLE = process.env.WAITLIST_ENTRIES_TABLE ?? 'qulene-local-waitlist-entries';

let idCounter = 0;
const uid = () => `notif-e2e-${Date.now()}-${++idCounter}`;

async function createTableIfNotExists(
  params: ConstructorParameters<typeof CreateTableCommand>[0],
) {
  try {
    await adminDynamo.send(new CreateTableCommand(params));
  } catch (e) {
    if (!(e instanceof ResourceInUseException)) throw e;
  }
}

// Build a synthetic SQS record with the SNS envelope (raw_message_delivery=false)
function makeSqsEvent(eventType: string, payload: Record<string, string>): SQSEvent {
  const body = JSON.stringify({
    Type: 'Notification',
    MessageId: randomUUID(),
    TopicArn: process.env.SNS_TOPIC_ARN ?? 'arn:aws:sns:us-east-1:000000000000:qulene-local-events',
    Message: JSON.stringify({ eventType, payload }),
    Timestamp: new Date().toISOString(),
    SignatureVersion: '1',
    Signature: 'EXAMPLE',
    SigningCertURL: 'https://example.com',
    UnsubscribeURL: 'https://example.com',
  });
  return {
    Records: [
      {
        messageId: randomUUID(),
        receiptHandle: randomUUID(),
        body,
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: String(Date.now()),
          SenderId: 'test',
          ApproximateFirstReceiveTimestamp: String(Date.now()),
        },
        messageAttributes: {},
        md5OfBody: 'test',
        eventSource: 'aws:sqs',
        eventSourceARN: `arn:aws:sqs:${REGION}:000000000000:qulene-local-notifications`,
        awsRegion: REGION,
      },
    ],
  };
}

// Seed helpers
async function seedUser(overrides?: Partial<Record<string, unknown>>) {
  const userId = uid();
  const user = {
    userId,
    email: `${userId}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    role: 'CUSTOMER',
    unreadNotificationCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  await docClient.send(new PutCommand({ TableName: USERS_TABLE, Item: user }));
  return user;
}

async function seedBusinessUser() {
  return seedUser({ role: 'BUSINESS' });
}

async function seedBusinessProfile(businessId: string, businessName = 'Acme Salon') {
  const profile = {
    businessId,
    businessName,
    category: 'Beauty',
    description: null,
    address: null,
    city: null,
    state: null,
    phone: null,
    avatarUrl: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: BUSINESS_TABLE, Item: profile }));
  return profile;
}

async function seedService(businessId: string) {
  const serviceId = uid();
  const service = {
    serviceId,
    businessId,
    name: 'Haircut',
    description: 'Standard haircut',
    price: 30,
    durationMinutes: 30,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: SVC_TABLE, Item: service }));
  return service;
}

async function seedRequest(customerId: string, businessId: string, serviceId: string, status = 'PENDING') {
  const requestId = uid();
  const request = {
    requestId,
    customerId,
    businessId,
    serviceId,
    proposedAt: '2025-01-15T14:30:00.000Z',
    status,
    idempotencyKey: randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: APT_TABLE, Item: request }));
  return request;
}

async function seedWaitlistEntry(customerId: string, businessId: string, serviceId: string) {
  const entryId = uid();
  const entry = {
    entryId,
    customerId,
    businessId,
    serviceId,
    status: 'PROMOTED',
    joinedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: WAITLIST_TABLE, Item: entry }));
  return entry;
}

beforeAll(async () => {
  await createTableIfNotExists({
    TableName: USERS_TABLE,
    AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  });
  await createTableIfNotExists({
    TableName: BUSINESS_TABLE,
    AttributeDefinitions: [{ AttributeName: 'businessId', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'businessId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  });
  await createTableIfNotExists({
    TableName: SVC_TABLE,
    AttributeDefinitions: [
      { AttributeName: 'serviceId', AttributeType: 'S' },
      { AttributeName: 'businessId', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'serviceId', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'businessId-index',
        KeySchema: [{ AttributeName: 'businessId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  });
  await createTableIfNotExists({
    TableName: APT_TABLE,
    AttributeDefinitions: [
      { AttributeName: 'requestId', AttributeType: 'S' },
      { AttributeName: 'serviceId', AttributeType: 'S' },
      { AttributeName: 'customerId', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'requestId', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'serviceId-index',
        KeySchema: [{ AttributeName: 'serviceId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'customerId-index',
        KeySchema: [{ AttributeName: 'customerId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  });
  await createTableIfNotExists({
    TableName: NOTIF_TABLE,
    AttributeDefinitions: [
      { AttributeName: 'notificationId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'notificationId', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'userId-createdAt-index',
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  });
  await createTableIfNotExists({
    TableName: WAITLIST_TABLE,
    AttributeDefinitions: [{ AttributeName: 'entryId', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'entryId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  });
});

describe('notification handler — SQS consumer', () => {
  it('REQUEST_RECEIVED — resolves without throwing; email path exercised', async () => {
    const businessUser = await seedBusinessUser();
    const customer = await seedUser();
    await seedBusinessProfile(businessUser.userId);
    const service = await seedService(businessUser.userId);
    const request = await seedRequest(customer.userId, businessUser.userId, service.serviceId);

    const event = makeSqsEvent('REQUEST_RECEIVED', { appointmentRequestId: request.requestId });
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it('REQUEST_ACCEPTED — resolves without throwing', async () => {
    const businessUser = await seedBusinessUser();
    const customer = await seedUser();
    await seedBusinessProfile(businessUser.userId);
    const service = await seedService(businessUser.userId);
    const request = await seedRequest(customer.userId, businessUser.userId, service.serviceId, 'ACCEPTED');

    const event = makeSqsEvent('REQUEST_ACCEPTED', { appointmentRequestId: request.requestId });
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it('REQUEST_DECLINED — resolves without throwing', async () => {
    const businessUser = await seedBusinessUser();
    const customer = await seedUser();
    await seedBusinessProfile(businessUser.userId);
    const service = await seedService(businessUser.userId);
    const request = await seedRequest(customer.userId, businessUser.userId, service.serviceId, 'DECLINED');

    const event = makeSqsEvent('REQUEST_DECLINED', { appointmentRequestId: request.requestId });
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it('REQUEST_CANCELLED — resolves without throwing', async () => {
    const businessUser = await seedBusinessUser();
    const customer = await seedUser();
    await seedBusinessProfile(businessUser.userId);
    const service = await seedService(businessUser.userId);
    const request = await seedRequest(customer.userId, businessUser.userId, service.serviceId, 'CANCELLED');

    const event = makeSqsEvent('REQUEST_CANCELLED', { appointmentRequestId: request.requestId });
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it('WAITLIST_PROMOTED — resolves without throwing', async () => {
    const businessUser = await seedBusinessUser();
    const customer = await seedUser();
    await seedBusinessProfile(businessUser.userId);
    const service = await seedService(businessUser.userId);
    const entry = await seedWaitlistEntry(customer.userId, businessUser.userId, service.serviceId);

    const event = makeSqsEvent('WAITLIST_PROMOTED', { waitlistEntryId: entry.entryId });
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it('SERVICE_REMOVED cascade — PENDING and ACCEPTED requests cancelled in DynamoDB', async () => {
    const businessUser = await seedBusinessUser();
    const customer = await seedUser();
    await seedBusinessProfile(businessUser.userId);
    const service = await seedService(businessUser.userId);
    const pending = await seedRequest(customer.userId, businessUser.userId, service.serviceId, 'PENDING');
    const accepted = await seedRequest(customer.userId, businessUser.userId, service.serviceId, 'ACCEPTED');
    const completed = await seedRequest(customer.userId, businessUser.userId, service.serviceId, 'COMPLETED');

    const event = makeSqsEvent('SERVICE_REMOVED', { serviceId: service.serviceId });
    await handler(event);

    const [pendingRow, acceptedRow, completedRow] = await Promise.all([
      docClient.send(new GetCommand({ TableName: APT_TABLE, Key: { requestId: pending.requestId } })),
      docClient.send(new GetCommand({ TableName: APT_TABLE, Key: { requestId: accepted.requestId } })),
      docClient.send(new GetCommand({ TableName: APT_TABLE, Key: { requestId: completed.requestId } })),
    ]);
    expect(pendingRow.Item?.['status']).toBe('CANCELLED');
    expect(acceptedRow.Item?.['status']).toBe('CANCELLED');
    expect(completedRow.Item?.['status']).toBe('COMPLETED'); // unaffected
  });

  it('unknown eventType — resolves without throwing (no DLQ poisoning)', async () => {
    const event = makeSqsEvent('UNKNOWN_FUTURE_EVENT', { someId: 'x' });
    await expect(handler(event)).resolves.toBeUndefined();
  });

  it('missing records — handler resolves gracefully (early return in send*)', async () => {
    const event = makeSqsEvent('REQUEST_RECEIVED', { appointmentRequestId: 'nonexistent-id-99' });
    await expect(handler(event)).resolves.toBeUndefined();
  });
});
