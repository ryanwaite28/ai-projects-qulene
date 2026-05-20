import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  getMyProfile,
  updateMyName,
  UserNotFoundError,
  UserValidationError,
} from '../user.service.js';
import * as usersTable from '../../db/tables/users.table.js';
import type { User } from '../../types/index.js';

vi.mock('../../db/tables/users.table.js');

const mockGetUserById = vi.mocked(usersTable.getUserById);
const mockUpdateUserName = vi.mocked(usersTable.updateUserName);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockDynamo = {} as DynamoDBDocumentClient;

let counter = 0;
const uid = () => `user-${++counter}`;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    userId: uid(),
    email: `${uid()}@example.com`,
    firstName: 'Alice',
    lastName: 'Smith',
    role: 'CUSTOMER',
    unreadNotificationCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMyProfile', () => {
  it('returns user record', async () => {
    const user = makeUser();
    mockGetUserById.mockResolvedValue(user);

    const result = await getMyProfile(mockDynamo, user.userId);

    expect(mockGetUserById).toHaveBeenCalledWith(mockDynamo, user.userId);
    expect(result).toEqual(user);
  });

  it('includes unreadNotificationCount in returned record', async () => {
    const user = makeUser({ unreadNotificationCount: 5 });
    mockGetUserById.mockResolvedValue(user);

    const result = await getMyProfile(mockDynamo, user.userId);

    expect(result.unreadNotificationCount).toBe(5);
  });

  it('throws UserNotFoundError when user does not exist', async () => {
    mockGetUserById.mockResolvedValue(undefined);
    await expect(getMyProfile(mockDynamo, 'missing')).rejects.toThrow(UserNotFoundError);
  });
});

describe('updateMyName', () => {
  it('updates name and returns the refreshed user', async () => {
    const user = makeUser();
    const updated = { ...user, firstName: 'Bob', lastName: 'Jones' };
    mockUpdateUserName.mockResolvedValue(undefined);
    mockGetUserById.mockResolvedValue(updated);

    const result = await updateMyName(mockDynamo, {
      userId: user.userId,
      firstName: 'Bob',
      lastName: 'Jones',
    });

    expect(mockUpdateUserName).toHaveBeenCalledWith(mockDynamo, user.userId, 'Bob', 'Jones');
    expect(result.firstName).toBe('Bob');
    expect(result.lastName).toBe('Jones');
  });

  it('throws UserValidationError for empty firstName', async () => {
    await expect(
      updateMyName(mockDynamo, { userId: 'u1', firstName: '  ', lastName: 'Jones' }),
    ).rejects.toThrow(UserValidationError);
    expect(mockUpdateUserName).not.toHaveBeenCalled();
  });

  it('throws UserValidationError for empty lastName', async () => {
    await expect(
      updateMyName(mockDynamo, { userId: 'u1', firstName: 'Bob', lastName: '' }),
    ).rejects.toThrow(UserValidationError);
  });

  it('throws UserValidationError for firstName > 50 chars', async () => {
    await expect(
      updateMyName(mockDynamo, { userId: 'u1', firstName: 'A'.repeat(51), lastName: 'Jones' }),
    ).rejects.toThrow(UserValidationError);
  });

  it('throws UserValidationError for lastName > 50 chars', async () => {
    await expect(
      updateMyName(mockDynamo, { userId: 'u1', firstName: 'Bob', lastName: 'L'.repeat(51) }),
    ).rejects.toThrow(UserValidationError);
  });

  it('throws UserNotFoundError if user vanishes between update and re-fetch', async () => {
    mockUpdateUserName.mockResolvedValue(undefined);
    mockGetUserById.mockResolvedValue(undefined);
    await expect(
      updateMyName(mockDynamo, { userId: 'u1', firstName: 'Bob', lastName: 'Jones' }),
    ).rejects.toThrow(UserNotFoundError);
  });
});
