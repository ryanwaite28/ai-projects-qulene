import { randomUUID } from 'crypto';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SNSClient } from '@aws-sdk/client-sns';
import type { WaitlistEntry } from '@qulene/api-types';
import {
  getEntryById,
  getActiveByCustomerAndService,
  listActiveByService,
  listByCustomer,
  putEntry,
  updateEntryStatus,
  conditionalPromoteEntry,
  type WaitlistPaginatedResult,
} from '../db/tables/waitlist-entries.table.js';
import { getServiceById } from '../db/tables/services.table.js';
import { putNotification } from '../db/tables/notifications.table.js';
import { incrementUnreadCount } from '../db/tables/users.table.js';
import { publishEvent } from '../clients/sns.client.js';

const PAGE_SIZE = 20;

export class WaitlistNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Waitlist entry not found') {
    super(message);
    this.name = 'WaitlistNotFoundError';
  }
}

export class WaitlistConflictError extends Error {
  readonly code = 'CONFLICT';
  constructor(message = 'You are already on the waitlist for this service') {
    super(message);
    this.name = 'WaitlistConflictError';
  }
}

export class WaitlistUnprocessableError extends Error {
  readonly code = 'UNPROCESSABLE';
  constructor(message: string) {
    super(message);
    this.name = 'WaitlistUnprocessableError';
  }
}

export class WaitlistForbiddenError extends Error {
  readonly code = 'FORBIDDEN';
  constructor(message = 'You do not have permission to modify this entry') {
    super(message);
    this.name = 'WaitlistForbiddenError';
  }
}

export interface JoinWaitlistInput {
  customerId: string;
  serviceId: string;
}

export async function joinWaitlist(
  dynamo: DynamoDBDocumentClient,
  input: JoinWaitlistInput,
): Promise<WaitlistEntry> {
  const start = Date.now();

  const service = await getServiceById(dynamo, input.serviceId);
  if (!service || service.status === 'DELETED') {
    throw new WaitlistNotFoundError('Service not found');
  }

  const existing = await getActiveByCustomerAndService(dynamo, input.customerId, input.serviceId);
  if (existing) {
    throw new WaitlistConflictError();
  }

  const now = new Date().toISOString();
  const entry: WaitlistEntry = {
    entryId: randomUUID(),
    customerId: input.customerId,
    serviceId: input.serviceId,
    businessId: service.businessId,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await putEntry(dynamo, entry);

  console.log(JSON.stringify({ level: 'info', action: 'joinWaitlist', durationMs: Date.now() - start }));
  return entry;
}

export interface LeaveWaitlistInput {
  userId: string;
  entryId: string;
}

export async function leaveWaitlist(
  dynamo: DynamoDBDocumentClient,
  input: LeaveWaitlistInput,
): Promise<WaitlistEntry> {
  const start = Date.now();

  const found = await getEntryById(dynamo, input.entryId);
  if (!found) throw new WaitlistNotFoundError();

  if (found.customerId !== input.userId) throw new WaitlistForbiddenError();

  if (found.status !== 'ACTIVE') {
    throw new WaitlistUnprocessableError(`Cannot leave a waitlist with status ${found.status}`);
  }

  const now = new Date().toISOString();
  await updateEntryStatus(dynamo, input.entryId, 'REMOVED', now);

  const removed: WaitlistEntry = { ...found, status: 'REMOVED', updatedAt: now };
  console.log(JSON.stringify({ level: 'info', action: 'leaveWaitlist', durationMs: Date.now() - start }));
  return removed;
}

export interface ListCustomerEntriesInput {
  customerId: string;
  cursor?: string;
}

export async function listCustomerEntries(
  dynamo: DynamoDBDocumentClient,
  input: ListCustomerEntriesInput,
): Promise<WaitlistPaginatedResult> {
  const start = Date.now();
  const result = await listByCustomer(dynamo, input.customerId, PAGE_SIZE, input.cursor);
  console.log(JSON.stringify({ level: 'info', action: 'listCustomerEntries', durationMs: Date.now() - start }));
  return result;
}

export interface ListBusinessWaitlistInput {
  userId: string;
  serviceId: string;
}

export async function listBusinessWaitlist(
  dynamo: DynamoDBDocumentClient,
  input: ListBusinessWaitlistInput,
): Promise<{ entries: WaitlistEntry[]; count: number }> {
  const start = Date.now();

  const service = await getServiceById(dynamo, input.serviceId);
  if (!service || service.status === 'DELETED') {
    throw new WaitlistNotFoundError('Service not found');
  }
  if (service.businessId !== input.userId) {
    throw new WaitlistForbiddenError('You do not own this service');
  }

  const entries = await listActiveByService(dynamo, input.serviceId);

  console.log(JSON.stringify({ level: 'info', action: 'listBusinessWaitlist', durationMs: Date.now() - start }));
  return { entries, count: entries.length };
}

export interface PromoteOldestInput {
  serviceId: string;
}

export async function promoteOldestForService(
  dynamo: DynamoDBDocumentClient,
  sns: SNSClient,
  input: PromoteOldestInput,
): Promise<void> {
  const start = Date.now();

  const candidates = await listActiveByService(dynamo, input.serviceId);
  if (candidates.length === 0) {
    console.log(JSON.stringify({ level: 'info', action: 'promoteOldestForService', noEntries: true, durationMs: Date.now() - start }));
    return;
  }

  const oldest = candidates[0];
  if (!oldest) return;
  const now = new Date().toISOString();

  // Conditional write: only succeeds if status is still 'ACTIVE' — concurrent decline/cancel handled safely
  const promoted = await conditionalPromoteEntry(dynamo, oldest.entryId, now);
  if (!promoted) {
    console.log(JSON.stringify({ level: 'info', action: 'promoteOldestForService', raceLost: true, durationMs: Date.now() - start }));
    return;
  }

  await putNotification(dynamo, {
    notificationId: randomUUID(),
    userId: oldest.customerId,
    type: 'WAITLIST_PROMOTED',
    relatedId: oldest.serviceId,
    message: 'A slot has opened — you can now book an appointment',
    isRead: false,
    createdAt: now,
  });
  await incrementUnreadCount(dynamo, oldest.customerId);
  await publishEvent(sns, 'WAITLIST_PROMOTED', { waitlistEntryId: oldest.entryId });

  console.log(JSON.stringify({ level: 'info', action: 'promoteOldestForService', entryId: oldest.entryId, durationMs: Date.now() - start }));
}
