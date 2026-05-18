import { randomUUID } from 'crypto';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SNSClient } from '@aws-sdk/client-sns';
import type { AppointmentRequest } from '@qulene/api-types';
import {
  getRequestById,
  getRequestByIdempotencyKey,
  listByCustomer,
  listByBusinessAndStatus,
  putRequest,
  updateRequestStatus,
  type AppointmentRequestPaginatedResult,
} from '../db/tables/appointment-requests.table.js';
import { getServiceById } from '../db/tables/services.table.js';
import { putNotification } from '../db/tables/notifications.table.js';
import { incrementUnreadCount } from '../db/tables/users.table.js';
import { publishEvent } from '../clients/sns.client.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 20;
const DUPLICATE_CHECK_LIMIT = 200;

export class AppointmentNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Appointment request not found') {
    super(message);
    this.name = 'AppointmentNotFoundError';
  }
}

export class AppointmentConflictError extends Error {
  readonly code = 'CONFLICT';
  constructor(message = 'You already have an active request for this service') {
    super(message);
    this.name = 'AppointmentConflictError';
  }
}

export class AppointmentUnprocessableError extends Error {
  readonly code = 'UNPROCESSABLE';
  constructor(message: string) {
    super(message);
    this.name = 'AppointmentUnprocessableError';
  }
}

export class AppointmentForbiddenError extends Error {
  readonly code = 'FORBIDDEN';
  constructor(message = 'You do not have permission to modify this request') {
    super(message);
    this.name = 'AppointmentForbiddenError';
  }
}

export interface CreateRequestInput {
  customerId: string;
  serviceId: string;
  proposedAt: string;
  notes?: string;
  idempotencyKey: string;
}

export async function createRequest(
  dynamo: DynamoDBDocumentClient,
  sns: SNSClient,
  input: CreateRequestInput,
): Promise<AppointmentRequest> {
  const start = Date.now();

  if (!UUID_RE.test(input.idempotencyKey)) {
    throw new AppointmentUnprocessableError('idempotencyKey must be a valid UUID v4');
  }

  const existing = await getRequestByIdempotencyKey(dynamo, input.idempotencyKey);
  if (existing && existing.customerId === input.customerId) {
    console.log(JSON.stringify({ level: 'info', action: 'createRequest', idempotencyReplay: true, durationMs: Date.now() - start }));
    return existing;
  }

  const proposedDate = new Date(input.proposedAt);
  if (isNaN(proposedDate.getTime()) || proposedDate <= new Date()) {
    throw new AppointmentUnprocessableError('proposedAt must be a future datetime');
  }

  const service = await getServiceById(dynamo, input.serviceId);
  if (!service || service.status === 'DELETED') {
    throw new AppointmentNotFoundError('Service not found');
  }
  const { businessId, name: serviceName } = service;

  const { items: priorRequests } = await listByCustomer(
    dynamo,
    input.customerId,
    DUPLICATE_CHECK_LIMIT,
    undefined,
  );
  const hasDuplicate = priorRequests.some(
    (r) => r.serviceId === input.serviceId && (r.status === 'PENDING' || r.status === 'ACCEPTED'),
  );
  if (hasDuplicate) {
    throw new AppointmentConflictError();
  }

  const now = new Date().toISOString();
  const requestId = randomUUID();
  const request: AppointmentRequest = {
    requestId,
    customerId: input.customerId,
    businessId,
    serviceId: input.serviceId,
    proposedAt: input.proposedAt,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    status: 'PENDING',
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  };

  await putRequest(dynamo, request);

  await putNotification(dynamo, {
    notificationId: randomUUID(),
    userId: businessId,
    type: 'REQUEST_RECEIVED',
    relatedId: requestId,
    message: `New appointment request for ${serviceName}`,
    isRead: false,
    createdAt: now,
  });
  await incrementUnreadCount(dynamo, businessId);
  await publishEvent(sns, 'REQUEST_RECEIVED', { appointmentRequestId: requestId });

  console.log(JSON.stringify({ level: 'info', action: 'createRequest', durationMs: Date.now() - start }));
  return request;
}

