import { randomUUID } from 'crypto';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import {
  getServiceById,
  listByBusinessActive,
  countActiveByBusiness,
  putService,
  updateService as dbUpdateService,
  setServiceStatus,
  type Service,
  type ServicePaginatedResult,
} from '../db/tables/services.table.js';

const MAX_ACTIVE_SERVICES = 20;
const PAGE_SIZE = 20;

export interface ListServicesParams {
  businessId: string;
  cursor?: string;
}

export async function listActiveByBusiness(
  dynamo: DynamoDBDocumentClient,
  params: ListServicesParams,
): Promise<ServicePaginatedResult> {
  const start = Date.now();
  const result = await listByBusinessActive(dynamo, params.businessId, PAGE_SIZE, params.cursor);
  console.log(JSON.stringify({ level: 'info', action: 'listActiveByBusiness', durationMs: Date.now() - start }));
  return result;
}

export interface CreateServiceInput {
  userId: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  status: 'ACTIVE' | 'PAUSED';
}

export class ServiceLimitError extends Error {
  readonly code = 'LIMIT_REACHED';
  constructor() {
    super('Business has reached the maximum of 20 active services');
    this.name = 'ServiceLimitError';
  }
}

export class ServiceNotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(serviceId: string) {
    super(`Service not found: ${serviceId}`);
    this.name = 'ServiceNotFoundError';
  }
}

export class ServiceOwnershipError extends Error {
  readonly code = 'FORBIDDEN';
  constructor() {
    super('Service does not belong to this business');
    this.name = 'ServiceOwnershipError';
  }
}

export async function createService(
  dynamo: DynamoDBDocumentClient,
  input: CreateServiceInput,
): Promise<Service> {
  const start = Date.now();

  const activeCount = await countActiveByBusiness(dynamo, input.userId);
  if (activeCount >= MAX_ACTIVE_SERVICES) {
    console.log(JSON.stringify({
      level: 'warn', action: 'createService', durationMs: Date.now() - start,
      code: 'LIMIT_REACHED', error: 'Max active services reached',
    }));
    throw new ServiceLimitError();
  }

  const now = new Date().toISOString();
  const service: Service = {
    serviceId: randomUUID(),
    businessId: input.userId,
    name: input.name,
    description: input.description,
    durationMinutes: input.durationMinutes,
    price: input.price,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };

  await putService(dynamo, service);
  console.log(JSON.stringify({ level: 'info', action: 'createService', durationMs: Date.now() - start }));
  return service;
}

export interface UpdateServiceInput {
  userId: string;
  serviceId: string;
  updates: Partial<Pick<Service, 'name' | 'description' | 'durationMinutes' | 'price' | 'status'>>;
}

export async function updateService(
  dynamo: DynamoDBDocumentClient,
  input: UpdateServiceInput,
): Promise<Service> {
  const start = Date.now();

  const existing = await getServiceById(dynamo, input.serviceId);
  if (!existing || existing.status === 'DELETED') {
    throw new ServiceNotFoundError(input.serviceId);
  }
  if (existing.businessId !== input.userId) {
    throw new ServiceOwnershipError();
  }

  const now = new Date().toISOString();
  await dbUpdateService(dynamo, input.serviceId, input.updates, now);

  const updated: Service = { ...existing, ...input.updates, updatedAt: now };
  console.log(JSON.stringify({ level: 'info', action: 'updateService', durationMs: Date.now() - start }));
  return updated;
}

export interface SoftDeleteServiceInput {
  userId: string;
  serviceId: string;
}

export async function softDeleteService(
  dynamo: DynamoDBDocumentClient,
  sns: SNSClient,
  input: SoftDeleteServiceInput,
): Promise<void> {
  const start = Date.now();

  const existing = await getServiceById(dynamo, input.serviceId);
  if (!existing || existing.status === 'DELETED') {
    throw new ServiceNotFoundError(input.serviceId);
  }
  if (existing.businessId !== input.userId) {
    throw new ServiceOwnershipError();
  }

  await setServiceStatus(dynamo, input.serviceId, 'DELETED');

  const topicArn = process.env.SNS_TOPIC_ARN ?? '';
  if (topicArn) {
    await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify({
          eventType: 'SERVICE_REMOVED',
          payload: { serviceId: input.serviceId },
        }),
      }),
    );
  }

  console.log(JSON.stringify({ level: 'info', action: 'softDeleteService', durationMs: Date.now() - start }));
}
