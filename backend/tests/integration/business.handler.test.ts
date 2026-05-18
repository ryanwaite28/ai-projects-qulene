/**
 * Integration tests for the businesses Lambda handler — requires MiniStack on :4566.
 * Run: docker-compose up -d  then: npm test (from backend/)
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../../src/handlers/business.handler.js';
import * as s3ClientModule from '../../src/clients/s3.client.js';

const TABLE_NAME = process.env.BUSINESS_PROFILES_TABLE ?? 'qulene-local-business-profiles';
const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:4566';

const adminClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

// S3 presigned URL is not exercised end-to-end in integration tests — mock the helper only
vi.spyOn(s3ClientModule, 'generatePresignedPutUrl').mockResolvedValue('https://mock-s3/presigned');

let bizCounter = 0;
function makeBizId() {
  bizCounter++;
  return `integ-biz-${Date.now()}-${bizCounter}`;
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
    rawPath: '/businesses',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    pathParameters: overrides.pathParameters,
    queryStringParameters: overrides.queryStringParameters,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      domainName: 'test.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'test',
      http: {
        method: 'GET',
        path: '/businesses',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'test',
      },
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

beforeAll(async () => {
  try {
    await adminClient.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        KeySchema: [{ AttributeName: 'businessId', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'businessId', AttributeType: 'S' },
          { AttributeName: 'category', AttributeType: 'S' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'category-index',
            KeySchema: [
              { AttributeName: 'category', KeyType: 'HASH' },
              { AttributeName: 'businessId', KeyType: 'RANGE' },
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
  process.env.BUSINESS_PROFILES_TABLE = TABLE_NAME;
});

afterAll(async () => {
  await adminClient.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
});

// ─── GET /businesses ──────────────────────────────────────────────────────────

describe('GET /businesses', () => {
  it('returns empty list when no active businesses exist', async () => {
    const event = makeEvent({ routeKey: 'GET /businesses', skipAuth: true });
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toBeInstanceOf(Array);
    expect(body).toHaveProperty('nextCursor');
  });

  it('returns active businesses in the list', async () => {
    const userId = makeBizId();
    // Create a business profile via PATCH /businesses/me
    await handler(makeEvent({
      routeKey: 'PATCH /businesses/me',
      userId,
      role: 'BUSINESS',
      body: { businessName: 'Integration Salon', category: 'SALON' },
    }));

    const event = makeEvent({ routeKey: 'GET /businesses', skipAuth: true });
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const names = body.data.map((b: { businessName: string }) => b.businessName);
    expect(names).toContain('Integration Salon');
  });
});

// ─── GET /businesses/{businessId} ────────────────────────────────────────────

describe('GET /businesses/{businessId}', () => {
  it('returns 404 for a non-existent businessId', async () => {
    const event = makeEvent({
      routeKey: 'GET /businesses/{businessId}',
      pathParameters: { businessId: 'does-not-exist-xyz' },
      skipAuth: true,
    });
    const response = await handler(event);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body).error.code).toBe('NOT_FOUND');
  });

  it('returns the profile for an existing businessId', async () => {
    const userId = makeBizId();
    await handler(makeEvent({
      routeKey: 'PATCH /businesses/me',
      userId,
      role: 'BUSINESS',
      body: { businessName: 'Visible Business' },
    }));

    const event = makeEvent({
      routeKey: 'GET /businesses/{businessId}',
      pathParameters: { businessId: userId },
      skipAuth: true,
    });
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).data.businessName).toBe('Visible Business');
  });
});

// ─── PATCH /businesses/me ─────────────────────────────────────────────────────

describe('PATCH /businesses/me', () => {
  it('returns 403 when called by a CUSTOMER', async () => {
    const event = makeEvent({
      routeKey: 'PATCH /businesses/me',
      role: 'CUSTOMER',
      body: { businessName: 'Unauthorized' },
    });
    const response = await handler(event);
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body).error.code).toBe('FORBIDDEN');
  });

  it('creates a profile for a BUSINESS user (first call)', async () => {
    const userId = makeBizId();
    const event = makeEvent({
      routeKey: 'PATCH /businesses/me',
      userId,
      role: 'BUSINESS',
      body: { businessName: 'New Business', category: 'BARBERSHOP' },
    });
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const profile = JSON.parse(response.body).data;
    expect(profile.businessId).toBe(userId);
    expect(profile.businessName).toBe('New Business');
    expect(profile.isActive).toBe(true);
  });

  it('merges updates into an existing profile', async () => {
    const userId = makeBizId();
    await handler(makeEvent({
      routeKey: 'PATCH /businesses/me',
      userId,
      role: 'BUSINESS',
      body: { businessName: 'Merge Test', city: 'Dallas' },
    }));

    const response = await handler(makeEvent({
      routeKey: 'PATCH /businesses/me',
      userId,
      role: 'BUSINESS',
      body: { description: 'A great place' },
    }));

    const profile = JSON.parse(response.body).data;
    expect(profile.businessName).toBe('Merge Test');
    expect(profile.city).toBe('Dallas');
    expect(profile.description).toBe('A great place');
  });
});

// ─── POST /businesses/me/avatar ───────────────────────────────────────────────

describe('POST /businesses/me/avatar', () => {
  it('returns 403 when called by a CUSTOMER', async () => {
    const event = makeEvent({
      routeKey: 'POST /businesses/me/avatar',
      role: 'CUSTOMER',
      body: { contentType: 'image/jpeg' },
    });
    const response = await handler(event);
    expect(response.statusCode).toBe(403);
  });

  it('returns 400 for an unsupported content type', async () => {
    const event = makeEvent({
      routeKey: 'POST /businesses/me/avatar',
      role: 'BUSINESS',
      body: { contentType: 'image/gif' },
    });
    const response = await handler(event);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).error.code).toBe('VALIDATION_ERROR');
  });

  it('returns presigned uploadUrl + avatarUrl for a valid request', async () => {
    const event = makeEvent({
      routeKey: 'POST /businesses/me/avatar',
      role: 'BUSINESS',
      body: { contentType: 'image/jpeg' },
    });
    const response = await handler(event);
    expect(response.statusCode).toBe(200);
    const { data } = JSON.parse(response.body);
    expect(data.uploadUrl).toBeTruthy();
    expect(data.avatarUrl).toContain('avatar.jpg');
  });
});
