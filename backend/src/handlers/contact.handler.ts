import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SESClient } from '@aws-sdk/client-ses';
import { createDynamoClient } from '../db/dynamo.client.js';
import { createSesClient } from '../clients/ses.client.js';
import { submitContact, signupForWaitlist } from '../services/contact.service.js';

let _dynamo: DynamoDBDocumentClient | undefined;
let _ses: SESClient | undefined;
const getDynamo = (): DynamoDBDocumentClient => (_dynamo ??= createDynamoClient());
const getSes = (): SESClient => (_ses ??= createSesClient());

const err = (statusCode: number, code: string, message: string) => ({
  statusCode,
  body: JSON.stringify({ error: { code, message } }),
});

const ok = (body: unknown) => ({
  statusCode: 200,
  body: JSON.stringify(body),
});

export const handler = async (event: APIGatewayProxyEventV2) => {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
  } catch {
    return err(400, 'VALIDATION_ERROR', 'Invalid JSON body');
  }

  switch (event.routeKey) {
    case 'POST /web/contact': return handleContact(body);
    case 'POST /web/signup':  return handleSignup(body);
    default: return err(404, 'NOT_FOUND', `Unknown route: ${event.routeKey}`);
  }
};

async function handleContact(body: Record<string, unknown>) {
  const { name, email, message } = body;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return err(400, 'VALIDATION_ERROR', 'name is required');
  }
  if (name.length > 100) {
    return err(400, 'VALIDATION_ERROR', 'name must be 100 characters or fewer');
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return err(400, 'VALIDATION_ERROR', 'email is required and must contain @');
  }
  if (typeof message !== 'string' || message.trim().length === 0) {
    return err(400, 'VALIDATION_ERROR', 'message is required');
  }
  if (message.length > 2000) {
    return err(400, 'VALIDATION_ERROR', 'message must be 2000 characters or fewer');
  }

  try {
    await submitContact(getSes(), { name, email, message });
    return ok({ data: { ok: true } });
  } catch {
    return err(500, 'INTERNAL_ERROR', 'Failed to send message. Please try again.');
  }
}

async function handleSignup(body: Record<string, unknown>) {
  const { email } = body;

  if (typeof email !== 'string' || !email.includes('@')) {
    return err(400, 'VALIDATION_ERROR', 'email is required and must contain @');
  }

  try {
    const result = await signupForWaitlist(getDynamo(), email);
    return ok({ data: result });
  } catch {
    return err(500, 'INTERNAL_ERROR', 'Failed to sign up. Please try again.');
  }
}