export interface CancelRequestInput {
  userId: string;
  requestId: string;
}

export async function cancelRequest(
  dynamo: DynamoDBDocumentClient,
  sns: SNSClient,
  input: CancelRequestInput,
): Promise<AppointmentRequest> {
  const start = Date.now();

  const found = await getRequestById(dynamo, input.requestId);
  if (!found) {
    throw new AppointmentNotFoundError();
  }

  if (found.customerId !== input.userId) {
    throw new AppointmentForbiddenError();
  }

  if (found.status !== 'PENDING' && found.status !== 'ACCEPTED') {
    throw new AppointmentUnprocessableError(
      `Cannot cancel a request with status ${found.status}`,
    );
  }

  const now = new Date().toISOString();
  await updateRequestStatus(dynamo, input.requestId, 'CANCELLED', now);

  await putNotification(dynamo, {
    notificationId: randomUUID(),
    userId: found.businessId,
    type: 'REQUEST_CANCELLED',
    relatedId: input.requestId,
    message: 'An appointment request was cancelled by the customer',
    isRead: false,
    createdAt: now,
  });
  await incrementUnreadCount(dynamo, found.businessId);

  // TODO: Phase 4a — call waitlist.service.promoteOldestForService(dynamo, sns, found.serviceId) here
  await publishEvent(sns, 'REQUEST_CANCELLED', { appointmentRequestId: input.requestId });

  const cancelled: AppointmentRequest = { ...found, status: 'CANCELLED', updatedAt: now };
  console.log(JSON.stringify({ level: 'info', action: 'cancelRequest', durationMs: Date.now() - start }));
  return cancelled;
}

export interface ListCustomerRequestsInput {
  customerId: string;
  cursor?: string;
}

export async function listCustomerRequests(
  dynamo: DynamoDBDocumentClient,
  input: ListCustomerRequestsInput,
): Promise<AppointmentRequestPaginatedResult> {
  const start = Date.now();
  const result = await listByCustomer(dynamo, input.customerId, PAGE_SIZE, input.cursor);
  console.log(JSON.stringify({ level: 'info', action: 'listCustomerRequests', durationMs: Date.now() - start }));
  return result;
}

export interface BusinessActionInput {
  userId: string;
  requestId: string;
}

export async function acceptRequest(
  dynamo: DynamoDBDocumentClient,
  sns: SNSClient,
  input: BusinessActionInput,
): Promise<AppointmentRequest> {
  const start = Date.now();

  const found = await getRequestById(dynamo, input.requestId);
  if (!found) throw new AppointmentNotFoundError();
  if (found.businessId !== input.userId) throw new AppointmentForbiddenError();
  if (found.status !== 'PENDING') {
    throw new AppointmentUnprocessableError(`Cannot accept a request with status ${found.status}`);
  }

  const now = new Date().toISOString();
  await updateRequestStatus(dynamo, input.requestId, 'ACCEPTED', now);
  await putNotification(dynamo, {
    notificationId: randomUUID(),
    userId: found.customerId,
    type: 'REQUEST_ACCEPTED',
    relatedId: input.requestId,
    message: 'Your appointment request has been accepted',
    isRead: false,
    createdAt: now,
  });
  await incrementUnreadCount(dynamo, found.customerId);
  await publishEvent(sns, 'REQUEST_ACCEPTED', { appointmentRequestId: input.requestId });

  const accepted: AppointmentRequest = { ...found, status: 'ACCEPTED', updatedAt: now };
  console.log(JSON.stringify({ level: 'info', action: 'acceptRequest', durationMs: Date.now() - start }));
  return accepted;
}

