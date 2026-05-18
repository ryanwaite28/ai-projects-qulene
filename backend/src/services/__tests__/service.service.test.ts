import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listActiveByBusiness,
  createService,
  updateService,
  softDeleteService,
  ServiceLimitError,
  ServiceNotFoundError,
  ServiceOwnershipError,
} from '../service.service.js';
import * as servicesTable from '../../db/tables/services.table.js';
import { PublishCommand } from '@aws-sdk/client-sns';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SNSClient } from '@aws-sdk/client-sns';
import type { Service } from '../../db/tables/services.table.js';

vi.mock('../../db/tables/services.table.js');

const mockListByBusiness = vi.mocked(servicesTable.listByBusinessActive);
const mockCountActive = vi.mocked(servicesTable.countActiveByBusiness);
const mockGetById = vi.mocked(servicesTable.getServiceById);
const mockPut = vi.mocked(servicesTable.putService);
const mockDbUpdate = vi.mocked(servicesTable.updateService);
const mockSetStatus = vi.mocked(servicesTable.setServiceStatus);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockDynamo = {} as DynamoDBDocumentClient;

const snsSendCalls: unknown[] = [];
const mockSns = {
  send: vi.fn((cmd: unknown) => { snsSendCalls.push(cmd); return Promise.resolve({}); }),
} as unknown as SNSClient;

let counter = 0;
function makeService(overrides: Partial<Service> = {}): Service {
  counter++;
  return {
    serviceId: `svc-${counter}`,
    businessId: `biz-${counter}`,
    name: `Service ${counter}`,
    description: 'A test service',
    durationMinutes: 60,
    price: 5000,
    status: 'ACTIVE',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  snsSendCalls.length = 0;
});

// ─── listActiveByBusiness ─────────────────────────────────────────────────────

