import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApi, ApiError } from '../../hooks/useApi';
import { ErrorState } from '../../components/ui/ErrorState';
import type { AppointmentRequest, AppointmentStatus } from '@qulene/api-types';

const STATUS_STYLES: Record<AppointmentStatus, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  ACCEPTED:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Accepted' },
  DECLINED:  { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Declined' },
  CANCELLED: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Cancelled' },
  COMPLETED: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Completed' },
  NO_SHOW:   { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'No-Show' },
};

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <View className={`rounded-full px-3 py-1 ${s.bg}`}>
      <Text className={`text-xs font-medium ${s.text}`}>{s.label}</Text>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View className="border border-gray-100 rounded-xl p-4 mb-3">
      <View className="flex-row justify-between mb-2">
        <View className="bg-gray-200 rounded h-4 w-40" />
        <View className="bg-gray-200 rounded-full h-5 w-16" />
      </View>
      <View className="bg-gray-200 rounded h-3 w-28 mb-1" />
      <View className="bg-gray-200 rounded h-3 w-20" />
    </View>
  );
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function AppointmentsScreen() {
  const { request, requestWithCursor } = useApi();

  const [items, setItems] = useState<AppointmentRequest[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string, replace = false) => {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    try {
      const { data, nextCursor: nc } = await requestWithCursor<AppointmentRequest[]>(
        `/appointments/me${qs}`,
      );
      setItems((prev) => (replace ? data : [...prev, ...data]));
      setNextCursor(nc);
    } catch (err) {
      setFetchError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }, [requestWithCursor]);

  // Initial load using useEffect equivalent — called once via a ref trick
  const [loaded, setLoaded] = useState(false);
  if (!loaded) {
    setLoaded(true);
    load(undefined, true).finally(() => setIsLoading(false));
  }

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load(undefined, true);
    setIsRefreshing(false);
  }, [load]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    await load(nextCursor, false);
    setIsLoadingMore(false);
  }, [nextCursor, isLoadingMore, load]);

  const handleRetry = useCallback(() => {
    setFetchError(null);
    setIsLoading(true);
    load(undefined, true).finally(() => setIsLoading(false));
  }, [load]);

  const handleCancel = useCallback((item: AppointmentRequest) => {
    Alert.alert(
      'Cancel appointment',
      'Are you sure you want to cancel this request?',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel request',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(item.requestId);
            try {
              await request(`/appointments/${item.requestId}`, { method: 'DELETE' });
              setItems((prev) =>
                prev.map((r) =>
                  r.requestId === item.requestId ? { ...r, status: 'CANCELLED' } : r,
                ),
              );
            } catch (err) {
              await load(undefined, true);
              if (err instanceof ApiError) {
                Alert.alert('Could not cancel', err.message);
              }
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  }, [request, load]);

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white">
        <ScrollView className="flex-1 px-4">
          <Text className="text-2xl font-bold text-gray-900 mb-6">My Appointments</Text>
          {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
    <ScrollView
      className="flex-1"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      <View className="px-4 pt-4 pb-10">
        <Text className="text-2xl font-bold text-gray-900 mb-6">My Appointments</Text>

        {fetchError ? (
          <ErrorState message={fetchError} onRetry={handleRetry} />
        ) : items.length === 0 ? (
          <View className="flex-1 items-center pt-16">
            <Text className="text-4xl mb-4">📅</Text>
            <Text className="text-lg font-semibold text-gray-900 mb-2">No appointments yet</Text>
            <Text className="text-sm text-gray-500 text-center px-6">
              Browse businesses to book your first appointment.
            </Text>
          </View>
        ) : (
          <>
            {items.map((item) => {
              const canCancel = item.status === 'PENDING' || item.status === 'ACCEPTED';
              const isCancelling = cancellingId === item.requestId;
              return (
                <View
                  key={item.requestId}
                  className="border border-gray-100 rounded-xl p-4 mb-3 bg-white shadow-sm"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <Text className="text-sm font-medium text-gray-900 flex-1 mr-2" numberOfLines={1}>
                      {item.serviceId}
                    </Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <Text className="text-sm text-gray-500 mb-1">
                    📅 {formatDateTime(item.proposedAt)}
                  </Text>
                  {item.notes ? (
                    <Text className="text-sm text-gray-400 mb-2" numberOfLines={2}>
                      {item.notes}
                    </Text>
                  ) : null}
                  {canCancel ? (
                    <TouchableOpacity
                      className={`mt-2 rounded-lg py-2 items-center ${isCancelling ? 'bg-gray-100' : 'bg-red-50'}`}
                      onPress={() => handleCancel(item)}
                      disabled={isCancelling}
                      activeOpacity={0.7}
                    >
                      <Text className={`text-sm font-medium ${isCancelling ? 'text-gray-400' : 'text-red-600'}`}>
                        {isCancelling ? 'Cancelling…' : 'Cancel request'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}

            {nextCursor ? (
              <TouchableOpacity
                className={`rounded-xl py-3 items-center mt-2 ${isLoadingMore ? 'bg-gray-100' : 'bg-indigo-50'}`}
                onPress={handleLoadMore}
                disabled={isLoadingMore}
                activeOpacity={0.7}
              >
                <Text className={`text-sm font-medium ${isLoadingMore ? 'text-gray-400' : 'text-indigo-600'}`}>
                  {isLoadingMore ? 'Loading…' : 'Load more'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}
