import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNotificationApi } from '../../hooks/useNotificationApi';
import { ErrorState } from '../../components/ui/ErrorState';
import type { Notification } from '@qulene/api-types';

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SkeletonRow() {
  return (
    <View className="border border-gray-100 rounded-xl p-4 mb-3">
      <View className="bg-gray-200 rounded h-4 w-3/4 mb-2" />
      <View className="bg-gray-200 rounded h-3 w-1/4" />
    </View>
  );
}

export default function NotificationsScreen() {
  const { listNotifications, markAsRead } = useNotificationApi();

  const [items, setItems] = useState<Notification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string, refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else if (!cursor) setIsLoading(true);
      else setIsLoadingMore(true);
      try {
        const result = await listNotifications(cursor);
        if (refresh || !cursor) {
          setItems(result.notifications);
        } else {
          setItems((prev) => [...prev, ...result.notifications]);
        }
        setNextCursor(result.nextCursor);
      } catch {
        setFetchError('Failed to load notifications');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [listNotifications],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(() => load(undefined, true), [load]);

  const handleMarkRead = useCallback(
    async (item: Notification) => {
      if (item.isRead || marking) return;
      setMarking(item.notificationId);
      try {
        await markAsRead(item.notificationId);
        setItems((prev) =>
          prev.map((n) =>
            n.notificationId === item.notificationId ? { ...n, isRead: true } : n,
          ),
        );
      } catch {
        Alert.alert('Error', 'Could not mark notification as read.');
      } finally {
        setMarking(null);
      }
    },
    [markAsRead, marking],
  );

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-white px-6 pt-14">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Notifications</Text>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white px-6 pt-14"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <Text className="text-2xl font-bold text-gray-900 mb-6">Notifications</Text>

      {fetchError ? (
        <ErrorState
          message={fetchError}
          onRetry={() => { setFetchError(null); load(); }}
        />
      ) : items.length === 0 ? (
        <View className="items-center pt-20">
          <Text className="text-4xl mb-4">🔔</Text>
          <Text className="text-base font-semibold text-gray-800 mb-2">No notifications yet</Text>
          <Text className="text-sm text-gray-500 text-center">
            You'll see updates about your appointments here.
          </Text>
        </View>
      ) : (
        <>
          {items.map((item) => (
            <TouchableOpacity
              key={item.notificationId}
              onPress={() => handleMarkRead(item)}
              activeOpacity={item.isRead ? 1 : 0.7}
              disabled={item.isRead}
            >
              <View
                className={`rounded-xl p-4 mb-3 border ${
                  item.isRead
                    ? 'bg-white border-gray-100'
                    : 'bg-indigo-50 border-indigo-200'
                }`}
              >
                <Text
                  className={`text-sm mb-1 ${
                    item.isRead ? 'text-gray-500 font-normal' : 'text-gray-900 font-semibold'
                  }`}
                >
                  {item.message}
                </Text>
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-gray-400">
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                  {!item.isRead ? (
                    <Text className="text-xs text-indigo-600 font-medium">
                      {marking === item.notificationId ? 'Marking…' : 'Tap to mark read'}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {nextCursor ? (
            <TouchableOpacity
              className="py-3 items-center mb-6"
              onPress={() => load(nextCursor)}
              disabled={isLoadingMore}
            >
              <Text className="text-indigo-600 text-sm font-medium">
                {isLoadingMore ? 'Loading…' : 'Load More'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
