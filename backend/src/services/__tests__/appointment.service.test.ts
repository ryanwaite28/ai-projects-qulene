import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SNSClient } from '@aws-sdk/client-sns';
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
} from '../appointment.service.js';
import * as apptTable from '../../db/tables/appointment-requests.table.js';
import * as svcTable from '../../db/tables/services.table.js';
import * as notifTable from '../../db/tables/notifications.table.js';
import * as usersTable from '../../db/tables/users.table.js';
import * as snsClient from '../../clients/sns.client.js';
import type { AppointmentRequest } from '@qulene/api-types';

vi.mock('../../db/tables/appointment-requests.table.js');
vi.mock('../../db/tables/services.table.js');
vi.mock('../../db/tables/notifications.table.js');
vi.mock('../../db/tables/users.table.js');
vi.mock('../../clients/sns.client.js');

const mockGetRequestById = vi.mocked(apptTable.getRequestById);
const mockGetByIdempotency = vi.mocked(apptTable.getRequestByIdempotencyKey);
const mockListByCustomer = vi.mocked(apptTable.listByCustomer);
const mockListByBusinessAndStatus = vi.mocked(apptTable.listByBusinessAndStatus);
const mockPutRequest = vi.mocked(apptTable.putRequest);
const mockUpdateStatus = vi.mocked(apptTable.updateRequestStatus);
const mockGetService = vi.mocked(svcTable.getServiceById);
const mockPutNotif = vi.mocked(notifTable.putNotification);
const mockIncrementUnread = vi.mocked(usersTable.incrementUnreadCount);
const mockPublish = vi.mocked(snsClient.publishEvent);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockDynamo = {} as DynamoDBDocumentClient;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockSns = {} as SNSClient;

let counter = 0;
const futureDate = () => new Date(Date.now() + 86_400_000).toISOString();
const validUuid = () => {
  counter++;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};

