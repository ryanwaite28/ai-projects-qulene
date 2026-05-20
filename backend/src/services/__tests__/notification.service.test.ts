import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  listForUser,
  markAsRead,
  NotificationNotFoundError,
  NotificationForbiddenError,
} from '../notification.service.js';
import * as notifTable from '../../db/tables/notifications.table.js';
import * as usersTable from '../../db/tables/users.table.js';
import type { Notification } from '@qulene/api-types';

vi.mock('../../db/tables/notifications.table.js');
vi.mock('../../db/tables/users.table.js');

const mockListByUser = vi.mocked(notifTable.listByUser);
const mockGetNotificationById = vi.mocked(notifTable.getNotificationById);
const mockMarkRead = vi.mocked(notifTable.markRead);
const mockDecrementUnread = vi.mocked(usersTable.decrementUnreadCount);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock
const mockDynamo = {} as DynamoDBDocumentClient;

let counter = 0;
const uid = () => `notif-${++counter}`;

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    notificationId: uid(),
    userId: uid(),
    type: 'REQUEST_RECEIVED',
    relatedId: uid(),
    message: 'Test notification',
    isRead: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listForUser', () => {
  it('returns paginated notifications for the user', async () => {
    const notif = makeNotification();
    mockListByUser.mockResolvedValue({ items: [notif], nextCursor: null });

    const result = await listForUser(mockDynamo, { userId: notif.userId });

    expect(mockListByUser).toHaveBeenCalledWith(mockDynamo, notif.userId, 20, undefined);
    expect(result.items).toEqual([notif]);
    expect(result.nextCursor).toBeNull();
  });

  it('passes cursor and custom limit through', async () => {
    mockListByUser.mockResolvedValue({ items: [], nextCursor: null });
    await listForUser(mockDynamo, { userId: 'u1', limit: 10, cursor: 'abc' });
    expect(mockListByUser).toHaveBeenCalledWith(mockDynamo, 'u1', 10, 'abc');
  });

  it('passes nextCursor from DynamoDB to caller', async () => {
    mockListByUser.mockResolvedValue({ items: [], nextCursor: 'cursor123' });
    const result = await listForUser(mockDynamo, { userId: 'u1' });
    expect(result.nextCursor).toBe('cursor123');
  });
});

describe('markAsRead', () => {
  it('marks unread notification as read and decrements unread count', async () => {
    const notif = makeNotification({ isRead: false });
    mockGetNotificationById.mockResolvedValue(notif);
    mockMarkRead.mockResolvedValue(undefined);
    mockDecrementUnread.mockResolvedValue(undefined);

    const result = await markAsRead(mockDynamo, { userId: notif.userId, notificationId: notif.notificationId });

    expect(mockMarkRead).toHaveBeenCalledWith(mockDynamo, notif.notificationId);
    expect(mockDecrementUnread).toHaveBeenCalledWith(mockDynamo, notif.userId);
    expect(result.isRead).toBe(true);
  });

  it('is idempotent — already-read notification returns without decrementing', async () => {
    const notif = makeNotification({ isRead: true });
    mockGetNotificationById.mockResolvedValue(notif);

    const result = await markAsRead(mockDynamo, { userId: notif.userId, notificationId: notif.notificationId });

    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(mockDecrementUnread).not.toHaveBeenCalled();
    expect(result.isRead).toBe(true);
  });

  it('throws NotificationNotFoundError when notification is missing', async () => {
    mockGetNotificationById.mockResolvedValue(undefined);

    await expect(
      markAsRead(mockDynamo, { userId: 'u1', notificationId: 'missing' }),
    ).rejects.toThrow(NotificationNotFoundError);
  });

  it('throws NotificationForbiddenError when userId does not match', async () => {
    const notif = makeNotification({ userId: 'owner-user' });
    mockGetNotificationById.mockResolvedValue(notif);

    await expect(
      markAsRead(mockDynamo, { userId: 'other-user', notificationId: notif.notificationId }),
    ).rejects.toThrow(NotificationForbiddenError);
  });
});
