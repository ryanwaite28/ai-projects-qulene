import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SNSClient } from '@aws-sdk/client-sns';
import type { UserRole } from '../types/index.js';
import { createDynamoClient } from '../db/dynamo.client.js';
import { createSnsClient } from '../clients/sns.client.js';
import { extractClaims, requireRole, type ParsedClaims } from '../middleware/auth.middleware.js';
import {
  listActiveByBusiness,
  createService,
  updateService,
  softDeleteService,
  ServiceLimitError,
  ServiceNotFoundError,
  ServiceOwnershipError,
} from '../services/service.service.js';

let _dynamo: DynamoDBDocumentClient | undefined;
let _sns: SNSClient | undefined;
const getDynamo = (): DynamoDBDocumentClient => (_dynamo ??= createDynamoClient());
const getSns = (): SNSClient => (_sns ??= createSnsClient());

const VALID_ROLES = new Set<string>(['BUSINESS', 'CUSTOMER']);
const VALID_STATUSES = new Set<string>(['ACTIVE', 'PAUSED']);

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

function handleServiceError(e: unknown) {
  if (e instanceof ServiceLimitError) return err(422, e.code, e.message);
  if (e instanceof ServiceNotFoundError) return err(404, e.code, e.message);
  if (e instanceof ServiceOwnershipError) return err(403, e.code, e.message);
  throw e;
}

// GET /businesses/{businessId}/services — public
async function handleList(event: APIGatewayProxyEventV2) {
  const businessId = event.pathParameters?.['businessId'];
  if (!businessId) return err(400, 'VALIDATION_ERROR', 'businessId path parameter is required');
  const cursor = event.queryStringParameters?.['cursor'] || undefined;
  const params: { businessId: string; cursor?: string } = { businessId };
  if (cursor) params.cursor = cursor;
  const result = await listActiveByBusiness(getDynamo(), params);
  return ok(200, { data: result.items, nextCursor: result.nextCursor });
}

// POST /businesses/me/services — BUSINESS only
async function handleCreate(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return err(400, 'VALIDATION_ERROR', 'Invalid JSON body');
  }

  const { name, description, durationMinutes, price, status } = body;

  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    return err(400, 'VALIDATION_ERROR', 'name is required (max 100 chars)');
  }
  if (typeof description !== 'string' || description.length > 1000) {
    return err(400, 'VALIDATION_ERROR', 'description is required (max 1000 chars)');
  }
  if (typeof durationMinutes !== 'number' || !Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    return err(400, 'VALIDATION_ERROR', 'durationMinutes must be an integer between 15 and 480');
  }
  if (typeof price !== 'number' || !Number.isInteger(price) || price < 0) {
    return err(400, 'VALIDATION_ERROR', 'price must be a non-negative integer (cents)');
  }
  const svcStatus = status ?? 'ACTIVE';
  if (!VALID_STATUSES.has(svcStatus as string)) {
    return err(400, 'VALIDATION_ERROR', 'status must be ACTIVE or PAUSED');
  }

  try {
    const service = await createService(getDynamo(), {
      userId: claimsOrErr.userId,
      name: name.trim(),
      description,
      durationMinutes,
      price,
      status: svcStatus as 'ACTIVE' | 'PAUSED',
    });
    return ok(201, { data: service });
  } catch (e) {
    return handleServiceError(e);
  }
}

// PATCH /businesses/me/services/{serviceId} — BUSINESS only
async function handleUpdate(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  const serviceId = event.pathParameters?.['serviceId'];
  if (!serviceId) return err(400, 'VALIDATION_ERROR', 'serviceId path parameter is required');

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return err(400, 'VALIDATION_ERROR', 'Invalid JSON body');
  }

  const allowed = ['name', 'description', 'durationMinutes', 'price', 'status'] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if ('status' in updates && !VALID_STATUSES.has(updates['status'] as string)) {
    return err(400, 'VALIDATION_ERROR', 'status must be ACTIVE or PAUSED');
  }

  try {
    const service = await updateService(getDynamo(), {
      userId: claimsOrErr.userId,
      serviceId,
      updates: updates as Parameters<typeof updateService>[1]['updates'],
    });
    return ok(200, { data: service });
  } catch (e) {
    return handleServiceError(e);
  }
}

// DELETE /businesses/me/services/{serviceId} — BUSINESS only
async function handleDelete(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  const serviceId = event.pathParameters?.['serviceId'];
  if (!serviceId) return err(400, 'VALIDATION_ERROR', 'serviceId path parameter is required');

  try {
    await softDeleteService(getDynamo(), getSns(), {
      userId: claimsOrErr.userId,
      serviceId,
    });
    return ok(200, { data: { serviceId, status: 'DELETED' } });
  } catch (e) {
    return handleServiceError(e);
  }
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  switch (event.routeKey) {
    case 'GET /businesses/{businessId}/services':
      return handleList(event);
    case 'POST /businesses/me/services':
      return handleCreate(event);
    case 'PATCH /businesses/me/services/{serviceId}':
      return handleUpdate(event);
    case 'DELETE /businesses/me/services/{serviceId}':
      return handleDelete(event);
    default:
      return err(404, 'NOT_FOUND', 'Route not found');
  }
};