function makeRequest(overrides: Partial<AppointmentRequest> = {}): AppointmentRequest {
  return {
    requestId: validUuid(),
    customerId: 'cust-1',
    businessId: 'biz-1',
    serviceId: 'svc-1',
    proposedAt: futureDate(),
    status: 'PENDING',
    idempotencyKey: validUuid(),
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeService() {
  return {
    serviceId: 'svc-1',
    businessId: 'biz-1',
    name: 'Haircut',
    description: '',
    durationMinutes: 60,
    price: 3000,
    status: 'ACTIVE' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPutRequest.mockResolvedValue(undefined);
  mockPutNotif.mockResolvedValue(undefined);
  mockIncrementUnread.mockResolvedValue(undefined);
  mockPublish.mockResolvedValue(undefined);
  mockUpdateStatus.mockResolvedValue(undefined);
});

// ─── createRequest ────────────────────────────────────────────────────────────

describe('createRequest', () => {
  it('creates and returns a PENDING request on happy path', async () => {
    mockGetByIdempotency.mockResolvedValue(undefined);
    mockGetService.mockResolvedValue(makeService());
    mockListByCustomer.mockResolvedValue({ items: [], nextCursor: null });

    const key = validUuid();
    const result = await createRequest(mockDynamo, mockSns, {
      customerId: 'cust-1',
      serviceId: 'svc-1',
      proposedAt: futureDate(),
      idempotencyKey: key,
    });

    expect(result.status).toBe('PENDING');
    expect(result.customerId).toBe('cust-1');
    expect(mockPutRequest).toHaveBeenCalledOnce();
    expect(mockPublish).toHaveBeenCalledWith(mockSns, 'REQUEST_RECEIVED', expect.objectContaining({ appointmentRequestId: result.requestId }));
  });

  it('returns existing request on idempotency replay without publishing SNS', async () => {
    const existing = makeRequest();
    mockGetByIdempotency.mockResolvedValue(existing);

    const result = await createRequest(mockDynamo, mockSns, {
      customerId: existing.customerId,
      serviceId: 'svc-1',
      proposedAt: futureDate(),
      idempotencyKey: existing.idempotencyKey,
    });

    expect(result).toEqual(existing);
    expect(mockPutRequest).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('throws AppointmentUnprocessableError when idempotencyKey is not a UUID', async () => {
    await expect(
      createRequest(mockDynamo, mockSns, {
        customerId: 'cust-1',
        serviceId: 'svc-1',
        proposedAt: futureDate(),
        idempotencyKey: 'not-a-uuid',
      }),
    ).rejects.toThrow(AppointmentUnprocessableError);
  });

  it('throws AppointmentUnprocessableError when proposedAt is in the past', async () => {
    mockGetByIdempotency.mockResolvedValue(undefined);
    const key = validUuid();
    await expect(
      createRequest(mockDynamo, mockSns, {
        customerId: 'cust-1',
        serviceId: 'svc-1',
        proposedAt: '2020-01-01T00:00:00.000Z',
        idempotencyKey: key,
      }),
    ).rejects.toThrow(AppointmentUnprocessableError);
  });

  it('throws AppointmentNotFoundError when service does not exist', async () => {
    mockGetByIdempotency.mockResolvedValue(undefined);
    mockGetService.mockResolvedValue(undefined);

    await expect(
      createRequest(mockDynamo, mockSns, {
        customerId: 'cust-1',
        serviceId: 'missing-svc',
        proposedAt: futureDate(),
        idempotencyKey: validUuid(),
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it('throws AppointmentNotFoundError when service is DELETED', async () => {
    mockGetByIdempotency.mockResolvedValue(undefined);
    mockGetService.mockResolvedValue({ ...makeService(), status: 'DELETED' });

    await expect(
      createRequest(mockDynamo, mockSns, {
        customerId: 'cust-1',
        serviceId: 'svc-1',
        proposedAt: futureDate(),
        idempotencyKey: validUuid(),
      }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it('throws AppointmentConflictError when customer has a PENDING request for same service', async () => {
    mockGetByIdempotency.mockResolvedValue(undefined);
    mockGetService.mockResolvedValue(makeService());
    mockListByCustomer.mockResolvedValue({
      items: [makeRequest({ status: 'PENDING', serviceId: 'svc-1' })],
      nextCursor: null,
    });

    await expect(
      createRequest(mockDynamo, mockSns, {
        customerId: 'cust-1',
        serviceId: 'svc-1',
        proposedAt: futureDate(),
        idempotencyKey: validUuid(),
      }),
    ).rejects.toThrow(AppointmentConflictError);
    expect(mockPutRequest).not.toHaveBeenCalled();
  });
});

// ─── cancelRequest ─────────────────────────────────────────────────────────

describe('cancelRequest', () => {
  it('cancels a PENDING request and publishes SNS', async () => {
    const request = makeRequest({ status: 'PENDING' });
    mockGetRequestById.mockResolvedValue(request);

    const result = await cancelRequest(mockDynamo, mockSns, {
      userId: request.customerId,
      requestId: request.requestId,
    });

    expect(result.status).toBe('CANCELLED');
    expect(mockUpdateStatus).toHaveBeenCalledWith(mockDynamo, request.requestId, 'CANCELLED', expect.any(String));
    expect(mockPublish).toHaveBeenCalledWith(mockSns, 'REQUEST_CANCELLED', expect.objectContaining({ appointmentRequestId: request.requestId }));
  });

  it('cancels an ACCEPTED request', async () => {
    const request = makeRequest({ status: 'ACCEPTED' });
    mockGetRequestById.mockResolvedValue(request);

    const result = await cancelRequest(mockDynamo, mockSns, {
      userId: request.customerId,
      requestId: request.requestId,
    });
    expect(result.status).toBe('CANCELLED');
  });

  it('throws AppointmentNotFoundError when request not found', async () => {
    mockGetRequestById.mockResolvedValue(undefined);
    await expect(
      cancelRequest(mockDynamo, mockSns, { userId: 'cust-1', requestId: 'missing' }),
    ).rejects.toThrow(AppointmentNotFoundError);
  });

  it('throws AppointmentForbiddenError when different customer tries to cancel', async () => {
    const request = makeRequest({ customerId: 'cust-1' });
    mockGetRequestById.mockResolvedValue(request);

    await expect(
      cancelRequest(mockDynamo, mockSns, { userId: 'cust-other', requestId: request.requestId }),
    ).rejects.toThrow(AppointmentForbiddenError);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('throws AppointmentUnprocessableError when request is already CANCELLED', async () => {
    const request = makeRequest({ status: 'CANCELLED' });
    mockGetRequestById.mockResolvedValue(request);

    await expect(
      cancelRequest(mockDynamo, mockSns, { userId: request.customerId, requestId: request.requestId }),
    ).rejects.toThrow(AppointmentUnprocessableError);
  });

  it('throws AppointmentUnprocessableError when request is COMPLETED', async () => {
    const request = makeRequest({ status: 'COMPLETED' });
    mockGetRequestById.mockResolvedValue(request);

    await expect(
      cancelRequest(mockDynamo, mockSns, { userId: request.customerId, requestId: request.requestId }),
    ).rejects.toThrow(AppointmentUnprocessableError);
  });
});

// ─── listCustomerRequests ─────────────────────────────────────────────────

describe('listCustomerRequests', () => {
  it('returns paginated results for the customer', async () => {
    const items = [makeRequest(), makeRequest()];
    mockListByCustomer.mockResolvedValue({ items, nextCursor: null });

    const result = await listCustomerRequests(mockDynamo, { customerId: 'cust-1' });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
    expect(mockListByCustomer).toHaveBeenCalledWith(mockDynamo, 'cust-1', 20, undefined);
  });

  it('passes cursor through', async () => {
    mockListByCustomer.mockResolvedValue({ items: [], nextCursor: null });
    await listCustomerRequests(mockDynamo, { customerId: 'cust-1', cursor: 'abc123' });
    expect(mockListByCustomer).toHaveBeenCalledWith(mockDynamo, 'cust-1', 20, 'abc123');
  });
});

// ─── acceptRequest ────────────────────────────────────────────────────────

describe('acceptRequest', () => {
  it('accepts a PENDING request, notifies customer, publishes SNS', async () => {
    const request = makeRequest({ status: 'PENDING', businessId: 'biz-1', customerId: 'cust-1' });
    mockGetRequestById.mockResolvedValue(request);

    const result = await acceptRequest(mockDynamo, mockSns, { userId: 'biz-1', requestId: request.requestId });

    expect(result.status).toBe('ACCEPTED');
    expect(mockUpdateStatus).toHaveBeenCalledWith(mockDynamo, request.requestId, 'ACCEPTED', expect.any(String));
    expect(mockPutNotif).toHaveBeenCalledWith(mockDynamo, expect.objectContaining({ userId: 'cust-1', type: 'REQUEST_ACCEPTED' }));
    expect(mockIncrementUnread).toHaveBeenCalledWith(mockDynamo, 'cust-1');
    expect(mockPublish).toHaveBeenCalledWith(mockSns, 'REQUEST_ACCEPTED', expect.objectContaining({ appointmentRequestId: request.requestId }));
  });

  it('throws AppointmentNotFoundError when request not found', async () => {
    mockGetRequestById.mockResolvedValue(undefined);
    await expect(acceptRequest(mockDynamo, mockSns, { userId: 'biz-1', requestId: 'missing' }))
      .rejects.toThrow(AppointmentNotFoundError);
  });

  it('throws AppointmentForbiddenError when different business tries to accept', async () => {
    const request = makeRequest({ businessId: 'biz-1' });
    mockGetRequestById.mockResolvedValue(request);
    await expect(acceptRequest(mockDynamo, mockSns, { userId: 'biz-other', requestId: request.requestId }))
      .rejects.toThrow(AppointmentForbiddenError);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
  });

  it('throws AppointmentUnprocessableError when status is not PENDING', async () => {
    const request = makeRequest({ status: 'CANCELLED', businessId: 'biz-1' });
    mockGetRequestById.mockResolvedValue(request);
    await expect(acceptRequest(mockDynamo, mockSns, { userId: 'biz-1', requestId: request.requestId }))
      .rejects.toThrow(AppointmentUnprocessableError);
  });
});

// ─── declineRequest ───────────────────────────────────────────────────────

describe('declineRequest', () => {
  it('declines a PENDING request, notifies customer, publishes SNS', async () => {
    const request = makeRequest({ status: 'PENDING', businessId: 'biz-1', customerId: 'cust-1' });
    mockGetRequestById.mockResolvedValue(request);

    const result = await declineRequest(mockDynamo, mockSns, { userId: 'biz-1', requestId: request.requestId });

    expect(result.status).toBe('DECLINED');
    expect(mockUpdateStatus).toHaveBeenCalledWith(mockDynamo, request.requestId, 'DECLINED', expect.any(String));
    expect(mockPutNotif).toHaveBeenCalledWith(mockDynamo, expect.objectContaining({ userId: 'cust-1', type: 'REQUEST_DECLINED' }));
    expect(mockIncrementUnread).toHaveBeenCalledWith(mockDynamo, 'cust-1');
    expect(mockPublish).toHaveBeenCalledWith(mockSns, 'REQUEST_DECLINED', expect.objectContaining({ appointmentRequestId: request.requestId }));
  });

  it('throws AppointmentNotFoundError when request not found', async () => {
    mockGetRequestById.mockResolvedValue(undefined);
    await expect(declineRequest(mockDynamo, mockSns, { userId: 'biz-1', requestId: 'missing' }))
      .rejects.toThrow(AppointmentNotFoundError);
  });

  it('throws AppointmentForbiddenError when different business tries to decline', async () => {
    const request = makeRequest({ businessId: 'biz-1' });
    mockGetRequestById.mockResolvedValue(request);
    await expect(declineRequest(mockDynamo, mockSns, { userId: 'biz-other', requestId: request.requestId }))
      .rejects.toThrow(AppointmentForbiddenError);
  });

  it('throws AppointmentUnprocessableError when status is ACCEPTED (not PENDING)', async () => {
    const request = makeRequest({ status: 'ACCEPTED', businessId: 'biz-1' });
    mockGetRequestById.mockResolvedValue(request);
    await expect(declineRequest(mockDynamo, mockSns, { userId: 'biz-1', requestId: request.requestId }))
      .rejects.toThrow(AppointmentUnprocessableError);
  });
});

// ─── markComplete ─────────────────────────────────────────────────────────

describe('markComplete', () => {
  it('marks an ACCEPTED request with past proposedAt as COMPLETED', async () => {
    const request = makeRequest({ status: 'ACCEPTED', businessId: 'biz-1', proposedAt: '2020-01-01T00:00:00.000Z' });
    mockGetRequestById.mockResolvedValue(request);

    const result = await markComplete(mockDynamo, { userId: 'biz-1', requestId: request.requestId });

    expect(result.status).toBe('COMPLETED');
    expect(mockUpdateStatus).toHaveBeenCalledWith(mockDynamo, request.requestId, 'COMPLETED', expect.any(String));
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('throws AppointmentNotFoundError when request not found', async () => {
    mockGetRequestById.mockResolvedValue(undefined);
    await expect(markComplete(mockDynamo, { userId: 'biz-1', requestId: 'missing' }))
      .rejects.toThrow(AppointmentNotFoundError);
  });

  it('throws AppointmentForbiddenError when different business tries to complete', async () => {
    const request = makeRequest({ status: 'ACCEPTED', businessId: 'biz-1', proposedAt: '2020-01-01T00:00:00.000Z' });
    mockGetRequestById.mockResolvedValue(request);
    await expect(markComplete(mockDynamo, { userId: 'biz-other', requestId: request.requestId }))
      .rejects.toThrow(AppointmentForbiddenError);
  });

  it('throws AppointmentUnprocessableError when status is PENDING (not ACCEPTED)', async () => {
    const request = makeRequest({ status: 'PENDING', businessId: 'biz-1', proposedAt: '2020-01-01T00:00:00.000Z' });
    mockGetRequestById.mockResolvedValue(request);
    await expect(markComplete(mockDynamo, { userId: 'biz-1', requestId: request.requestId }))
      .rejects.toThrow(AppointmentUnprocessableError);
  });

  it('throws AppointmentUnprocessableError when proposedAt is in the future', async () => {
    const request = makeRequest({ status: 'ACCEPTED', businessId: 'biz-1', proposedAt: futureDate() });
    mockGetRequestById.mockResolvedValue(request);
    await expect(markComplete(mockDynamo, { userId: 'biz-1', requestId: request.requestId }))
      .rejects.toThrow(AppointmentUnprocessableError);
  });
});

// ─── markNoShow ───────────────────────────────────────────────────────────

describe('markNoShow', () => {
  it('marks an ACCEPTED request with past proposedAt as NO_SHOW', async () => {
    const request = makeRequest({ status: 'ACCEPTED', businessId: 'biz-1', proposedAt: '2020-01-01T00:00:00.000Z' });
    mockGetRequestById.mockResolvedValue(request);

    const result = await markNoShow(mockDynamo, { userId: 'biz-1', requestId: request.requestId });

    expect(result.status).toBe('NO_SHOW');
    expect(mockUpdateStatus).toHaveBeenCalledWith(mockDynamo, request.requestId, 'NO_SHOW', expect.any(String));
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('throws AppointmentUnprocessableError when proposedAt is in the future', async () => {
    const request = makeRequest({ status: 'ACCEPTED', businessId: 'biz-1', proposedAt: futureDate() });
    mockGetRequestById.mockResolvedValue(request);
    await expect(markNoShow(mockDynamo, { userId: 'biz-1', requestId: request.requestId }))
      .rejects.toThrow(AppointmentUnprocessableError);
  });

  it('throws AppointmentForbiddenError when different business tries to mark no-show', async () => {
    const request = makeRequest({ status: 'ACCEPTED', businessId: 'biz-1', proposedAt: '2020-01-01T00:00:00.000Z' });
    mockGetRequestById.mockResolvedValue(request);
    await expect(markNoShow(mockDynamo, { userId: 'biz-other', requestId: request.requestId }))
      .rejects.toThrow(AppointmentForbiddenError);
  });
});

// ─── listBusinessRequests ─────────────────────────────────────────────────

describe('listBusinessRequests', () => {
  it('returns page sorted by proposedAt ascending', async () => {
    const later = makeRequest({ proposedAt: '2027-06-01T10:00:00.000Z' });
    const earlier = makeRequest({ proposedAt: '2027-03-01T10:00:00.000Z' });
    mockListByBusinessAndStatus.mockResolvedValue({ items: [later, earlier], nextCursor: null });

    const result = await listBusinessRequests(mockDynamo, { businessId: 'biz-1' });

    expect(result.items[0].proposedAt).toBe('2027-03-01T10:00:00.000Z');
    expect(result.items[1].proposedAt).toBe('2027-06-01T10:00:00.000Z');
    expect(mockListByBusinessAndStatus).toHaveBeenCalledWith(mockDynamo, 'biz-1', undefined, 20, undefined);
  });

  it('passes status filter through to table helper', async () => {
    mockListByBusinessAndStatus.mockResolvedValue({ items: [], nextCursor: null });
    await listBusinessRequests(mockDynamo, { businessId: 'biz-1', status: 'PENDING' });
    expect(mockListByBusinessAndStatus).toHaveBeenCalledWith(mockDynamo, 'biz-1', 'PENDING', 20, undefined);
  });

  it('passes cursor through to table helper', async () => {
    mockListByBusinessAndStatus.mockResolvedValue({ items: [], nextCursor: null });
    await listBusinessRequests(mockDynamo, { businessId: 'biz-1', cursor: 'tok123' });
    expect(mockListByBusinessAndStatus).toHaveBeenCalledWith(mockDynamo, 'biz-1', undefined, 20, 'tok123');
  });
});
