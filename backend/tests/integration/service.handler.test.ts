/**
 * Integration tests for the services Lambda handler — requires MiniStack on :4566.
 * Run: docker-compose up -d  then: npm test (from backend/)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../../src/handlers/service.handler.js';

const TABLE_NAME = process.env.SERVICES_TABLE ?? 'qulene-local-services';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:4566';

const adminClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

let idCounter = 0;
function makeBizId() {
  idCounter++;
  return `integ-svc-biz-${Date.now()}-${idCounter}`;
}
function makeSvcId() {
  idCounter++;
  return `integ-svc-${Date.now()}-${idCounter}`;
}

function makeEvent(overrides: {
  routeKey: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: Record<string, unknown>;
  role?: string;
  userId?: string;
  skipAuth?: boolean;
}): APIGatewayProxyEventV2 {
  const userId = overrides.userId ?? makeBizId();
  const claims: Record<string, string> = overrides.skipAuth
    ? {}
    : {
        sub: userId,
        'custom:role': overrides.role ?? 'BUSINESS',
        email: `${userId}@example.com`,
      };

  return {
    version: '2.0',
    routeKey: overrides.routeKey,
    rawPath: '/services',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    pathParameters: overrides.pathParameters,
    queryStringParameters: overrides.queryStringParameters,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: { method: 'GET', path: '/', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: 'test-request-id',
      routeKey: overrides.routeKey,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JWT authorizer shape; not typed by aws-lambda
      authorizer: overrides.skipAuth ? undefined : ({ jwt: { claims, scopes: [] } } as any),
    },
    body: overrides.body ? JSON.stringify(overrides.body) : undefined,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function makeServiceBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Service',
    description: 'A test service description',
    durationMinutes: 60,
    price: 5000,
    status: 'ACTIVE',
    ...overrides,
  };
}

beforeAll(async () => {
  try {
    await adminClient.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [{ AttributeName: 'serviceId', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'serviceId', AttributeType: 'S' },
          { AttributeName: 'businessId', AttributeType: 'S' },
          { AttributeName: 'createdAt', AttributeType: 'S' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'businessId-index',
            KeySchema: [
              { AttributeName: 'businessId', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  } catch (e) {
    if (!(e instanceof ResourceInUseException)) throw e;
  }
  process.env.SERVICES_TABLE = TABLE_NAME;
});

afterAll(async () => {
  await adminClient.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
});

// ─── GET /businesses/{businessId}/services ────────────────────────────────────

describe('GET /businesses/{businessId}/services', () => {
  it('returns empty list when business has no services', async () => {
    const event = makeEvent({
      routeKey: 'GET /businesses/{businessId}/services',
      pathParameters: { businessId: makeBizId() },
      skipAuth: true,
    });
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual([]);
    expect(body).toHaveProperty('nextCursor');
  });

  it('returns services created by the business', async () => {
    const bizId = makeBizId();
    await handler(makeEvent({
      routeKey: 'POST /businesses/me/services',
      userId: bizId,
      role: 'BUSINESS',
      body: makeServiceBody({ name: 'Listed Service' }),
    }));

    const response = await handler(makeEvent({
      routeKey: 'GET /businesses/{businessId}/services',
      pathParameters: { businessId: bizId },
      skipAuth: true,
    }));

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Listed Service');
  });
});

// ─── POST /businesses/me/services ────────────────────────────────────────────

describe('POST /businesses/me/services', () => {
  it('returns 403 when called by a CUSTOMER', async () => {
    const response = await handler(makeEvent({
      routeKey: 'POST /businesses/me/services',
      role: 'CUSTOMER',
      body: makeServiceBody(),
    }));
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error.code).toBe('FORBIDDEN');
  });

  it('returns 400 for invalid durationMinutes', async () => {
    const response = await handler(makeEvent({
      routeKey: 'POST /businesses/me/services',
      role: 'BUSINESS',
      body: makeServiceBody({ durationMinutes: 5 }),
    }));
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a service for a BUSINESS user', async () => {
    const bizId = makeBizId();
    const response = await handler(makeEvent({
      routeKey: 'POST /businesses/me/services',
      userId: bizId,
      role: 'BUSINESS',
      body: makeServiceBody({ name: 'Created Service', price: 7500 }),
    }));

    expect(response.statusCode).toBe(201);
    const { data } = JSON.parse(response.body);
    expect(data.serviceId).toBeTruthy();
    expect(data.businessId).toBe(bizId);
    expect(data.name).toBe('Created Service');
    expect(data.price).toBe(7500);
  });
});

// ─── PATCH /businesses/me/services/{serviceId} ────────────────────────────────

describe('PATCH /businesses/me/services/{serviceId}', () => {
  it('returns 403 for a CUSTOMER', async () => {
    const response = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/services/{serviceId}',
      pathParameters: { serviceId: makeSvcId() },
      role: 'CUSTOMER',
      body: { name: 'Attempt' },
    }));
    expect(response.statusCode).toBe(403);
  });

  it('returns 404 for a non-existent serviceId', async () => {
    const response = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/services/{serviceId}',
      pathParameters: { serviceId: 'nonexistent-svc' },
      role: 'BUSINESS',
      body: { name: 'Ghost' },
    }));
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when another business attempts to update the service (ownership)', async () => {
    const ownerBizId = makeBizId();
    const createResp = await handler(makeEvent({
      routeKey: 'POST /businesses/me/services',
      userId: ownerBizId,
      role: 'BUSINESS',
      body: makeServiceBody(),
    }));
    const { data: created } = JSON.parse(createResp.body);

    const response = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/services/{serviceId}',
      pathParameters: { serviceId: created.serviceId },
      userId: makeBizId(),
      role: 'BUSINESS',
      body: { name: 'Stolen Update' },
    }));
    expect(response.statusCode).toBe(403);
  });

  it('updates a service when owner calls it', async () => {
    const bizId = makeBizId();
    const createResp = await handler(makeEvent({
      routeKey: 'POST /businesses/me/services',
      userId: bizId,
      role: 'BUSINESS',
      body: makeServiceBody({ name: 'Before Update' }),
    }));
    const { data: created } = JSON.parse(createResp.body);

    const response = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me/services/{serviceId}',
      pathParameters: { serviceId: created.serviceId },
      userId: bizId,
      role: 'BUSINESS',
      body: { name: 'After Update', price: 9999 },
    }));
    expect(response.statusCode).toBe(200);
    const { data } = JSON.parse(response.body);
    expect(data.name).toBe('After Update');
    expect(data.price).toBe(9999);
  });
});

// ─── DELETE /businesses/me/services/{serviceId} ───────────────────────────────

describe('DELETE /businesses/me/services/{serviceId}', () => {
  it('returns 403 for a CUSTOMER', async () => {
    const response = await handler(makeEvent({
      routeKey: 'DELETE /businesses/me/services/{serviceId}',
      pathParameters: { serviceId: makeSvcId() },
      role: 'CUSTOMER',
    }));
    expect(response.statusCode).toBe(403);
  });

  it('soft-deletes a service and excludes it from the listing', async () => {
    const bizId = makeBizId();
    const createResp = await handler(makeEvent({
      routeKey: 'POST /businesses/me/services',
      userId: bizId,
      role: 'BUSINESS',
      body: makeServiceBody({ name: 'To Be Deleted' }),
    }));
    const { data: created } = JSON.parse(createResp.body);

    const deleteResp = await handler(makeEvent({
      routeKey: 'DELETE /businesses/me/services/{serviceId}',
      pathParameters: { serviceId: created.serviceId },
      userId: bizId,
      role: 'BUSINESS',
    }));
    expect(deleteResp.statusCode).toBe(200);
    expect(JSON.parse(deleteResp.body).data.status).toBe('DELETED');

    // Verify it no longer appears in the list
    const listResp = await handler(makeEvent({
      routeKey: 'GET /businesses/{businessId}/services',
      pathParameters: { businessId: bizId },
      skipAuth: true,
    }));
    const names = JSON.parse(listResp.body).data.map((s: { name: string }) => s.name);
    expect(names).not.toContain('To Be Deleted');
  });
});
