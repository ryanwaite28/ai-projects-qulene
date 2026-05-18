import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { S3Client } from '@aws-sdk/client-s3';
import type { UserRole } from '../types/index.js';
import { createDynamoClient } from '../db/dynamo.client.js';
import { createS3Client } from '../clients/s3.client.js';
import { extractClaims, requireRole, type ParsedClaims } from '../middleware/auth.middleware.js';
import {
  getBusinessById,
  listActiveBusinesses,
  updateOwnProfile,
  generateAvatarUploadUrl,
} from '../services/business.service.js';
import {
  handleListAvailability,
  handleAddWindow,
  handleRemoveWindow,
} from './availability.handler.js';

let _dynamo: DynamoDBDocumentClient | undefined;
let _s3: S3Client | undefined;
const getDynamo = (): DynamoDBDocumentClient => (_dynamo ??= createDynamoClient());
const getS3 = (): S3Client => (_s3 ??= createS3Client());

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

async function handleList(event: APIGatewayProxyEventV2) {
  const category = event.queryStringParameters?.['category'];
  const cursor = event.queryStringParameters?.['cursor'];
  const params: { category?: string; cursor?: string } = {};
  if (category) params.category = category;
  if (cursor) params.cursor = cursor;
  const result = await listActiveBusinesses(getDynamo(), params);
  return ok(200, { data: result.items, nextCursor: result.nextCursor });
}

async function handleGetById(event: APIGatewayProxyEventV2) {
  const businessId = event.pathParameters?.['businessId'];
  if (!businessId) return err(400, 'VALIDATION_ERROR', 'businessId path parameter is required');
  const profile = await getBusinessById(getDynamo(), businessId);
  if (!profile) return err(404, 'NOT_FOUND', 'Business not found');
  return ok(200, { data: profile });
}

async function handleUpdateMe(event: APIGatewayProxyEventV2) {
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

  const profile = await updateOwnProfile(getDynamo(), { userId: claimsOrErr.userId, updates: body });
  return ok(200, { data: profile });
}

async function handleAvatarUpload(event: APIGatewayProxyEventV2) {
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

  const { contentType } = body;
  if (typeof contentType !== 'string' || !contentType.trim()) {
    return err(400, 'VALIDATION_ERROR', 'contentType is required');
  }

  try {
    const result = await generateAvatarUploadUrl(getS3(), {
      userId: claimsOrErr.userId,
      contentType: contentType.trim(),
    });
    return ok(200, { data: result });
  } catch (e: unknown) {
    if (e instanceof Error && (e as NodeJS.ErrnoException & { code?: string }).code === 'VALIDATION_ERROR') {
      return err(400, 'VALIDATION_ERROR', e.message);
    }
    throw e;
  }
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  switch (event.routeKey) {
    case 'GET /businesses':
      return handleList(event);
    case 'GET /businesses/{businessId}':
      return handleGetById(event);
    case 'PATCH /businesses/me':
      return handleUpdateMe(event);
    case 'POST /businesses/me/avatar':
      return handleAvatarUpload(event);
    case 'GET /businesses/{businessId}/availability':
      return handleListAvailability(event, getDynamo());
    case 'POST /businesses/me/availability':
      return handleAddWindow(event, getDynamo());
    case 'DELETE /businesses/me/availability/{windowId}':
      return handleRemoveWindow(event, getDynamo());
    default:
      return err(404, 'NOT_FOUND', 'Route not found');
  }
};
