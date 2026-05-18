import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrSyncUserProfile } from '../auth.service.js';
import * as usersTable from '../../db/tables/users.table.js';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { User } from '../../types/index.js';

vi.mock('../../db/tables/users.table.js');

const mockGetUserById = vi.mocked(usersTable.getUserById);
const mockPutUser = vi.mocked(usersTable.putUser);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock; not actually used by service
const mockDynamo = {} as DynamoDBDocumentClient;

let counter = 0;
function makeInput(overrides: Partial<Parameters<typeof createOrSyncUserProfile>[1]> = {}) {
  counter++;
  return {
    userId: `user-${counter}`,
    email: `user${counter}@example.com`,
    role: 'CUSTOMER' as const,
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };
}

describe('createOrSyncUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new user record when none exists (happy path)', async () => {
    mockGetUserById.mockResolvedValue(undefined);
    mockPutUser.mockResolvedValue(undefined);

    const input = makeInput();
    const result = await createOrSyncUserProfile(mockDynamo, input);

    expect(result.userId).toBe(input.userId);
    expect(result.email).toBe(input.email);
    expect(result.firstName).toBe(input.firstName);
    expect(result.lastName).toBe(input.lastName);
    expect(result.role).toBe(input.role);
    expect(result.unreadNotificationCount).toBe(0);
    expect(result.createdAt).toBeTruthy();
    expect(result.updatedAt).toBeTruthy();
    expect(mockPutUser).toHaveBeenCalledOnce();
    expect(mockPutUser).toHaveBeenCalledWith(mockDynamo, expect.objectContaining({ userId: input.userId }));
  });

  it('returns existing user without duplicate write (idempotent re-call)', async () => {
    const existing: User = {
      userId: 'existing-id',
      email: 'existing@example.com',
      firstName: 'Existing',
      lastName: 'User',
      role: 'BUSINESS',
      unreadNotificationCount: 3,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    mockGetUserById.mockResolvedValue(existing);

    const input = makeInput({ userId: 'existing-id' });
    const result = await createOrSyncUserProfile(mockDynamo, input);

    expect(result).toStrictEqual(existing);
    expect(mockPutUser).not.toHaveBeenCalled();
  });

  it('creates user with BUSINESS role', async () => {
    mockGetUserById.mockResolvedValue(undefined);
    mockPutUser.mockResolvedValue(undefined);

    const input = makeInput({ role: 'BUSINESS' });
    const result = await createOrSyncUserProfile(mockDynamo, input);

    expect(result.role).toBe('BUSINESS');
  });

  it('sets createdAt and updatedAt to the same ISO timestamp on creation', async () => {
    mockGetUserById.mockResolvedValue(undefined);
    mockPutUser.mockResolvedValue(undefined);

    const before = Date.now();
    const result = await createOrSyncUserProfile(mockDynamo, makeInput());
    const after = Date.now();

    const createdMs = new Date(result.createdAt).getTime();
    expect(createdMs).toBeGreaterThanOrEqual(before);
    expect(createdMs).toBeLessThanOrEqual(after);
    expect(result.createdAt).toBe(result.updatedAt);
  });
});
