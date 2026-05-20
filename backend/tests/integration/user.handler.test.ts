/**
 * Integration tests for the user Lambda handler (GET /notifications,
 * PATCH /notifications/:id/read, GET /users/me, PATCH /users/me).
 * Requires MiniStack on :4566.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  DynamoDBClient,
  CreateTableCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { handler } from '../../src/handlers/user.handler.js';

const ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:4566';
const REGION = 'us-east-1';
const CREDS = { accessKeyId: 'test', secretAccessKey: 'test' };

const adminDynamo = new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS });
const docClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ endpoint: ENDPOINT, region: REGION, credentials: CREDS }),
);

const USERS_TABLE = process.env.USERS_TABLE ?? 'qulene-local-users';
const NOTIF_TABLE = process.env.NOTIFICATIONS_TABLE ?? 'qulene-local-notifications';

let idCounter = 0;
const uid = () => `users-integ-${Date.now()}-${++idCounter}`;

async function createTableIfNotExists(
  params: ConstructorParameters<typeof CreateTableCommand>[0],
) {
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

async function seedUser(userId: string, role = 'CUSTOMER', unreadCount = 0) {
  await docClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      userId,
      email: `${userId}@test.com`,
      firstName: 'Test',
      lastName: 'User',
      role,
      unreadNotificationCount: unreadCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }));
}

async function seedNotification(notifId: string, userId: string, isRead = false) {
  await docClient.send(new PutCommand({
    TableName: NOTIF_TABLE,
    Item: {
      notificationId: notifId,
      userId,
      type: 'REQUEST_RECEIVED',
      relatedId: randomUUID(),
      message: 'Test notification',
      isRead,
      createdAt: new Date().toISOString(),
    },
  }));
}

beforeAll(async () => {
  await createTableIfNotExists({
    TableName: USERS_TABLE,
    AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
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
});

// ─── GET /notifications ───────────────────────────────────────────────────────

describe('GET /notifications', () => {
  it('returns paginated notifications for authenticated user', async () => {
    const userId = uid();
    const notifId = uid();
    await seedUser(userId);
    await seedNotification(notifId, userId);

    const res = await handler(makeEvent({ routeKey: 'GET /notifications', userId }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty('nextCursor');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await handler(makeEvent({ routeKey: 'GET /notifications', skipAuth: true }));
    expect(res.statusCode).toBe(401);
  });

  it('BUSINESS role can also list notifications', async () => {
    const userId = uid();
    await seedUser(userId, 'BUSINESS');
    const res = await handler(makeEvent({ routeKey: 'GET /notifications', userId, role: 'BUSINESS' }));
    expect(res.statusCode).toBe(200);
  });
});

// ─── PATCH /notifications/{notificationId}/read ───────────────────────────────

describe('PATCH /notifications/{notificationId}/read', () => {
  it('marks notification as read and decrements unread count', async () => {
    const userId = uid();
    const notifId = uid();
    await seedUser(userId, 'CUSTOMER', 3);
    await seedNotification(notifId, userId, false);

    const res = await handler(makeEvent({
      routeKey: 'PATCH /notifications/{notificationId}/read',
      pathParameters: { notificationId: notifId },
      userId,
    }));

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.isRead).toBe(true);

    const userRow = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
    expect(userRow.Item?.['unreadNotificationCount']).toBe(2);
  });

  it('is idempotent — second call does not double-decrement', async () => {
    const userId = uid();
    const notifId = uid();
    await seedUser(userId, 'CUSTOMER', 1);
    await seedNotification(notifId, userId, false);

    await handler(makeEvent({
      routeKey: 'PATCH /notifications/{notificationId}/read',
      pathParameters: { notificationId: notifId },
      userId,
    }));
    const res2 = await handler(makeEvent({
      routeKey: 'PATCH /notifications/{notificationId}/read',
      pathParameters: { notificationId: notifId },
      userId,
    }));
    expect(res2.statusCode).toBe(200);

    const userRow = await docClient.send(new GetCommand({ TableName: USERS_TABLE, Key: { userId } }));
    expect(userRow.Item?.['unreadNotificationCount']).toBe(0);
  });

  it('returns 404 for non-existent notification', async () => {
    const userId = uid();
    await seedUser(userId);
    const res = await handler(makeEvent({
      routeKey: 'PATCH /notifications/{notificationId}/read',
      pathParameters: { notificationId: 'does-not-exist' },
      userId,
    }));
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 when notification belongs to another user', async () => {
    const ownerId = uid();
    const callerId = uid();
    const notifId = uid();
    await seedUser(ownerId);
    await seedUser(callerId);
    await seedNotification(notifId, ownerId, false);

    const res = await handler(makeEvent({
      routeKey: 'PATCH /notifications/{notificationId}/read',
      pathParameters: { notificationId: notifId },
      userId: callerId,
    }));
    expect(res.statusCode).toBe(403);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await handler(makeEvent({
      routeKey: 'PATCH /notifications/{notificationId}/read',
      pathParameters: { notificationId: 'x' },
      skipAuth: true,
    }));
    expect(res.statusCode).toBe(401);
  });
});

// ─── GET /users/me ────────────────────────────────────────────────────────────

describe('GET /users/me', () => {
  it('returns full profile including unreadNotificationCount', async () => {
    const userId = uid();
    await seedUser(userId, 'CUSTOMER', 7);

    const res = await handler(makeEvent({ routeKey: 'GET /users/me', userId }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.userId).toBe(userId);
    expect(body.data.unreadNotificationCount).toBe(7);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await handler(makeEvent({ routeKey: 'GET /users/me', skipAuth: true }));
    expect(res.statusCode).toBe(401);
  });

  it('BUSINESS user can also call GET /users/me', async () => {
    const userId = uid();
    await seedUser(userId, 'BUSINESS');
    const res = await handler(makeEvent({ routeKey: 'GET /users/me', userId, role: 'BUSINESS' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data.role).toBe('BUSINESS');
  });
});

// ─── PATCH /users/me ─────────────────────────────────────────────────────────

describe('PATCH /users/me', () => {
  it('updates firstName and lastName', async () => {
    const userId = uid();
    await seedUser(userId);

    const res = await handler(makeEvent({
      routeKey: 'PATCH /users/me',
      userId,
      body: { firstName: 'New', lastName: 'Name' },
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.firstName).toBe('New');
    expect(body.data.lastName).toBe('Name');
  });

  it('returns 422 when body contains email', async () => {
    const userId = uid();
    await seedUser(userId);
    const res = await handler(makeEvent({
      routeKey: 'PATCH /users/me',
      userId,
      body: { firstName: 'Bob', lastName: 'Jones', email: 'new@example.com' },
    }));
    expect(res.statusCode).toBe(422);
  });

  it('returns 422 when body contains role', async () => {
    const userId = uid();
    await seedUser(userId);
    const res = await handler(makeEvent({
      routeKey: 'PATCH /users/me',
      userId,
      body: { firstName: 'Bob', lastName: 'Jones', role: 'BUSINESS' },
    }));
    expect(res.statusCode).toBe(422);
  });

  it('returns 400 for empty firstName', async () => {
    const userId = uid();
    await seedUser(userId);
    const res = await handler(makeEvent({
      routeKey: 'PATCH /users/me',
      userId,
      body: { firstName: '', lastName: 'Jones' },
    }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await handler(makeEvent({
      routeKey: 'PATCH /users/me',
      skipAuth: true,
      body: { firstName: 'Bob', lastName: 'Jones' },
    }));
    expect(res.statusCode).toBe(401);
  });
});