describe('listActiveByBusiness', () => {
  it('returns paginated list of services for the business', async () => {
    const items = [makeService(), makeService()];
    mockListByBusiness.mockResolvedValue({ items, nextCursor: null });

    const result = await listActiveByBusiness(mockDynamo, { businessId: 'biz-x' });

    expect(mockListByBusiness).toHaveBeenCalledWith(mockDynamo, 'biz-x', 20, undefined);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('forwards cursor to table function', async () => {
    const cursor = Buffer.from('{"serviceId":"x"}').toString('base64');
    mockListByBusiness.mockResolvedValue({ items: [], nextCursor: null });

    await listActiveByBusiness(mockDynamo, { businessId: 'biz-y', cursor });

    expect(mockListByBusiness).toHaveBeenCalledWith(mockDynamo, 'biz-y', 20, cursor);
  });
});

// ─── createService ────────────────────────────────────────────────────────────

describe('createService', () => {
  it('creates a service when under the active limit', async () => {
    mockCountActive.mockResolvedValue(5);
    mockPut.mockResolvedValue(undefined);

    const result = await createService(mockDynamo, {
      userId: 'biz-1',
      name: 'Haircut',
      description: 'A nice haircut',
      durationMinutes: 30,
      price: 2500,
      status: 'ACTIVE',
    });

    expect(result.name).toBe('Haircut');
    expect(result.businessId).toBe('biz-1');
    expect(result.serviceId).toBeTruthy();
    expect(result.createdAt).toBeTruthy();
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it('throws ServiceLimitError when business has 20+ active services', async () => {
    mockCountActive.mockResolvedValue(20);

    await expect(
      createService(mockDynamo, {
        userId: 'biz-full',
        name: 'One Too Many',
        description: 'desc',
        durationMinutes: 30,
        price: 0,
        status: 'ACTIVE',
      }),
    ).rejects.toBeInstanceOf(ServiceLimitError);

    expect(mockPut).not.toHaveBeenCalled();
  });

  it('sets createdAt and updatedAt to the same timestamp on creation', async () => {
    mockCountActive.mockResolvedValue(0);
    mockPut.mockResolvedValue(undefined);

    const before = Date.now();
    const result = await createService(mockDynamo, {
      userId: 'biz-2',
      name: 'Manicure',
      description: 'desc',
      durationMinutes: 45,
      price: 3500,
      status: 'ACTIVE',
    });
    const after = Date.now();

    const createdMs = new Date(result.createdAt).getTime();
    expect(createdMs).toBeGreaterThanOrEqual(before);
    expect(createdMs).toBeLessThanOrEqual(after);
    expect(result.createdAt).toBe(result.updatedAt);
  });
});

// ─── updateService ────────────────────────────────────────────────────────────

describe('updateService', () => {
  it('updates the service when ownership matches', async () => {
    const svc = makeService({ businessId: 'owner-biz' });
    mockGetById.mockResolvedValue(svc);
    mockDbUpdate.mockResolvedValue(undefined);

    const result = await updateService(mockDynamo, {
      userId: 'owner-biz',
      serviceId: svc.serviceId,
      updates: { name: 'Updated Name', price: 9999 },
    });

    expect(result.name).toBe('Updated Name');
    expect(result.price).toBe(9999);
    expect(result.businessId).toBe('owner-biz');
    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });

  it('throws ServiceOwnershipError when businessId does not match userId', async () => {
    const svc = makeService({ businessId: 'other-biz' });
    mockGetById.mockResolvedValue(svc);

    await expect(
      updateService(mockDynamo, {
        userId: 'intruder-biz',
        serviceId: svc.serviceId,
        updates: { name: 'Stolen' },
      }),
    ).rejects.toBeInstanceOf(ServiceOwnershipError);

    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('throws ServiceNotFoundError when service does not exist', async () => {
    mockGetById.mockResolvedValue(undefined);

    await expect(
      updateService(mockDynamo, {
        userId: 'any-biz',
        serviceId: 'nonexistent',
        updates: {},
      }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  it('throws ServiceNotFoundError for a DELETED service', async () => {
    const svc = makeService({ status: 'DELETED' });
    mockGetById.mockResolvedValue(svc);

    await expect(
      updateService(mockDynamo, {
        userId: svc.businessId,
        serviceId: svc.serviceId,
        updates: {},
      }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });
});

// ─── softDeleteService ────────────────────────────────────────────────────────

describe('softDeleteService', () => {
  it('sets status=DELETED and publishes SERVICE_REMOVED SNS event', async () => {
    const svc = makeService({ businessId: 'owner-biz-del' });
    mockGetById.mockResolvedValue(svc);
    mockSetStatus.mockResolvedValue(undefined);
    process.env.SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:qulene-local-events';

    await softDeleteService(mockDynamo, mockSns, {
      userId: 'owner-biz-del',
      serviceId: svc.serviceId,
    });

    expect(mockSetStatus).toHaveBeenCalledWith(mockDynamo, svc.serviceId, 'DELETED');
    expect(snsSendCalls).toHaveLength(1);
    const cmd = snsSendCalls[0] as PublishCommand;
    const msg = JSON.parse(cmd.input.Message ?? '{}');
    expect(msg.eventType).toBe('SERVICE_REMOVED');
    expect(msg.payload.serviceId).toBe(svc.serviceId);
  });

  it('throws ServiceOwnershipError when deleting another business service', async () => {
    const svc = makeService({ businessId: 'owner-biz' });
    mockGetById.mockResolvedValue(svc);

    await expect(
      softDeleteService(mockDynamo, mockSns, {
        userId: 'intruder-biz',
        serviceId: svc.serviceId,
      }),
    ).rejects.toBeInstanceOf(ServiceOwnershipError);

    expect(mockSetStatus).not.toHaveBeenCalled();
    expect(snsSendCalls).toHaveLength(0);
  });

  it('throws ServiceNotFoundError when service does not exist', async () => {
    mockGetById.mockResolvedValue(undefined);

    await expect(
      softDeleteService(mockDynamo, mockSns, {
        userId: 'any-biz',
        serviceId: 'missing-svc',
      }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });
});
