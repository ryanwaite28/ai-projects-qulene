import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createDynamoClient } from '../db/dynamo.client.js';
import { extractClaims, type ParsedClaims } from '../middleware/auth.middleware.js';
import type { UserRole } from '../types/index.js';
import {
  listForUser,
  markAsRead,
  NotificationNotFoundError,
  NotificationForbiddenError,
} from '../services/notification.service.js';
import {
  getMyProfile,
  updateMyName,
  UserNotFoundError,
  UserValidationError,
} from '../services/user.service.js';

let _dynamo: DynamoDBDocumentClient | undefined;
const getDynamo = (): DynamoDBDocumentClient => (_dynamo ??= createDynamoClient());

const VALID_ROLES = new Set<string>(['BUSINESS', 'CUSTOMER']);

const err = (statusCode: number, code: string, message: string) => ({
  statusCode,
  body: JSON.stringify({ error: { code, message } }),
});

const ok = (statusCode: number, body: unknown) => ({
  statusCode,
  body: JSON.stringify(body),
});

function resolveAuthenticatedClaims(
  event: APIGatewayProxyEventV2,
): ParsedClaims | { statusCode: number; body: string } {
  const raw = extractClaims(event);
  if (!raw.userId) return err(401, 'UNAUTHORIZED', 'Missing userId claim');
  if (!raw.role || !VALID_ROLES.has(raw.role)) return err(422, 'UNPROCESSABLE', 'Invalid role claim');
  return { userId: raw.userId, role: raw.role as UserRole, email: raw.email ?? '' };
}

function isErrorResponse(v: unknown): v is { statusCode: number; body: string } {
  return typeof v === 'object' && v !== null && 'statusCode' in v && 'body' in v;
}

// GET /notifications
async function handleListNotifications(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const cursor = event.queryStringParameters?.['cursor'];
  const result = await listForUser(getDynamo(), {
    userId: claimsOrErr.userId,
    ...(cursor !== undefined ? { cursor } : {}),
  });
  return ok(200, { data: result.items, nextCursor: result.nextCursor });
}

// PATCH /notifications/{notificationId}/read
async function handleMarkRead(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const notificationId = event.pathParameters?.['notificationId'];
  if (!notificationId) return err(400, 'VALIDATION_ERROR', 'notificationId is required');
  try {
    const notification = await markAsRead(getDynamo(), { userId: claimsOrErr.userId, notificationId });
    return ok(200, { data: notification });
  } catch (e) {
    if (e instanceof NotificationNotFoundError) return err(404, e.code, e.message);
    if (e instanceof NotificationForbiddenError) return err(403, e.code, e.message);
    throw e;
  }
}

// GET /users/me
async function handleGetProfile(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  try {
    const user = await getMyProfile(getDynamo(), claimsOrErr.userId);
    return ok(200, { data: user });
  } catch (e) {
    if (e instanceof UserNotFoundError) return err(404, e.code, e.message);
    throw e;
  }
}

// PATCH /users/me
async function handleUpdateProfile(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  if ('email' in body || 'role' in body) {
    return err(422, 'UNPROCESSABLE', 'email and role are not updatable');
  }
  const firstName = body['firstName'];
  const lastName = body['lastName'];
  if (typeof firstName !== 'string' || typeof lastName !== 'string') {
    return err(400, 'VALIDATION_ERROR', 'firstName and lastName are required strings');
  }
  try {
    const user = await updateMyName(getDynamo(), { userId: claimsOrErr.userId, firstName, lastName });
    return ok(200, { data: user });
  } catch (e) {
    if (e instanceof UserValidationError) return err(400, e.code, e.message);
    if (e instanceof UserNotFoundError) return err(404, e.code, e.message);
    throw e;
  }
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  const { routeKey } = event;
  try {
    if (routeKey === 'GET /notifications') return await handleListNotifications(event);
    if (routeKey === 'PATCH /notifications/{notificationId}/read') return await handleMarkRead(event);
    if (routeKey === 'GET /users/me') return await handleGetProfile(event);
    if (routeKey === 'PATCH /users/me') return await handleUpdateProfile(event);
    return err(404, 'NOT_FOUND', `Route not found: ${routeKey}`);
  } catch {
    return err(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
};
