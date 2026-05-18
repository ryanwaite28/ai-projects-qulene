import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listForBusiness,
  addWindow,
  removeWindow,
  WindowLimitError,
  WindowDayLimitError,
  WindowNotFoundError,
  WindowOwnershipError,
} from '../availability.service.js';
import * as windowsTable from '../../db/tables/availability-windows.table.js';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { AvailabilityWindow } from '../../db/tables/availability-windows.table.js';

vi.mock('../../db/tables/availability-windows.table.js');

const mockListByBusiness = vi.mocked(windowsTable.listByBusiness);
const mockCountByBusiness = vi.mocked(windowsTable.countByBusiness);
const mockCountByBusinessAndDay = vi.mocked(windowsTable.countByBusinessAndDay);
const mockGetById = vi.mocked(windowsTable.getWindowById);
const mockPut = vi.mocked(windowsTable.putWindow);
const mockDelete = vi.mocked(windowsTable.deleteWindow);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockDynamo = {} as DynamoDBDocumentClient;

let counter = 0;
function makeWindow(overrides: Partial<AvailabilityWindow> = {}): AvailabilityWindow {
  counter++;
  return {
    windowId: `win-${counter}`,
    businessId: `biz-${counter}`,
    dayOfWeek: (counter - 1) % 7,
    startTime: '09:00',
    endTime: '17:00',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── listForBusiness ──────────────────────────────────────────────────────────

describe('listForBusiness', () => {
  it('returns all windows for the business', async () => {
    const windows = [makeWindow({ businessId: 'biz-x' }), makeWindow({ businessId: 'biz-x' })];
    mockListByBusiness.mockResolvedValue(windows);

    const result = await listForBusiness(mockDynamo, 'biz-x');

    expect(mockListByBusiness).toHaveBeenCalledWith(mockDynamo, 'biz-x');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when business has no windows', async () => {
    mockListByBusiness.mockResolvedValue([]);

    const result = await listForBusiness(mockDynamo, 'biz-empty');

    expect(result).toEqual([]);
  });
});

// ─── addWindow ────────────────────────────────────────────────────────────────

describe('addWindow', () => {
  it('creates a window when under both limits', async () => {
    mockCountByBusiness.mockResolvedValue(3);
    mockCountByBusinessAndDay.mockResolvedValue(0);
    mockPut.mockResolvedValue(undefined);

    const result = await addWindow(mockDynamo, {
      userId: 'biz-1',
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '17:00',
    });

    expect(result.businessId).toBe('biz-1');
    expect(result.dayOfWeek).toBe(1);
    expect(result.startTime).toBe('09:00');
    expect(result.endTime).toBe('17:00');
    expect(result.windowId).toBeTruthy();
    expect(result.createdAt).toBeTruthy();
    expect(mockPut).toHaveBeenCalledOnce();
  });

  it('sets createdAt to a current timestamp', async () => {
    mockCountByBusiness.mockResolvedValue(0);
    mockCountByBusinessAndDay.mockResolvedValue(0);
    mockPut.mockResolvedValue(undefined);

    const before = Date.now();
    const result = await addWindow(mockDynamo, {
      userId: 'biz-ts',
      dayOfWeek: 3,
      startTime: '10:00',
      endTime: '12:00',
    });
    const after = Date.now();

    const createdMs = new Date(result.createdAt).getTime();
    expect(createdMs).toBeGreaterThanOrEqual(before);
    expect(createdMs).toBeLessThanOrEqual(after);
  });

  it('throws WindowLimitError when business has 14 windows', async () => {
    mockCountByBusiness.mockResolvedValue(14);

    await expect(
      addWindow(mockDynamo, {
        userId: 'biz-full',
        dayOfWeek: 2,
        startTime: '08:00',
        endTime: '09:00',
      }),
    ).rejects.toBeInstanceOf(WindowLimitError);

    expect(mockPut).not.toHaveBeenCalled();
  });

  it('throws WindowDayLimitError when day already has 2 windows', async () => {
    mockCountByBusiness.mockResolvedValue(5);
    mockCountByBusinessAndDay.mockResolvedValue(2);

    await expect(
      addWindow(mockDynamo, {
        userId: 'biz-day-full',
        dayOfWeek: 0,
        startTime: '14:00',
        endTime: '16:00',
      }),
    ).rejects.toBeInstanceOf(WindowDayLimitError);

    expect(mockPut).not.toHaveBeenCalled();
  });

  it('checks total limit before day limit', async () => {
    mockCountByBusiness.mockResolvedValue(14);

    await expect(
      addWindow(mockDynamo, {
        userId: 'biz-both-full',
        dayOfWeek: 4,
        startTime: '09:00',
        endTime: '10:00',
      }),
    ).rejects.toBeInstanceOf(WindowLimitError);

    expect(mockCountByBusinessAndDay).not.toHaveBeenCalled();
  });
});

// ─── removeWindow ─────────────────────────────────────────────────────────────

describe('removeWindow', () => {
  it('deletes the window when ownership matches', async () => {
    const win = makeWindow({ businessId: 'owner-biz' });
    mockGetById.mockResolvedValue(win);
    mockDelete.mockResolvedValue(undefined);

    await removeWindow(mockDynamo, { userId: 'owner-biz', windowId: win.windowId });

    expect(mockDelete).toHaveBeenCalledWith(mockDynamo, win.windowId);
  });

  it('throws WindowNotFoundError when window does not exist', async () => {
    mockGetById.mockResolvedValue(undefined);

    await expect(
      removeWindow(mockDynamo, { userId: 'any-biz', windowId: 'missing-win' }),
    ).rejects.toBeInstanceOf(WindowNotFoundError);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('throws WindowOwnershipError when window belongs to another business', async () => {
    const win = makeWindow({ businessId: 'real-owner' });
    mockGetById.mockResolvedValue(win);

    await expect(
      removeWindow(mockDynamo, { userId: 'intruder', windowId: win.windowId }),
    ).rejects.toBeInstanceOf(WindowOwnershipError);

    expect(mockDelete).not.toHaveBeenCalled();
  });
});
