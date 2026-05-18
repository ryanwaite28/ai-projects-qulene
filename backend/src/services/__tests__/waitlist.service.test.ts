import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SNSClient } from '@aws-sdk/client-sns';
import {
  joinWaitlist,
  leaveWaitlist,
  listCustomerEntries,
  listBusinessWaitlist,
  promoteOldestForService,
  WaitlistNotFoundError,
  WaitlistConflictError,
  WaitlistUnprocessableError,
  WaitlistForbiddenError,
} from '../waitlist.service.js';
import * as waitlistTable from '../../db/tables/waitlist-entries.table.js';
import * as svcTable from '../../db/tables/services.table.js';
import * as notifTable from '../../db/tables/notifications.table.js';
import * as usersTable from '../../db/tables/users.table.js';
import * as snsClient from '../../clients/sns.client.js';
import type { WaitlistEntry } from '@qulene/api-types';

vi.mock('../../db/tables/waitlist-entries.table.js');
vi.mock('../../db/tables/services.table.js');
vi.mock('../../db/tables/notifications.table.js');
vi.mock('../../db/tables/users.table.js');
vi.mock('../../clients/sns.client.js');

const mockGetEntryById = vi.mocked(waitlistTable.getEntryById);
const mockGetActiveByCustomerAndService = vi.mocked(waitlistTable.getActiveByCustomerAndService);
const mockListActiveByService = vi.mocked(waitlistTable.listActiveByService);
const mockListByCustomer = vi.mocked(waitlistTable.listByCustomer);
const mockPutEntry = vi.mocked(waitlistTable.putEntry);
const mockUpdateEntryStatus = vi.mocked(waitlistTable.updateEntryStatus);
const mockConditionalPromoteEntry = vi.mocked(waitlistTable.conditionalPromoteEntry);
const mockGetService = vi.mocked(svcTable.getServiceById);
const mockPutNotif = vi.mocked(notifTable.putNotification);
const mockIncrementUnread = vi.mocked(usersTable.incrementUnreadCount);
const mockPublish = vi.mocked(snsClient.publishEvent);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockDynamo = {} as DynamoDBDocumentClient;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockSns = {} as SNSClient;

let counter = 0;
const uid = () => {
  counter++;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};

function makeEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    entryId: uid(),
    customerId: 'cust-1',
    serviceId: 'svc-1',
    businessId: 'biz-1',
    status: 'ACTIVE',
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
  mockPutEntry.mockResolvedValue(undefined);
  mockUpdateEntryStatus.mockResolvedValue(undefined);
  mockPutNotif.mockResolvedValue(undefined);
  mockIncrementUnread.mockResolvedValue(undefined);
  mockPublish.mockResolvedValue(undefined);
});

// ─── joinWaitlist ─────────────────────────────────────────────────────────────

describe('joinWaitlist', () => {
  it('creates and returns an ACTIVE entry on happy path', async () => {
    mockGetService.mockResolvedValue(makeService());
    mockGetActiveByCustomerAndService.mockResolvedValue(undefined);

    const result = await joinWaitlist(mockDynamo, { customerId: 'cust-1', serviceId: 'svc-1' });

    expect(result.status).toBe('ACTIVE');
    expect(result.customerId).toBe('cust-1');
    expect(result.serviceId).toBe('svc-1');
    expect(result.businessId).toBe('biz-1');
    expect(mockPutEntry).toHaveBeenCalledOnce();
  });

  it('throws WaitlistNotFoundError when service does not exist', async () => {
    mockGetService.mockResolvedValue(undefined);

    await expect(
      joinWaitlist(mockDynamo, { customerId: 'cust-1', serviceId: 'svc-1' }),
    ).rejects.toThrow(WaitlistNotFoundError);
    expect(mockPutEntry).not.toHaveBeenCalled();
  });

  it('throws WaitlistNotFoundError when service is DELETED', async () => {
    mockGetService.mockResolvedValue({ ...makeService(), status: 'DELETED' });

    await expect(
      joinWaitlist(mockDynamo, { customerId: 'cust-1', serviceId: 'svc-1' }),
    ).rejects.toThrow(WaitlistNotFoundError);
  });

  it('throws WaitlistConflictError when customer already has an ACTIVE entry', async () => {
    mockGetService.mockResolvedValue(makeService());
    mockGetActiveByCustomerAndService.mockResolvedValue(makeEntry());

    await expect(
      joinWaitlist(mockDynamo, { customerId: 'cust-1', serviceId: 'svc-1' }),
    ).rejects.toThrow(WaitlistConflictError);
    expect(mockPutEntry).not.toHaveBeenCalled();
  });
});

// ─── leaveWaitlist ────────────────────────────────────────────────────────────

