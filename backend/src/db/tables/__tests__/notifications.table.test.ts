import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Notification } from '@qulene/api-types';
import {
  getNotificationById,
  listByUser,
  putNotification,
  markRead,
} from '../notifications.table.js';

let counter = 0;
function makeNotification(overrides: Partial<Notification> = {}): Notification {
  const n = ++counter;
  return {
    notificationId: `notif-${n}`,
    userId: `user-${n}`,
    type: 'REQUEST_RECEIVED',
    relatedId: `req-${n}`,
    message: `Notification ${n}`,
    isRead: false,
    createdAt: `2026-05-01T0${n % 10}:00:00.000Z`,
    ...overrides,
  };
}

function makeMockClient(sendReturn: unknown = {}): DynamoDBDocumentClient {
  return { send: vi.fn().mockResolvedValue(sendReturn) } as unknown as DynamoDBDocumentClient;
}

describe('notifications.table', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('getNotificationById', () => {
    it('returns the item when found', async () => {
      const notif = makeNotification();
      const dynamo = makeMockClient({ Item: notif });
      const result = await getNotificationById(dynamo, notif.notificationId);
      expect(result).toEqual(notif);
      expect(dynamo.send).toHaveBeenCalledOnce();
    });

    it('returns undefined when not found', async () => {
      const dynamo = makeMockClient({ Item: undefined });
      const result = await getNotificationById(dynamo, 'missing');
      expect(result).toBeUndefined();
    });
  });

  describe('listByUser', () => {
    it('returns items and null cursor when no LastEvaluatedKey', async () => {
      const notifs = [makeNotification(), makeNotification()];
      const dynamo = makeMockClient({ Items: notifs, LastEvaluatedKey: undefined });
      const result = await listByUser(dynamo, 'user-1', 20, undefined);
      expect(result.items).toEqual(notifs);
      expect(result.nextCursor).toBeNull();
    });

    it('returns base64 nextCursor when LastEvaluatedKey present', async () => {
      const lastKey = { notificationId: 'n-99', userId: 'user-1', createdAt: 't' };
      const dynamo = makeMockClient({ Items: [], LastEvaluatedKey: lastKey });
      const result = await listByUser(dynamo, 'user-1', 20, undefined);
      expect(result.nextCursor).toBe(
        Buffer.from(JSON.stringify(lastKey)).toString('base64'),
      );
    });
  });

  describe('putNotification', () => {
    it('calls send once and returns void', async () => {
      const dynamo = makeMockClient({});
      const result = await putNotification(dynamo, makeNotification());
      expect(result).toBeUndefined();
      expect(dynamo.send).toHaveBeenCalledOnce();
    });
  });

  describe('markRead', () => {
    it('calls send once with SET isRead = :t', async () => {
      const dynamo = makeMockClient({});
      await markRead(dynamo, 'notif-1');
      expect(dynamo.send).toHaveBeenCalledOnce();
      const call = (dynamo.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.input.UpdateExpression).toBe('SET isRead = :t');
      expect(call.input.ExpressionAttributeValues[':t']).toBe(true);
    });
  });
});
