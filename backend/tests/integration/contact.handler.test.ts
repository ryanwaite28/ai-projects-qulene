/**
 * Integration tests for the contact Lambda handler (POST /web/contact, POST /web/signup).
 * Requires MiniStack on :4566. SES calls are verified by checking the SES MiniStack endpoint
 * does not throw; contact form success is asserted by status code only (no email inbox read).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  DynamoDBClient,
  CreateTableCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handler } from '../../src/handlers/contact.handler.js';

const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:4566';
const REGION = 'us-east-1';
const CREDS = { accessKeyId: 'test', secretAccessKey: 'test' };

const adminDynamo = new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS });
const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS }),
);

const WEB_SIGNUPS_TABLE = process.env.WEB_SIGNUPS_TABLE ?? 'qulene-local-web-signups';

async function createTableIfNotExists(
  params: ConstructorParameters<typeof CreateTableCommand>[0],
) {
  try {
    await adminDynamo.send(new CreateTableCommand(params));
  } catch (e) {
    if (!(e instanceof ResourceInUseException)) throw e;
  }
}

function makeEvent(routeKey: string, body: Record<string, unknown>): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey,
    rawPath: '/',
    rawQueryString: '',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    requestContext: {
      accountId: '000000000000',
      apiId: 'test',
      domainName: 'localhost',
      domainPrefix: '',
      http: { method: 'POST', path: '/', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
      requestId: 'test-req',
      routeKey,
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2;
}

beforeAll(async () => {
  await createTableIfNotExists({
    TableName: WEB_SIGNUPS_TABLE,
    AttributeDefinitions: [{ AttributeName: 'email', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  });
});

// ─── POST /web/contact ────────────────────────────────────────────────────────

describe('POST /web/contact', () => {
  it('returns 200 when all fields are valid', async () => {
    const res = await handler(makeEvent('POST /web/contact', {
      name: 'Alice',
      email: 'alice@example.com',
      message: 'Hello from the contact form!',
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.ok).toBe(true);
  });

  it('returns 400 when name is missing', async () => {
    const res = await handler(makeEvent('POST /web/contact', {
      email: 'alice@example.com',
      message: 'Hi',
    }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when email has no @', async () => {
    const res = await handler(makeEvent('POST /web/contact', {
      name: 'Alice',
      email: 'notanemail',
      message: 'Hi',
    }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when message is missing', async () => {
    const res = await handler(makeEvent('POST /web/contact', {
      name: 'Alice',
      email: 'alice@example.com',
    }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when name exceeds 100 chars', async () => {
    const res = await handler(makeEvent('POST /web/contact', {
      name: 'A'.repeat(101),
      email: 'alice@example.com',
      message: 'Hi',
    }));
    expect(res.statusCode).toBe(400);
  });
});

// ─── POST /web/signup ─────────────────────────────────────────────────────────

describe('POST /web/signup', () => {
  it('returns 200 and writes email to DynamoDB', async () => {
    const email = `signup-${Date.now()}@test.com`;
    const res = await handler(makeEvent('POST /web/signup', { email }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.email).toBe(email);

    const row = await docClient.send(
      new GetCommand({ TableName: WEB_SIGNUPS_TABLE, Key: { email } }),
    );
    expect(row.Item?.['email']).toBe(email);
    expect(row.Item?.['createdAt']).toBeDefined();
  });

  it('is idempotent — re-submitting same email returns 200', async () => {
    const email = `idempotent-${Date.now()}@test.com`;
    await handler(makeEvent('POST /web/signup', { email }));
    const res2 = await handler(makeEvent('POST /web/signup', { email }));
    expect(res2.statusCode).toBe(200);
  });

  it('returns 400 when email is missing', async () => {
    const res = await handler(makeEvent('POST /web/signup', {}));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when email has no @', async () => {
    const res = await handler(makeEvent('POST /web/signup', { email: 'notanemail' }));
    expect(res.statusCode).toBe(400);
  });
});