describe('leaveWaitlist', () => {
  it('sets status to REMOVED and returns updated entry on happy path', async () => {
    const entry = makeEntry();
    mockGetEntryById.mockResolvedValue(entry);

    const result = await leaveWaitlist(mockDynamo, { userId: 'cust-1', entryId: entry.entryId });

    expect(result.status).toBe('REMOVED');
    expect(mockUpdateEntryStatus).toHaveBeenCalledWith(mockDynamo, entry.entryId, 'REMOVED', expect.any(String));
  });

  it('throws WaitlistNotFoundError when entry does not exist', async () => {
    mockGetEntryById.mockResolvedValue(undefined);

    await expect(
      leaveWaitlist(mockDynamo, { userId: 'cust-1', entryId: 'no-such-id' }),
    ).rejects.toThrow(WaitlistNotFoundError);
  });

  it('throws WaitlistForbiddenError when userId does not match customerId', async () => {
    mockGetEntryById.mockResolvedValue(makeEntry({ customerId: 'cust-1' }));

    await expect(
      leaveWaitlist(mockDynamo, { userId: 'other-user', entryId: 'entry-id' }),
    ).rejects.toThrow(WaitlistForbiddenError);
  });

  it('throws WaitlistUnprocessableError when entry is not ACTIVE', async () => {
    const entry = makeEntry({ status: 'PROMOTED' });
    mockGetEntryById.mockResolvedValue(entry);

    await expect(
      leaveWaitlist(mockDynamo, { userId: 'cust-1', entryId: entry.entryId }),
    ).rejects.toThrow(WaitlistUnprocessableError);
  });
});

// ─── listCustomerEntries ──────────────────────────────────────────────────────

describe('listCustomerEntries', () => {
  it('returns paginated results from table', async () => {
    const entry = makeEntry();
    mockListByCustomer.mockResolvedValue({ items: [entry], nextCursor: null });

    const result = await listCustomerEntries(mockDynamo, { customerId: 'cust-1' });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
    expect(mockListByCustomer).toHaveBeenCalledWith(mockDynamo, 'cust-1', 20, undefined);
  });

  it('passes cursor to table when provided', async () => {
    mockListByCustomer.mockResolvedValue({ items: [], nextCursor: null });

    await listCustomerEntries(mockDynamo, { customerId: 'cust-1', cursor: 'cursor-abc' });

    expect(mockListByCustomer).toHaveBeenCalledWith(mockDynamo, 'cust-1', 20, 'cursor-abc');
  });
});

// ─── listBusinessWaitlist ─────────────────────────────────────────────────────

describe('listBusinessWaitlist', () => {
  it('returns entries and count on happy path', async () => {
    mockGetService.mockResolvedValue(makeService());
    const entries = [makeEntry(), makeEntry()];
    mockListActiveByService.mockResolvedValue(entries);

    const result = await listBusinessWaitlist(mockDynamo, { userId: 'biz-1', serviceId: 'svc-1' });

    expect(result.entries).toHaveLength(2);
    expect(result.count).toBe(2);
  });

  it('throws WaitlistNotFoundError when service does not exist', async () => {
    mockGetService.mockResolvedValue(undefined);

    await expect(
      listBusinessWaitlist(mockDynamo, { userId: 'biz-1', serviceId: 'svc-1' }),
    ).rejects.toThrow(WaitlistNotFoundError);
  });

  it('throws WaitlistForbiddenError when business does not own the service', async () => {
    mockGetService.mockResolvedValue({ ...makeService(), businessId: 'other-biz' });

    await expect(
      listBusinessWaitlist(mockDynamo, { userId: 'biz-1', serviceId: 'svc-1' }),
    ).rejects.toThrow(WaitlistForbiddenError);
  });
});

// ─── promoteOldestForService ──────────────────────────────────────────────────

describe('promoteOldestForService', () => {
  it('promotes the oldest ACTIVE entry and publishes SNS + notification on happy path', async () => {
    const entry = makeEntry();
    mockListActiveByService.mockResolvedValue([entry]);
    mockConditionalPromoteEntry.mockResolvedValue(true);

    await promoteOldestForService(mockDynamo, mockSns, { serviceId: 'svc-1' });

    expect(mockConditionalPromoteEntry).toHaveBeenCalledWith(mockDynamo, entry.entryId, expect.any(String));
    expect(mockPutNotif).toHaveBeenCalledOnce();
    expect(mockIncrementUnread).toHaveBeenCalledWith(mockDynamo, entry.customerId);
    expect(mockPublish).toHaveBeenCalledWith(mockSns, 'WAITLIST_PROMOTED', { waitlistEntryId: entry.entryId });
  });

  it('does nothing when no candidates exist', async () => {
    mockListActiveByService.mockResolvedValue([]);

    await promoteOldestForService(mockDynamo, mockSns, { serviceId: 'svc-1' });

    expect(mockConditionalPromoteEntry).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('skips notification and SNS when conditional write is lost to a race', async () => {
    const entry = makeEntry();
    mockListActiveByService.mockResolvedValue([entry]);
    mockConditionalPromoteEntry.mockResolvedValue(false);

    await promoteOldestForService(mockDynamo, mockSns, { serviceId: 'svc-1' });

    expect(mockPutNotif).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
