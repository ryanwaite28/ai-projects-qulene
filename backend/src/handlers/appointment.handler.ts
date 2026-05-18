import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SNSClient } from '@aws-sdk/client-sns';
import { createDynamoClient } from '../db/dynamo.client.js';
import { createSnsClient } from '../clients/sns.client.js';
import { extractClaims, requireRole, type ParsedClaims } from '../middleware/auth.middleware.js';
import type { UserRole } from '../types/index.js';
import {
  createRequest,
  cancelRequest,
  listCustomerRequests,
  acceptRequest,
  declineRequest,
  markComplete,
  markNoShow,
  listBusinessRequests,
  AppointmentNotFoundError,
  AppointmentConflictError,
  AppointmentUnprocessableError,
  AppointmentForbiddenError,
} from '../services/appointment.service.js';
import type { AppointmentStatus } from '@qulene/api-types';

let _dynamo: DynamoDBDocumentClient | undefined;
let _sns: SNSClient | undefined;
const getDynamo = (): DynamoDBDocumentClient => (_dynamo ??= createDynamoClient());
const getSns = (): SNSClient => (_sns ??= createSnsClient());

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

function handleAppointmentError(e: unknown) {
  if (e instanceof AppointmentNotFoundError) return err(404, e.code, e.message);
  if (e instanceof AppointmentConflictError) return err(409, e.code, e.message);
  if (e instanceof AppointmentUnprocessableError) return err(422, e.code, e.message);
  if (e instanceof AppointmentForbiddenError) return err(403, e.code, e.message);
  throw e;
}

// POST /appointments — CUSTOMER only
async function handleCreate(event: APIGatewayProxyEventV2) {
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

  const { serviceId, proposedAt, notes, idempotencyKey } = body;

  if (typeof serviceId !== 'string' || !serviceId.trim()) {
    return err(400, 'VALIDATION_ERROR', 'serviceId is required');
  }
  if (typeof proposedAt !== 'string' || !proposedAt.trim()) {
    return err(400, 'VALIDATION_ERROR', 'proposedAt is required');
  }
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return err(400, 'VALIDATION_ERROR', 'idempotencyKey is required');
  }
  if (notes !== undefined && typeof notes !== 'string') {
    return err(400, 'VALIDATION_ERROR', 'notes must be a string');
  }

  try {
    const request = await createRequest(getDynamo(), getSns(), {
      customerId: claimsOrErr.userId,
      serviceId: serviceId.trim(),
      proposedAt: proposedAt.trim(),
      ...(typeof notes === 'string' ? { notes } : {}),
      idempotencyKey: idempotencyKey.trim(),
    });
    return ok(201, { data: request });
  } catch (e) {
    return handleAppointmentError(e);
  }
}

// GET /appointments/me — CUSTOMER only
async function handleListMine(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'CUSTOMER');
  if (roleErr) return roleErr;

  const cursor = event.queryStringParameters?.['cursor'] || undefined;
  const result = await listCustomerRequests(getDynamo(), {
    customerId: claimsOrErr.userId,
    ...(cursor !== undefined ? { cursor } : {}),
  });
  return ok(200, { data: result.items, nextCursor: result.nextCursor });
}

// DELETE /appointments/{requestId} — CUSTOMER only
async function handleCancel(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'CUSTOMER');
  if (roleErr) return roleErr;

  const requestId = event.pathParameters?.['requestId'];
  if (!requestId) return err(400, 'VALIDATION_ERROR', 'requestId path parameter is required');

  try {
    const cancelled = await cancelRequest(getDynamo(), getSns(), {
      userId: claimsOrErr.userId,
      requestId,
    });
    return ok(200, { data: cancelled });
  } catch (e) {
    return handleAppointmentError(e);
  }
}

const VALID_APPOINTMENT_STATUSES = new Set<string>([
  'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED', 'NO_SHOW',
]);

// PATCH /businesses/me/appointments/{requestId}/accept — BUSINESS only
async function handleAccept(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  const requestId = event.pathParameters?.['requestId'];
  if (!requestId) return err(400, 'VALIDATION_ERROR', 'requestId path parameter is required');

  try {
    const updated = await acceptRequest(getDynamo(), getSns(), { userId: claimsOrErr.userId, requestId });
    return ok(200, { data: updated });
  } catch (e) {
    return handleAppointmentError(e);
  }
}

// PATCH /businesses/me/appointments/{requestId}/decline — BUSINESS only
async function handleDecline(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  const requestId = event.pathParameters?.['requestId'];
  if (!requestId) return err(400, 'VALIDATION_ERROR', 'requestId path parameter is required');

  try {
    const updated = await declineRequest(getDynamo(), getSns(), { userId: claimsOrErr.userId, requestId });
    return ok(200, { data: updated });
  } catch (e) {
    return handleAppointmentError(e);
  }
}

// PATCH /businesses/me/appointments/{requestId}/complete — BUSINESS only
async function handleComplete(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  const requestId = event.pathParameters?.['requestId'];
  if (!requestId) return err(400, 'VALIDATION_ERROR', 'requestId path parameter is required');

  try {
    const updated = await markComplete(getDynamo(), { userId: claimsOrErr.userId, requestId });
    return ok(200, { data: updated });
  } catch (e) {
    return handleAppointmentError(e);
  }
}

// PATCH /businesses/me/appointments/{requestId}/noshow — BUSINESS only
async function handleNoShow(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  const requestId = event.pathParameters?.['requestId'];
  if (!requestId) return err(400, 'VALIDATION_ERROR', 'requestId path parameter is required');

  try {
    const updated = await markNoShow(getDynamo(), { userId: claimsOrErr.userId, requestId });
    return ok(200, { data: updated });
  } catch (e) {
    return handleAppointmentError(e);
  }
}

// GET /businesses/me/appointments — BUSINESS only
async function handleListBusiness(event: APIGatewayProxyEventV2) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;
  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  const statusParam = event.queryStringParameters?.['status'];
  const cursor = event.queryStringParameters?.['cursor'] || undefined;

  if (statusParam !== undefined && !VALID_APPOINTMENT_STATUSES.has(statusParam)) {
    return err(400, 'VALIDATION_ERROR', 'Invalid status filter value');
  }

  const result = await listBusinessRequests(getDynamo(), {
    businessId: claimsOrErr.userId,
    ...(statusParam !== undefined ? { status: statusParam as AppointmentStatus } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
  });
  return ok(200, { data: result.items, nextCursor: result.nextCursor });
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  switch (event.routeKey) {
    case 'POST /appointments':
      return handleCreate(event);
    case 'GET /appointments/me':
      return handleListMine(event);
    case 'DELETE /appointments/{requestId}':
      return handleCancel(event);
    case 'PATCH /businesses/me/appointments/{requestId}/accept':
      return handleAccept(event);
    case 'PATCH /businesses/me/appointments/{requestId}/decline':
      return handleDecline(event);
    case 'PATCH /businesses/me/appointments/{requestId}/complete':
      return handleComplete(event);
    case 'PATCH /businesses/me/appointments/{requestId}/noshow':
      return handleNoShow(event);
    case 'GET /businesses/me/appointments':
      return handleListBusiness(event);
    default:
      return err(404, 'NOT_FOUND', 'Route not found');
  }
};
