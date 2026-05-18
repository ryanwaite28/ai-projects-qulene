/**
 * Integration tests for the appointments Lambda handler — requires MiniStack on :4566.
 * Run: docker-compose up -d  then: npm test (from backend/)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  DynamoDBClient,
  CreateTableCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, CreateTopicCommand } from '@aws-sdk/client-sns';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { handler } from '../../src/handlers/appointment.handler.js';

const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:4566';
const SNS_ENDPOINT = process.env.SNS_ENDPOINT ?? 'http://localhost:4566';
const REGION = 'us-east-1';
const CREDS = { accessKeyId: 'test', secretAccessKey: 'test' };

const adminDynamo = new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS });
const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS }),
);
const sns = new SNSClient({ endpoint: SNS_ENDPOINT, region: REGION, credentials: CREDS });

const APT_TABLE = process.env.APPOINTMENT_REQUESTS_TABLE ?? 'qulene-local-appointment-requests';
const NOTIF_TABLE = process.env.NOTIFICATIONS_TABLE ?? 'qulene-local-notifications';
const USERS_TABLE = process.env.USERS_TABLE ?? 'qulene-local-users';
const SVC_TABLE = process.env.SERVICES_TABLE ?? 'qulene-local-services';
const _SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN ?? 'arn:aws:sns:us-east-1:000000000000:qulene-local-events';

let idCounter = 0;
const uid = () => `integ-apt-${Date.now()}-${++idCounter}`;

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
  // Ensure SNS topic exists (idempotent)
  await sns.send(new CreateTopicCommand({ Name: 'qulene-local-events' })).catch(() => undefined);

  // Create appointment-requests table with all GSIs
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

describe('POST /appointments', () => {
  it('creates a PENDING appointment request (201)', async () => {
    const custId = uid();
    const event = makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.status).toBe('PENDING');
    expect(body.data.customerId).toBe(custId);
  });

  it('returns same request on idempotency replay (201)', async () => {
    const custId = uid();
    const idemKey = randomUUID();
    const body = { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: idemKey };
    const event1 = makeEvent({ routeKey: 'POST /appointments', userId: custId, body });
    const event2 = makeEvent({ routeKey: 'POST /appointments', userId: custId, body });
    const res1 = await handler(event1);
    const res2 = await handler(event2);
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);
    expect(JSON.parse(res1.body).data.requestId).toBe(JSON.parse(res2.body).data.requestId);
  });

  it('rejects past proposedAt (422)', async () => {
    const event = makeEvent({
      routeKey: 'POST /appointments',
      body: { serviceId: seedSvcId, proposedAt: '2020-01-01T00:00:00.000Z', idempotencyKey: randomUUID() },
    });
    const res = await handler(event);
    expect(res.statusCode).toBe(422);
  });

  it('rejects duplicate active request for same service (409)', async () => {
    const custId = uid();
    const body = { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() };
    await handler(makeEvent({ routeKey: 'POST /appointments', userId: custId, body }));

    const res2 = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 172_800_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    expect(res2.statusCode).toBe(409);
  });

  it('rejects BUSINESS role (403)', async () => {
    const res = await handler(makeEvent({
      routeKey: 'POST /appointments',
      role: 'BUSINESS',
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    expect(res.statusCode).toBe(403);
  });

  it('rejects missing idempotencyKey (400)', async () => {
    const res = await handler(makeEvent({
      routeKey: 'POST /appointments',
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString() },
    }));
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /appointments/me', () => {
  it('returns own appointments (200)', async () => {
    const custId = uid();
    await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));

    const res = await handler(makeEvent({ routeKey: 'GET /appointments/me', userId: custId }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].customerId).toBe(custId);
  });

  it('rejects BUSINESS role (403)', async () => {
    const res = await handler(makeEvent({ routeKey: 'GET /appointments/me', role: 'BUSINESS' }));
    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /appointments/{requestId}', () => {
  it('cancels a PENDING request (200)', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;

    const res = await handler(makeEvent({
      routeKey: 'DELETE /appointments/{requestId}',
      userId: custId,
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe('CANCELLED');
  });

  it('returns 403 when a different customer tries to cancel (403)', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;

    const res = await handler(makeEvent({
      routeKey: 'DELETE /appointments/{requestId}',
      userId: uid(),
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(403);
  });

  it('returns 422 when cancelling an already-cancelled request (422)', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;

    await handler(makeEvent({ routeKey: 'DELETE /appointments/{requestId}', userId: custId, pathParameters: { requestId } }));
    const res = await handler(makeEvent({ routeKey: 'DELETE /appointments/{requestId}', userId: custId, pathParameters: { requestId } }));
    expect(res.statusCode).toBe(422);
  });

  it('returns 404 for a non-existent requestId (404)', async () => {
    const res = await handler(makeEvent({
      routeKey: 'DELETE /appointments/{requestId}',
      pathParameters: { requestId: randomUUID() },
    }));
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /businesses/me/appointments/{requestId}/accept', () => {
  it('accepts a PENDING request (200)', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;

    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/accept',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe('ACCEPTED');
  });

  it('returns 403 when a CUSTOMER calls accept', async () => {
    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/accept',
      role: 'CUSTOMER',
      pathParameters: { requestId: randomUUID() },
    }));
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when a different business tries to accept', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;

    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/accept',
      userId: uid(),
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(403);
  });

  it('returns 422 when request is already CANCELLED', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;
    await handler(makeEvent({ routeKey: 'DELETE /appointments/{requestId}', userId: custId, pathParameters: { requestId } }));

    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/accept',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(422);
  });
});

describe('PATCH /businesses/me/appointments/{requestId}/decline', () => {
  it('declines a PENDING request (200)', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;

    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/decline',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.status).toBe('DECLINED');
  });

  it('returns 403 when a CUSTOMER calls decline', async () => {
    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/decline',
      role: 'CUSTOMER',
      pathParameters: { requestId: randomUUID() },
    }));
    expect(res.statusCode).toBe(403);
  });

  it('returns 422 when declining a non-PENDING request', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;
    await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/accept',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));

    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/decline',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(422);
  });
});

describe('PATCH /businesses/me/appointments/{requestId}/complete', () => {
  it('returns 422 when proposedAt is in the future (appointment not yet passed)', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;
    await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/accept',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));

    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/complete',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(422);
  });

  it('returns 422 when status is PENDING (not ACCEPTED)', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;

    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/complete',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(422);
  });

  it('returns 403 when a CUSTOMER calls complete', async () => {
    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/complete',
      role: 'CUSTOMER',
      pathParameters: { requestId: randomUUID() },
    }));
    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /businesses/me/appointments/{requestId}/noshow', () => {
  it('returns 422 when proposedAt is in the future', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;
    await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/accept',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));

    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/noshow',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));
    expect(res.statusCode).toBe(422);
  });

  it('returns 403 when a CUSTOMER calls noshow', async () => {
    const res = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/noshow',
      role: 'CUSTOMER',
      pathParameters: { requestId: randomUUID() },
    }));
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /businesses/me/appointments', () => {
  it('returns business requests sorted by proposedAt asc (200)', async () => {
    const custId = uid();
    const later = new Date(Date.now() + 172_800_000).toISOString();
    const sooner = new Date(Date.now() + 86_400_000).toISOString();

    await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: later, idempotencyKey: randomUUID() },
    }));
    const cust2 = uid();
    await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: cust2,
      body: { serviceId: seedSvcId, proposedAt: sooner, idempotencyKey: randomUUID() },
    }));

    const res = await handler(makeEvent({
      routeKey: 'GET /businesses/me/appointments',
      userId: seedBizId,
      role: 'BUSINESS',
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    const reqs = body.data as Array<{ proposedAt: string }>;
    for (let i = 1; i < reqs.length; i++) {
      expect(reqs[i].proposedAt >= reqs[i - 1].proposedAt).toBe(true);
    }
  });

  it('filters by status when provided', async () => {
    const custId = uid();
    const createRes = await handler(makeEvent({
      routeKey: 'POST /appointments',
      userId: custId,
      body: { serviceId: seedSvcId, proposedAt: new Date(Date.now() + 86_400_000).toISOString(), idempotencyKey: randomUUID() },
    }));
    const requestId = JSON.parse(createRes.body).data.requestId;
    await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/appointments/{requestId}/decline',
      userId: seedBizId,
      role: 'BUSINESS',
      pathParameters: { requestId },
    }));

    const res = await handler(makeEvent({
      routeKey: 'GET /businesses/me/appointments',
      userId: seedBizId,
      role: 'BUSINESS',
      queryStringParameters: { status: 'DECLINED' },
    }));
    expect(res.statusCode).toBe(200);
    const items = JSON.parse(res.body).data as Array<{ status: string }>;
    expect(items.every((i) => i.status === 'DECLINED')).toBe(true);
  });

  it('returns 403 when a CUSTOMER calls the business list route', async () => {
    const res = await handler(makeEvent({
      routeKey: 'GET /businesses/me/appointments',
      role: 'CUSTOMER',
    }));
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 for an invalid status filter', async () => {
    const res = await handler(makeEvent({
      routeKey: 'GET /businesses/me/appointments',
      userId: seedBizId,
      role: 'BUSINESS',
      queryStringParameters: { status: 'INVALID_STATUS' },
    }));
    expect(res.statusCode).toBe(400);
  });
});
