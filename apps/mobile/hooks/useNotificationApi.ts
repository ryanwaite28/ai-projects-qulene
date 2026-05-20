import { useCallback } from 'react';
import { useApi } from './useApi';
import type { Notification } from '@qulene/api-types';

export function useNotificationApi() {
  const { request, requestWithCursor } = useApi();

  const listNotifications = useCallback(
    async (cursor?: string): Promise<{ notifications: Notification[]; nextCursor: string | null }> => {
      const path = cursor
        ? `/notifications?cursor=${encodeURIComponent(cursor)}`
        : '/notifications';
      const result = await requestWithCursor<Notification[]>(path);
      return { notifications: result.data, nextCursor: result.nextCursor };
    },
    [requestWithCursor],
  );

  const markAsRead = useCallback(
    (notificationId: string) =>
      request<Notification>(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
    [request],
  );

  return { listNotifications, markAsRead };
}
