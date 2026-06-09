import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useApi, ApiError } from '../../hooks/useApi';
import { ErrorState } from '../../components/ui/ErrorState';
import type { WaitlistEntry, WaitlistStatus } from '@qulene/api-types';

const STATUS_STYLES: Record<WaitlistStatus, { bg: string; text: string; label: string }> = {
  ACTIVE:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Active' },
  PROMOTED: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Promoted' },
  REMOVED:  { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Removed' },
};

function StatusBadge({ status }: { status: WaitlistStatus }) {
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
      <View className="bg-gray-200 rounded h-3 w-28" />
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function WaitlistScreen() {
  const router = useRouter();
  const { request, requestWithCursor } = useApi();

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string, refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else if (!cursor) setIsLoading(true);
      else setIsLoadingMore(true);

      try {
        const path = cursor
          ? `/waitlist/me?cursor=${encodeURIComponent(cursor)}`
          : '/waitlist/me';
        const result = await requestWithCursor<WaitlistEntry[]>(path);
        if (refresh || !cursor) {
          setEntries(result.data);
        } else {
          setEntries((prev) => [...prev, ...result.data]);
        }
        setNextCursor(result.nextCursor);
      } catch {
        setFetchError('Failed to load waitlist entries');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [requestWithCursor],
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(() => {
    load(undefined, true);
  }, [load]);

  const handleLeave = (entry: WaitlistEntry) => {
    Alert.alert(
      'Leave Waitlist?',
      'Are you sure you want to leave this waitlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setActioning(entry.entryId);
            try {
              await request(`/waitlist/${entry.entryId}`, { method: 'DELETE' });
              setEntries((prev) =>
                prev.map((e) =>
                  e.entryId === entry.entryId ? { ...e, status: 'REMOVED' } : e,
                ),
              );
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Something went wrong.';
              Alert.alert('Error', msg);
            } finally {
              setActioning(null);
            }
          },
        },
      ],
    );
  };

  const handleBookNow = (entry: WaitlistEntry) => {
    router.push({
      pathname: '/(customer)/appointment-request/[serviceId]' as never,
      params: {
        serviceId: entry.serviceId,
        businessId: entry.businessId,
        businessName: '',
        serviceName: '',
        price: '0',
        durationMinutes: '0',
      },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white">
        <ScrollView className="flex-1 px-6">
          <Text className="text-2xl font-bold text-gray-900 mb-6">My Waitlist</Text>
          {[0, 1, 2].map((i) => (
            <SkeletonRow key={i} />
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
    <ScrollView
      className="flex-1 px-6"
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <Text className="text-2xl font-bold text-gray-900 mb-6">My Waitlist</Text>

      {fetchError ? (
        <ErrorState
          message={fetchError}
          onRetry={() => { setFetchError(null); load(); }}
        />
      ) : entries.length === 0 ? (
        <View className="items-center pt-20">
          <Text className="text-4xl mb-4">⏳</Text>
          <Text className="text-base font-semibold text-gray-800 mb-2">No waitlist entries</Text>
          <Text className="text-sm text-gray-500 text-center">
            Join one from a business detail screen.
          </Text>
        </View>
      ) : (
        <>
          {entries.map((entry) => (
            <View key={entry.entryId} className="border border-gray-200 rounded-xl p-4 mb-3">
              <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                    Service {entry.serviceId.slice(0, 8)}…
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Joined {formatDate(entry.createdAt)}
                  </Text>
                </View>
                <StatusBadge status={entry.status} />
              </View>

              {entry.status === 'ACTIVE' ? (
                <TouchableOpacity
                  className="mt-1 border border-red-400 rounded-lg py-1.5 items-center"
                  onPress={() => handleLeave(entry)}
                  disabled={actioning === entry.entryId}
                  activeOpacity={0.7}
                >
                  <Text className="text-red-500 text-sm font-medium">
                    {actioning === entry.entryId ? 'Leaving…' : 'Leave'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {entry.status === 'PROMOTED' ? (
                <TouchableOpacity
                  className="mt-1 bg-green-600 rounded-lg py-1.5 items-center"
                  onPress={() => handleBookNow(entry)}
                  activeOpacity={0.7}
                >
                  <Text className="text-white text-sm font-medium">Book Now</Text>
                </TouchableOpacity>
              ) : null}
            </View>
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
    </SafeAreaView>
  );
}
