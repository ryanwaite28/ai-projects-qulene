import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createDynamoClient } from '../db/dynamo.client.js';
import { extractClaims, requireRole, type ParsedClaims } from '../middleware/auth.middleware.js';
import type { UserRole } from '../types/index.js';
import {
  joinWaitlist,
  leaveWaitlist,
  listCustomerEntries,
  listBusinessWaitlist,
  WaitlistNotFoundError,
  WaitlistConflictError,
  WaitlistUnprocessableError,
  WaitlistForbiddenError,
} from '../services/waitlist.service.js';

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

function handleWaitlistError(e: unknown) {
  if (e instanceof WaitlistNotFoundError) return err(404, e.code, e.message);
  if (e instanceof WaitlistConflictError) return err(409, e.code, e.message);
  if (e instanceof WaitlistUnprocessableError) return err(422, e.code, e.message);
  if (e instanceof WaitlistForbiddenError) return err(403, e.code, e.message);
  throw e;
}

// POST /waitlist — CUSTOMER only
async function handleJoin(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'CUSTOMER');
  if (roleErr) return roleErr;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return err(400, 'VALIDATION_ERROR', 'Invalid JSON body');
  }

  const { serviceId } = body;
  if (typeof serviceId !== 'string' || !serviceId.trim()) {
    return err(400, 'VALIDATION_ERROR', 'serviceId is required');
  }

  try {
    const entry = await joinWaitlist(getDynamo(), {
      customerId: claimsOrErr.userId,
      serviceId: serviceId.trim(),
    });
    return ok(201, { data: entry });
  } catch (e) {
    return handleWaitlistError(e);
  }
}

// GET /waitlist/me — CUSTOMER only
async function handleListMine(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'CUSTOMER');
  if (roleErr) return roleErr;

  const cursor = event.queryStringParameters?.['cursor'] || undefined;
  const result = await listCustomerEntries(getDynamo(), {
    customerId: claimsOrErr.userId,
    ...(cursor !== undefined ? { cursor } : {}),
  });
  return ok(200, { data: result.items, nextCursor: result.nextCursor });
}

// DELETE /waitlist/{entryId} — CUSTOMER only
async function handleLeave(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'CUSTOMER');
  if (roleErr) return roleErr;

  const entryId = event.pathParameters?.['entryId'];
  if (!entryId) return err(400, 'VALIDATION_ERROR', 'entryId path parameter is required');

  try {
    const removed = await leaveWaitlist(getDynamo(), {
      userId: claimsOrErr.userId,
      entryId,
    });
    return ok(200, { data: removed });
  } catch (e) {
    return handleWaitlistError(e);
  }
}

// GET /businesses/me/waitlist/{serviceId} — BUSINESS only
async function handleListForService(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  const serviceId = event.pathParameters?.['serviceId'];
  if (!serviceId) return err(400, 'VALIDATION_ERROR', 'serviceId path parameter is required');

  try {
    const result = await listBusinessWaitlist(getDynamo(), {
      userId: claimsOrErr.userId,
      serviceId,
    });
    return ok(200, { data: result.entries, count: result.count });
  } catch (e) {
    return handleWaitlistError(e);
  }
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  switch (event.routeKey) {
    case 'POST /waitlist':
      return handleJoin(event);
    case 'GET /waitlist/me':
      return handleListMine(event);
    case 'DELETE /waitlist/{entryId}':
      return handleLeave(event);
    case 'GET /businesses/me/waitlist/{serviceId}':
      return handleListForService(event);
    default:
      return err(404, 'NOT_FOUND', 'Route not found');
  }
};
