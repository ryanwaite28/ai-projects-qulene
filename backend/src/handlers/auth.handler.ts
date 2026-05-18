import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { UserRole } from '../types/index.js';
import { createDynamoClient } from '../db/dynamo.client.js';
import { extractClaims, type ParsedClaims } from '../middleware/auth.middleware.js';
import { createOrSyncUserProfile } from '../services/auth.service.js';

let _dynamo: DynamoDBDocumentClient | undefined;
const getDynamo = (): DynamoDBDocumentClient => (_dynamo ??= createDynamoClient());

const VALID_ROLES = new Set<string>(['BUSINESS', 'CUSTOMER']);

const err = (statusCode: number, code: string, message: string) => ({
  statusCode,
  body: JSON.stringify({ error: { code, message } }),
});

export const handler = async (event: APIGatewayProxyEventV2) => {
  const raw = extractClaims(event);

  if (!raw.userId) {
    return err(401, 'UNAUTHORIZED', 'Missing userId claim');
  }
  if (!raw.role) {
    return err(422, 'UNPROCESSABLE', 'Missing custom:role claim');
  }
  if (!VALID_ROLES.has(raw.role)) {
    return err(422, 'UNPROCESSABLE', 'Invalid role value');
  }

  const claims: ParsedClaims = {
    userId: raw.userId,
    role: raw.role as UserRole,
    email: raw.email ?? '',
  };

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return err(400, 'VALIDATION_ERROR', 'Invalid JSON body');
  }

  const { firstName, lastName } = body;
  if (typeof firstName !== 'string' || firstName.trim().length === 0 || firstName.length > 50) {
    return err(400, 'VALIDATION_ERROR', 'firstName is required (max 50 chars)');
  }
  if (typeof lastName !== 'string' || lastName.trim().length === 0 || lastName.length > 50) {
    return err(400, 'VALIDATION_ERROR', 'lastName is required (max 50 chars)');
  }

  const user = await createOrSyncUserProfile(getDynamo(), {
    userId: claims.userId,
    email: claims.email,
    role: claims.role,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
  });

  return { statusCode: 200, body: JSON.stringify({ data: user }) };
};
