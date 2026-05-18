import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { extractClaims, requireRole, type ParsedClaims } from '../middleware/auth.middleware.js';
import type { UserRole } from '../types/index.js';
import {
  listForBusiness,
  addWindow,
  removeWindow,
  WindowLimitError,
  WindowDayLimitError,
  WindowNotFoundError,
  WindowOwnershipError,
} from '../services/availability.service.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
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

function handleWindowError(e: unknown) {
  if (e instanceof WindowLimitError) return err(422, e.code, e.message);
  if (e instanceof WindowDayLimitError) return err(422, e.code, e.message);
  if (e instanceof WindowNotFoundError) return err(404, e.code, e.message);
  if (e instanceof WindowOwnershipError) return err(403, e.code, e.message);
  throw e;
}

export async function handleListAvailability(
  event: APIGatewayProxyEventV2,
  dynamo: DynamoDBDocumentClient,
) {
  const businessId = event.pathParameters?.['businessId'];
  if (!businessId) return err(400, 'VALIDATION_ERROR', 'businessId path parameter is required');
  const windows = await listForBusiness(dynamo, businessId);
  return ok(200, { data: windows });
}

export async function handleAddWindow(
  event: APIGatewayProxyEventV2,
  dynamo: DynamoDBDocumentClient,
) {
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

  const { dayOfWeek, startTime, endTime } = body;

  if (typeof dayOfWeek !== 'number' || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return err(400, 'VALIDATION_ERROR', 'dayOfWeek must be an integer between 0 and 6');
  }
  if (typeof startTime !== 'string' || !TIME_RE.test(startTime)) {
    return err(400, 'VALIDATION_ERROR', 'startTime must match HH:MM (00:00–23:59)');
  }
  if (typeof endTime !== 'string' || !TIME_RE.test(endTime)) {
    return err(400, 'VALIDATION_ERROR', 'endTime must match HH:MM (00:00–23:59)');
  }
  if (endTime <= startTime) {
    return err(400, 'VALIDATION_ERROR', 'endTime must be after startTime');
  }

  try {
    const window = await addWindow(dynamo, {
      userId: claimsOrErr.userId,
      dayOfWeek,
      startTime,
      endTime,
    });
    return ok(201, { data: window });
  } catch (e: unknown) {
    return handleWindowError(e);
  }
}

export async function handleRemoveWindow(
  event: APIGatewayProxyEventV2,
  dynamo: DynamoDBDocumentClient,
) {
  const claimsOrErr = resolveAuthenticatedClaims(event);
  if (isErrorResponse(claimsOrErr)) return claimsOrErr;

  const roleErr = requireRole(claimsOrErr, 'BUSINESS');
  if (roleErr) return roleErr;

  const windowId = event.pathParameters?.['windowId'];
  if (!windowId) return err(400, 'VALIDATION_ERROR', 'windowId path parameter is required');

  try {
    await removeWindow(dynamo, { userId: claimsOrErr.userId, windowId });
    return ok(200, { data: { deleted: true } });
  } catch (e: unknown) {
    return handleWindowError(e);
  }
}
