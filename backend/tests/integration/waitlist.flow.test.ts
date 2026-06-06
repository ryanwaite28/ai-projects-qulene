/**
 * Integration tests for the waitlist Lambda handler and E2E promotion flow.
 * Requires MiniStack on :4566. Run: docker-compose up -d then: npm test (from backend/)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  DynamoDBClient,
  CreateTableCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, CreateTopicCommand } from '@aws-sdk/client-sns';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { handler as waitlistHandler } from '../../src/handlers/waitlist.handler.js';
import { handler as appointmentHandler } from '../../src/handlers/appointment.handler.js';

const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:4566';
const SNS_ENDPOINT = process.env.SNS_ENDPOINT ?? 'http://localhost:4566';
const REGION = 'us-east-1';
const CREDS = { accessKeyId: 'test', secretAccessKey: 'test' };

const adminDynamo = new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS });
const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS }),
);
const sns = new SNSClient({ endpoint: SNS_ENDPOINT, region: REGION, credentials: CREDS });

const WAITLIST_TABLE = process.env.WAITLIST_ENTRIES_TABLE ?? 'qulene-local-waitlist-entries';
const APT_TABLE = process.env.APPOINTMENT_REQUESTS_TABLE ?? 'qulene-local-appointment-requests';
const NOTIF_TABLE = process.env.NOTIFICATIONS_TABLE ?? 'qulene-local-notifications';
const USERS_TABLE = process.env.USERS_TABLE ?? 'qulene-local-users';
const SVC_TABLE = process.env.SERVICES_TABLE ?? 'qulene-local-services';

let idCounter = 0;
const uid = () => `integ-wl-${Date.now()}-${++idCounter}`;

async function createTableIfNotExists(params: ConstructorParameters<typeof CreateTableCommand>[0]) {
  try {
    await adminDynamo.send(new CreateTableCommand(params));
  } catch (e) {
    if (!(e instanceof ResourceInUseException)) throw e;
  }
}

function makeEvent(overrides: {
  routeKey: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: Record<string, unknown>;
  userId?: string;
  role?: string;
  skipAuth?: boolean;
}): APIGatewayProxyEventV2 {
  const userId = overrides.userId ?? uid();
  const claims: Record<string, string> = overrides.skipAuth
    ? {}
    : { sub: userId, 'custom:role': overrides.role ?? 'CUSTOMER', email: `${userId}@test.com` };

  return {
    version: '2.0',
    routeKey: overrides.routeKey,
    rawPath: '/',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    pathParameters: overrides.pathParameters,
    queryStringParameters: overrides.queryStringParameters,
    body: overrides.body ? JSON.stringify(overrides.body) : undefined,
    requestContext: {
      accountId: '000000000000',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: '',
      http: { method: 'GET', path: '/', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: uid(),
      routeKey: overrides.routeKey,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      authorizer: { jwt: { claims, scopes: [] } },
    },
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

let seedBizId: string;
let seedSvcId: string;

beforeAll(async () => {
  await sns.send(new CreateTopicCommand({ Name: 'qulene-local-events' })).catch(() => undefined);

  await createTableIfNotExists({
    TableName: WAITLIST_TABLE,
    AttributeDefinitions: [
      { AttributeName: 'entryId', AttributeType: 'S' },
      { AttributeName: 'customerId', AttributeType: 'S' },
      { AttributeName: 'serviceId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'entryId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
    GlobalSecondaryIndexes: [
      {
        IndexName: 'serviceId-status-index',
        KeySchema: [
          { AttributeName: 'serviceId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'customerId-index',
        KeySchema: [
          { AttributeName: 'customerId', KeyType: 'HASH' },
          { AttributeName: 'createdAt', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  });

  await createTableIfNotExists({
    TableName: APT_TABLE,
    AttributeDefinitions: [
      { AttributeName: 'requestId', AttributeType: 'S' },
      { AttributeName: 'businessId', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'customerId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
      { AttributeName: 'serviceId', AttributeType: 'S' },
      { AttributeName: 'idempotencyKey', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'requestId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
    GlobalSecondaryIndexes: [
      { IndexName: 'businessId-status-index', KeySchema: [{ AttributeName: 'businessId', KeyType: 'HASH' }, { AttributeName: 'status', KeyType: 'RANGE' }], Projection: { ProjectionType: 'ALL' } },
      { IndexName: 'customerId-index', KeySchema: [{ AttributeName: 'customerId', KeyType: 'HASH' }, { AttributeName: 'createdAt', KeyType: 'RANGE' }], Projection: { ProjectionType: 'ALL' } },
      { IndexName: 'serviceId-index', KeySchema: [{ AttributeName: 'serviceId', KeyType: 'HASH' }], Projection: { ProjectionType: 'ALL' } },
      { IndexName: 'idempotencyKey-index', KeySchema: [{ AttributeName: 'idempotencyKey', KeyType: 'HASH' }], Projection: { ProjectionType: 'ALL' } },
    ],
  });

  await createTableIfNotExists({
    TableName: NOTIF_TABLE,
    AttributeDefinitions: [
      { AttributeName: 'notificationId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'notificationId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
    GlobalSecondaryIndexes: [
      { IndexName: 'userId-createdAt-index', KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }, { AttributeName: 'createdAt', KeyType: 'RANGE' }], Projection: { ProjectionType: 'ALL' } },
    ],
  });

  await createTableIfNotExists({
    TableName: USERS_TABLE,
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
    GlobalSecondaryIndexes: [
      { IndexName: 'email-index', KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }], Projection: { ProjectionType: 'ALL' } },
    ],
  });

  await createTableIfNotExists({
    TableName: SVC_TABLE,
    AttributeDefinitions: [
      { AttributeName: 'serviceId', AttributeType: 'S' },
      { AttributeName: 'businessId', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'serviceId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
    GlobalSecondaryIndexes: [
      { IndexName: 'businessId-index', KeySchema: [{ AttributeName: 'businessId', KeyType: 'HASH' }, { AttributeName: 'createdAt', KeyType: 'RANGE' }], Projection: { ProjectionType: 'ALL' } },
    ],
  });

  // Seed business user + service
  seedBizId = uid();
  seedSvcId = randomUUID();
  const now = new Date().toISOString();

  await docClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: { userId: seedBizId, email: `${seedBizId}@biz.com`, role: 'BUSINESS', firstName: 'Biz', lastName: 'Owner', unreadNotificationCount: 0, createdAt: now, updatedAt: now },
  }));

  await docClient.send(new PutCommand({
    TableName: SVC_TABLE,
    Item: { serviceId: seedSvcId, businessId: seedBizId, name: 'Haircut', description: '', durationMinutes: 60, price: 3000, status: 'ACTIVE', createdAt: now, updatedAt: now },
  }));
});

// ─── POST /waitlist ───────────────────────────────────────────────────────────

describe('POST /waitlist', () => {
  it('creates an ACTIVE waitlist entry (201)', async () => {
    const custId = uid();
    const event = makeEvent({
      routeKey: 'POST /waitlist',
      userId: custId,
      body: { serviceId: seedSvcId },
    });
    const res = await waitlistHandler(event);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('ACTIVE');
    expect(body.data.customerId).toBe(custId);
    expect(body.data.serviceId).toBe(seedSvcId);
  });

  it('returns 409 when customer is already on the waitlist', async () => {
    const custId = uid();
    const body = { serviceId: seedSvcId };
    await waitlistHandler(makeEvent({ routeKey: 'POST /waitlist', userId: custId, body }));
    const res = await waitlistHandler(makeEvent({ routeKey: 'POST /waitlist', userId: custId, body }));
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).error.code).toBe('CONFLICT');
  });

  it('returns 404 when service does not exist', async () => {
    const res = await waitlistHandler(makeEvent({
      routeKey: 'POST /waitlist',
      body: { serviceId: randomUUID() },
    }));
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when serviceId is missing', async () => {
    const res = await waitlistHandler(makeEvent({
      routeKey: 'POST /waitlist',
      body: {},
    }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 403 when role is BUSINESS', async () => {
    const res = await waitlistHandler(makeEvent({
      routeKey: 'POST /waitlist',
      role: 'BUSINESS',
      body: { serviceId: seedSvcId },
    }));
    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /waitlist/me ─────────────────────────────────────────────────────────

describe('GET /waitlist/me', () => {
  it('returns list of waitlist entries for the authenticated customer (200)', async () => {
    const custId = uid();
    // Join first
    await waitlistHandler(makeEvent({ routeKey: 'POST /waitlist', userId: custId, body: { serviceId: seedSvcId } }));

    const res = await waitlistHandler(makeEvent({
      routeKey: 'GET /waitlist/me',
      userId: custId,
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].customerId).toBe(custId);
  });

  it('returns 403 when role is BUSINESS', async () => {
    const res = await waitlistHandler(makeEvent({ routeKey: 'GET /waitlist/me', role: 'BUSINESS' }));
    expect(res.statusCode).toBe(403);
  });
});

// ─── DELETE /waitlist/{entryId} ───────────────────────────────────────────────

describe('DELETE /waitlist/{entryId}', () => {
  it('removes an ACTIVE entry and returns REMOVED status (200)', async () => {
    const custId = uid();
    const joinRes = await waitlistHandler(makeEvent({
      routeKey: 'POST /waitlist',
      userId: custId,
      body: { serviceId: seedSvcId },
    }));
    const { entryId } = JSON.parse(joinRes.body).data;

    const leaveRes = await waitlistHandler(makeEvent({
      routeKey: 'DELETE /waitlist/{entryId}',
      userId: custId,
      pathParameters: { entryId },
    }));
    expect(leaveRes.statusCode).toBe(200);
    expect(JSON.parse(leaveRes.body).data.status).toBe('REMOVED');
  });

  it('returns 404 for a non-existent entryId', async () => {
    const res = await waitlistHandler(makeEvent({
      routeKey: 'DELETE /waitlist/{entryId}',
      pathParameters: { entryId: randomUUID() },
    }));
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when userId does not own the entry', async () => {
    const custId = uid();
    const joinRes = await waitlistHandler(makeEvent({
      routeKey: 'POST /waitlist',
      userId: custId,
      body: { serviceId: seedSvcId },
    }));
    const { entryId } = JSON.parse(joinRes.body).data;

    const res = await waitlistHandler(makeEvent({
      routeKey: 'DELETE /waitlist/{entryId}',
      userId: uid(), // different user
      pathParameters: { entryId },
    }));
    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /businesses/me/waitlist/{serviceId} ──────────────────────────────────

describe('GET /businesses/me/waitlist/{serviceId}', () => {
  it('returns waitlist entries and count for a service owned by the business (200)', async () => {
    const custId = uid();
    await waitlistHandler(makeEvent({ routeKey: 'POST /waitlist', userId: custId, body: { serviceId: seedSvcId } }));

    const res = await waitlistHandler(makeEvent({
      routeKey: 'GET /businesses/me/waitlist/{serviceId}',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { serviceId: seedSvcId },
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.count).toBe('number');
  });

  it('returns 403 when business does not own the service', async () => {
    const otherBiz = uid();
    const res = await waitlistHandler(makeEvent({
      routeKey: 'GET /businesses/me/waitlist/{serviceId}',
      userId: otherBiz,
      role: 'BUSINESS',
      pathParameters: { serviceId: seedSvcId },
    }));
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when role is CUSTOMER', async () => {
    const res = await waitlistHandler(makeEvent({
      routeKey: 'GET /businesses/me/waitlist/{serviceId}',
      role: 'CUSTOMER',
      pathParameters: { serviceId: seedSvcId },
    }));
    expect(res.statusCode).toBe(403);
  });
});

// ─── E2E: decline triggers promotion ─────────────────────────────────────────

describe('E2E: waitlist promotion when appointment is declined', () => {
  it('promotes oldest waitlisted customer when business declines an appointment', async () => {
    const custA = uid(); // will have a PENDING appointment request
    const custB = uid(); // is on the waitlist

    const now = new Date().toISOString();

    // Use a dedicated service so no ACTIVE waitlist entries from earlier tests
    // in this file can be picked up by promoteOldestForService before custB.
    const isolatedSvcId = randomUUID();
    await docClient.send(new PutCommand({
      TableName: SVC_TABLE,
      Item: { serviceId: isolatedSvcId, businessId: seedBizId, name: 'Promo Test Svc', description: '', durationMinutes: 30, price: 1000, status: 'ACTIVE', createdAt: now, updatedAt: now },
    }));

    // Seed customer users (needed for unreadNotificationCount updates)
    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: { userId: custB, email: `${custB}@test.com`, role: 'CUSTOMER', firstName: 'B', lastName: 'Customer', unreadNotificationCount: 0, createdAt: now, updatedAt: now },
    }));

    // Customer B joins the waitlist for the isolated service
    const joinRes = await waitlistHandler(makeEvent({
      routeKey: 'POST /waitlist',
      userId: custB,
      body: { serviceId: isolatedSvcId },
    }));
    expect(joinRes.statusCode).toBe(201);
    const { entryId: waitlistEntryId } = JSON.parse(joinRes.body).data;

    // Seed customer A's PENDING appointment request directly (bypass creation flow to isolate test)
    const requestId = randomUUID();
    await docClient.send(new PutCommand({
      TableName: APT_TABLE,
      Item: {
        requestId,
        customerId: custA,
        businessId: seedBizId,
        serviceId: isolatedSvcId,
        proposedAt: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'PENDING',
        idempotencyKey: randomUUID(),
        createdAt: now,
        updatedAt: now,
      },
    }));

    // Business declines customer A's request — this should trigger promoteOldestForService
    const declineRes = await appointmentHandler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/decline',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));
    expect(declineRes.statusCode).toBe(200);
    expect(JSON.parse(declineRes.body).data.status).toBe('DECLINED');

    // Customer B's waitlist entry must now be PROMOTED
    const entryResult = await docClient.send(new GetCommand({
      TableName: WAITLIST_TABLE,
      Key: { entryId: waitlistEntryId },
    }));
    expect(entryResult.Item?.status).toBe('PROMOTED');
  });
});