export async function declineRequest(
  dynamo: DynamoDBDocumentClient,
  sns: SNSClient,
  input: BusinessActionInput,
): Promise<AppointmentRequest> {
  const start = Date.now();

  const found = await getRequestById(dynamo, input.requestId);
  if (!found) throw new AppointmentNotFoundError();
  if (found.businessId !== input.userId) throw new AppointmentForbiddenError();
  if (found.status !== 'PENDING') {
    throw new AppointmentUnprocessableError(`Cannot decline a request with status ${found.status}`);
  }

  const now = new Date().toISOString();
  await updateRequestStatus(dynamo, input.requestId, 'DECLINED', now);
  await putNotification(dynamo, {
    notificationId: randomUUID(),
    userId: found.customerId,
    type: 'REQUEST_DECLINED',
    relatedId: input.requestId,
    message: 'Your appointment request was declined',
    isRead: false,
    createdAt: now,
  });
  await incrementUnreadCount(dynamo, found.customerId);
  // TODO: Phase 4a — call waitlist.service.promoteOldestForService(dynamo, sns, found.serviceId) here
  await publishEvent(sns, 'REQUEST_DECLINED', { appointmentRequestId: input.requestId });

  const declined: AppointmentRequest = { ...found, status: 'DECLINED', updatedAt: now };
  console.log(JSON.stringify({ level: 'info', action: 'declineRequest', durationMs: Date.now() - start }));
  return declined;
}

export async function markComplete(
  dynamo: DynamoDBDocumentClient,
  input: BusinessActionInput,
): Promise<AppointmentRequest> {
  const start = Date.now();

  const found = await getRequestById(dynamo, input.requestId);
  if (!found) throw new AppointmentNotFoundError();
  if (found.businessId !== input.userId) throw new AppointmentForbiddenError();
  if (found.status !== 'ACCEPTED') {
    throw new AppointmentUnprocessableError(`Cannot mark complete a request with status ${found.status}`);
  }
  if (new Date(found.proposedAt) >= new Date()) {
    throw new AppointmentUnprocessableError('Cannot mark complete before the appointment time has passed');
  }

  const now = new Date().toISOString();
  await updateRequestStatus(dynamo, input.requestId, 'COMPLETED', now);

  const completed: AppointmentRequest = { ...found, status: 'COMPLETED', updatedAt: now };
  console.log(JSON.stringify({ level: 'info', action: 'markComplete', durationMs: Date.now() - start }));
  return completed;
}

export async function markNoShow(
  dynamo: DynamoDBDocumentClient,
  input: BusinessActionInput,
): Promise<AppointmentRequest> {
  const start = Date.now();

  const found = await getRequestById(dynamo, input.requestId);
  if (!found) throw new AppointmentNotFoundError();
  if (found.businessId !== input.userId) throw new AppointmentForbiddenError();
  if (found.status !== 'ACCEPTED') {
    throw new AppointmentUnprocessableError(`Cannot mark no-show a request with status ${found.status}`);
  }
  if (new Date(found.proposedAt) >= new Date()) {
    throw new AppointmentUnprocessableError('Cannot mark no-show before the appointment time has passed');
  }

  const now = new Date().toISOString();
  await updateRequestStatus(dynamo, input.requestId, 'NO_SHOW', now);

  const noShow: AppointmentRequest = { ...found, status: 'NO_SHOW', updatedAt: now };
  console.log(JSON.stringify({ level: 'info', action: 'markNoShow', durationMs: Date.now() - start }));
  return noShow;
}

export interface ListBusinessRequestsInput {
  businessId: string;
  status?: import('@qulene/api-types').AppointmentStatus;
  cursor?: string;
}

export async function listBusinessRequests(
  dynamo: DynamoDBDocumentClient,
  input: ListBusinessRequestsInput,
): Promise<AppointmentRequestPaginatedResult> {
  const start = Date.now();
  const result = await listByBusinessAndStatus(
    dynamo,
    input.businessId,
    input.status,
    PAGE_SIZE,
    input.cursor,
  );
  // Sort current page by proposedAt ascending (FR-APT-10)
  result.items.sort((a, b) => a.proposedAt.localeCompare(b.proposedAt));
  console.log(JSON.stringify({ level: 'info', action: 'listBusinessRequests', durationMs: Date.now() - start }));
  return result;
}
