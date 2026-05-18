import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { AppointmentRequest } from '@qulene/api-types';
import {
  getRequestById,
  getRequestByIdempotencyKey,
  listByCustomer,
  listByBusinessAndStatus,
  listByService,
  putRequest,
  updateRequestStatus,
} from '../appointment-requests.table.js';

let counter = 0;
function makeRequest(overrides: Partial<AppointmentRequest> = {}): AppointmentRequest {
  const n = ++counter;
  return {
    requestId: `req-${n}`,
    customerId: `cust-${n}`,
    businessId: `biz-${n}`,
    serviceId: `svc-${n}`,
    proposedAt: '2026-06-01T10:00:00.000Z',
    status: 'PENDING',
    idempotencyKey: `idem-${n}`,
    createdAt: `2026-05-01T0${n}:00:00.000Z`,
    updatedAt: `2026-05-01T0${n}:00:00.000Z`,
    ...overrides,
  };
}

function makeMockClient(sendReturn: unknown = {}): DynamoDBDocumentClient {
  return { send: vi.fn().mockResolvedValue(sendReturn) } as unknown as DynamoDBDocumentClient;
}

describe('appointment-requests.table', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getRequestById', () => {
    it('returns the item when found', async () => {
      const req = makeRequest();
      const dynamo = makeMockClient({ Item: req });
      const result = await getRequestById(dynamo, req.requestId);
      expect(result).toEqual(req);
      expect(dynamo.send).toHaveBeenCalledOnce();
    });

    it('returns undefined when item not found', async () => {
      const dynamo = makeMockClient({ Item: undefined });
      const result = await getRequestById(dynamo, 'missing-id');
      expect(result).toBeUndefined();
    });
  });

  describe('getRequestByIdempotencyKey', () => {
    it('returns the first matching item', async () => {
      const req = makeRequest();
      const dynamo = makeMockClient({ Items: [req] });
      const result = await getRequestByIdempotencyKey(dynamo, req.idempotencyKey);
      expect(result).toEqual(req);
    });

    it('returns undefined when no items match', async () => {
      const dynamo = makeMockClient({ Items: [] });
      const result = await getRequestByIdempotencyKey(dynamo, 'unknown-key');
      expect(result).toBeUndefined();
    });
  });

  describe('listByCustomer', () => {
    it('returns items and null cursor when no LastEvaluatedKey', async () => {
      const reqs = [makeRequest(), makeRequest()];
      const dynamo = makeMockClient({ Items: reqs, LastEvaluatedKey: undefined });
      const result = await listByCustomer(dynamo, 'cust-1', 20, undefined);
      expect(result.items).toEqual(reqs);
      expect(result.nextCursor).toBeNull();
    });

    it('returns base64 nextCursor when LastEvaluatedKey present', async () => {
      const lastKey = { requestId: 'req-99', customerId: 'cust-1', createdAt: 't' };
      const dynamo = makeMockClient({ Items: [], LastEvaluatedKey: lastKey });
      const result = await listByCustomer(dynamo, 'cust-1', 20, undefined);
      expect(result.nextCursor).toBe(
        Buffer.from(JSON.stringify(lastKey)).toString('base64'),
      );
    });
  });

  describe('listByBusinessAndStatus', () => {
    it('returns items filtered by businessId and status', async () => {
      const reqs = [makeRequest({ status: 'PENDING' })];
      const dynamo = makeMockClient({ Items: reqs, LastEvaluatedKey: undefined });
      const result = await listByBusinessAndStatus(dynamo, 'biz-1', 'PENDING', 20, undefined);
      expect(result.items).toEqual(reqs);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('listByService', () => {
    it('returns all items for serviceId without status filter', async () => {
      const reqs = [makeRequest(), makeRequest()];
      const dynamo = makeMockClient({ Items: reqs });
      const result = await listByService(dynamo, 'svc-1');
      expect(result).toEqual(reqs);
    });

    it('includes FilterExpression when statusFilter provided', async () => {
      const dynamo = makeMockClient({ Items: [] });
      await listByService(dynamo, 'svc-1', 'PENDING');
      const call = (dynamo.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.input.FilterExpression).toBeDefined();
    });
  });

  describe('putRequest', () => {
    it('calls send once and returns void', async () => {
      const dynamo = makeMockClient({});
      const req = makeRequest();
      const result = await putRequest(dynamo, req);
      expect(result).toBeUndefined();
      expect(dynamo.send).toHaveBeenCalledOnce();
    });
  });

  describe('updateRequestStatus', () => {
    it('calls send once with update expression', async () => {
      const dynamo = makeMockClient({});
      await updateRequestStatus(dynamo, 'req-1', 'ACCEPTED', new Date().toISOString());
      expect(dynamo.send).toHaveBeenCalledOnce();
      const call = (dynamo.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.input.UpdateExpression).toContain('SET #st = :status');
    });
  });
});
