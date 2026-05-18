import { randomUUID } from 'crypto';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  getWindowById,
  listByBusiness,
  putWindow,
  deleteWindow,
  countByBusiness,
  countByBusinessAndDay,
  type AvailabilityWindow,
} from '../db/tables/availability-windows.table.js';

const MAX_WINDOWS_TOTAL = 14;
const MAX_WINDOWS_PER_DAY = 2;

export class WindowLimitError extends Error {
  readonly code = 'LIMIT_REACHED';
  constructor() {
    super('Business has reached the maximum of 14 availability windows');
    this.name = 'WindowLimitError';
  }
}

export class WindowDayLimitError extends Error {
  readonly code = 'DAY_LIMIT_REACHED';
  constructor() {
    super('Business has reached the maximum of 2 windows for this day');
    this.name = 'WindowDayLimitError';
  }
}

export class WindowNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(windowId: string) {
    super(`Availability window not found: ${windowId}`);
    this.name = 'WindowNotFoundError';
  }
}

export class WindowOwnershipError extends Error {
  readonly code = 'FORBIDDEN';
  constructor() {
    super('Availability window does not belong to this business');
    this.name = 'WindowOwnershipError';
  }
}

export async function listForBusiness(
  dynamo: DynamoDBDocumentClient,
  businessId: string,
): Promise<AvailabilityWindow[]> {
  const start = Date.now();
  const windows = await listByBusiness(dynamo, businessId);
  console.log(JSON.stringify({ level: 'info', action: 'listForBusiness', durationMs: Date.now() - start }));
  return windows;
}

export interface AddWindowInput {
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export async function addWindow(
  dynamo: DynamoDBDocumentClient,
  input: AddWindowInput,
): Promise<AvailabilityWindow> {
  const start = Date.now();

  const totalCount = await countByBusiness(dynamo, input.userId);
  if (totalCount >= MAX_WINDOWS_TOTAL) {
    console.log(JSON.stringify({
      level: 'warn', action: 'addWindow', durationMs: Date.now() - start,
      code: 'LIMIT_REACHED', error: 'Max availability windows reached',
    }));
    throw new WindowLimitError();
  }

  const dayCount = await countByBusinessAndDay(dynamo, input.userId, input.dayOfWeek);
  if (dayCount >= MAX_WINDOWS_PER_DAY) {
    console.log(JSON.stringify({
      level: 'warn', action: 'addWindow', durationMs: Date.now() - start,
      code: 'DAY_LIMIT_REACHED', error: 'Max windows per day reached',
    }));
    throw new WindowDayLimitError();
  }

  const now = new Date().toISOString();
  const window: AvailabilityWindow = {
    windowId: randomUUID(),
    businessId: input.userId,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    createdAt: now,
  };

  await putWindow(dynamo, window);
  console.log(JSON.stringify({ level: 'info', action: 'addWindow', durationMs: Date.now() - start }));
  return window;
}

export interface RemoveWindowInput {
  userId: string;
  windowId: string;
}

export async function removeWindow(
  dynamo: DynamoDBDocumentClient,
  input: RemoveWindowInput,
): Promise<void> {
  const start = Date.now();

  const existing = await getWindowById(dynamo, input.windowId);
  if (!existing) {
    throw new WindowNotFoundError(input.windowId);
  }
  if (existing.businessId !== input.userId) {
    throw new WindowOwnershipError();
  }

  await deleteWindow(dynamo, input.windowId);
  console.log(JSON.stringify({ level: 'info', action: 'removeWindow', durationMs: Date.now() - start }));
}
