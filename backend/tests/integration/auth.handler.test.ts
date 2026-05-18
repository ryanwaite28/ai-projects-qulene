/**
 * Integration test for POST /auth/profile — requires MiniStack on :4566.
 * Run: docker-compose up -d  (starts MiniStack)
 * Then: npm test (from backend/)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../../src/handlers/auth.handler.js';

const TABLE_NAME = process.env.USERS_TABLE_NAME ?? 'qulene-local-users';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:4566';

const adminClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

function makeEvent(overrides: {
  sub?: string;
  role?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  body?: Record<string, unknown>;
  claims?: Record<string, string>;
}): APIGatewayProxyEventV2 {
  const claims: Record<string, string> = overrides.claims ?? {
    sub: overrides.sub ?? `test-user-${Date.now()}`,
    'custom:role': overrides.role ?? 'CUSTOMER',
    email: overrides.email ?? 'test@example.com',
  };
  return {
    version: '2.0',
    routeKey: 'POST /auth/profile',
    rawPath: '/auth/profile',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'POST',
        path: '/auth/profile',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
      requestId: 'test-request-id',
      routeKey: 'POST /auth/profile',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JWT authorizer shape injected at runtime; not typed by aws-lambda
      authorizer: { jwt: { claims, scopes: [] } } as any,
    },
    body: JSON.stringify(
      overrides.body ?? {
        firstName: overrides.firstName ?? 'Test',
        lastName: overrides.lastName ?? 'User',
      },
    ),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

beforeAll(async () => {
  try {
    await adminClient.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'userId', AttributeType: 'S' },
          { AttributeName: 'email', AttributeType: 'S' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'email-index',
            KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  } catch (e) {
    if (!(e instanceof ResourceInUseException)) throw e;
    // table already exists from a prior run — continue
  }
});

afterAll(async () => {
  await adminClient.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
});

describe('POST /auth/profile integration', () => {
  it('creates a user record and returns it (happy path)', async () => {
    const userId = `int-test-${Date.now()}`;
    const event = makeEvent({ sub: userId, role: 'CUSTOMER', email: 'newuser@example.com' });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.userId).toBe(userId);
    expect(body.data.email).toBe('newuser@example.com');
    expect(body.data.role).toBe('CUSTOMER');
    expect(body.data.unreadNotificationCount).toBe(0);
    expect(body.data.createdAt).toBeTruthy();
  });

  it('returns the same record on second call — no duplicate write', async () => {
    const userId = `int-idem-${Date.now()}`;
    const event = makeEvent({ sub: userId });

    const first = await handler(event);
    const second = await handler(event);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const firstBody = JSON.parse(first.body).data;
    const secondBody = JSON.parse(second.body).data;
    expect(secondBody.createdAt).toBe(firstBody.createdAt);
    expect(secondBody.updatedAt).toBe(firstBody.updatedAt);
  });

  it('works with BUSINESS role', async () => {
    const userId = `int-biz-${Date.now()}`;
    const event = makeEvent({ sub: userId, role: 'BUSINESS' });

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.role).toBe('BUSINESS');
  });

  it('returns 401 when userId (sub) claim is missing', async () => {
    const event = makeEvent({ claims: { 'custom:role': 'CUSTOMER', email: 'x@x.com' } });

    const response = await handler(event);

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body).error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 when custom:role claim is missing', async () => {
    const event = makeEvent({ claims: { sub: 'some-id', email: 'x@x.com' } });

    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error.code).toBe('UNPROCESSABLE');
  });

  it('returns 422 when role is not BUSINESS or CUSTOMER', async () => {
    const event = makeEvent({ claims: { sub: 'some-id', 'custom:role': 'ADMIN', email: 'x@x.com' } });

    const response = await handler(event);

    expect(response.statusCode).toBe(422);
    expect(JSON.parse(response.body).error.code).toBe('UNPROCESSABLE');
  });

  it('returns 400 when firstName is missing', async () => {
    const event = makeEvent({ sub: `id-${Date.now()}`, body: { lastName: 'User' } });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when lastName exceeds 50 chars', async () => {
    const event = makeEvent({
      sub: `id-${Date.now()}`,
      body: { firstName: 'Test', lastName: 'A'.repeat(51) },
    });

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });
});
