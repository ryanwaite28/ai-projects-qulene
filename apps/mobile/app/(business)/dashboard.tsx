import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useApi, ApiError } from '../../hooks/useApi';
import { ErrorState } from '../../components/ui/ErrorState';
import { AppointmentCard } from '../../components/ui/AppointmentCard';
import type { AppointmentRequest, AppointmentStatus } from '@qulene/api-types';

type FilterChip = 'ALL' | 'PENDING' | 'ACCEPTED' | 'PAST';

const PAST_STATUSES = new Set<AppointmentStatus>(['CANCELLED', 'DECLINED', 'COMPLETED', 'NO_SHOW']);

const CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'ALL',      label: 'All' },
  { key: 'PENDING',  label: 'Pending' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PAST',     label: 'Past' },
];

function buildPath(filter: FilterChip, cursor?: string) {
  const params = new URLSearchParams();
  if (filter === 'PENDING')  params.set('status', 'PENDING');
  if (filter === 'ACCEPTED') params.set('status', 'ACCEPTED');
  if (cursor) params.set('cursor', encodeURIComponent(cursor));
  const qs = params.toString();
  return `/businesses/me/appointments${qs ? `?${qs}` : ''}`;
}

function SkeletonRow() {
  return (
    <View className="border border-gray-100 rounded-xl p-4 mb-3">
      <View className="flex-row justify-between mb-2">
        <View className="bg-gray-200 rounded h-4 w-40" />
        <View className="bg-gray-200 rounded-full h-5 w-16" />
      </View>
      <View className="bg-gray-200 rounded h-3 w-32 mb-1" />
      <View className="bg-gray-200 rounded h-3 w-24" />
    </View>
  );
}

export default function DashboardScreen() {
  const { request, requestWithCursor } = useApi();

  const [activeFilter, setActiveFilter] = useState<FilterChip>('ALL');
  const [items, setItems] = useState<AppointmentRequest[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const applyFilter = useCallback(
    (filter: FilterChip, data: AppointmentRequest[]) =>
      filter === 'PAST' ? data.filter((r) => PAST_STATUSES.has(r.status)) : data,
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setItems([]);
    setNextCursor(null);

    requestWithCursor<AppointmentRequest[]>(buildPath(activeFilter))
      .then(({ data, nextCursor: nc }) => {
        if (cancelled) return;
        setItems(applyFilter(activeFilter, data));
        setNextCursor(nc);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(err instanceof ApiError ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeFilter, requestWithCursor, applyFilter, retryTick]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data, nextCursor: nc } = await requestWithCursor<AppointmentRequest[]>(
        buildPath(activeFilter),
      );
      setItems(applyFilter(activeFilter, data));
      setNextCursor(nc);
    } catch (err) {
      if (err instanceof ApiError) Alert.alert('Error', err.message);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeFilter, requestWithCursor, applyFilter]);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const { data, nextCursor: nc } = await requestWithCursor<AppointmentRequest[]>(
        buildPath(activeFilter, nextCursor),
      );
      setItems((prev) => [...prev, ...applyFilter(activeFilter, data)]);
      setNextCursor(nc);
    } catch (err) {
      if (err instanceof ApiError) Alert.alert('Error', err.message);
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore, activeFilter, requestWithCursor, applyFilter]);

  function performAction(
    requestId: string,
    actionPath: string,
    newStatus: AppointmentStatus,
    confirmMessage: string,
  ) {
    Alert.alert('Confirm', confirmMessage, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setActioningId(requestId);
          try {
            await request(`/businesses/me/appointments/${requestId}/${actionPath}`, {
              method: 'PATCH',
            });
            setItems((prev) =>
              prev.map((r) =>
                r.requestId === requestId ? { ...r, status: newStatus } : r,
              ),
            );
          } catch (err) {
            await handleRefresh();
            if (err instanceof ApiError) Alert.alert('Action failed', err.message);
          } finally {
            setActioningId(null);
          }
        },
      },
    ]);
  }

  const handleAccept  = (id: string) => performAction(id, 'accept',  'ACCEPTED',  'Accept this appointment request?');
  const handleDecline = (id: string) => performAction(id, 'decline', 'DECLINED',  'Decline this appointment request?');
  const handleComplete = (id: string) => performAction(id, 'complete', 'COMPLETED', 'Mark this appointment as completed?');
  const handleNoShow  = (id: string) => performAction(id, 'noshow',  'NO_SHOW',   'Mark this appointment as a no-show?');

  return (
    <ScrollView
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      <View className="px-4 pt-12 pb-10">
        <Text className="text-2xl font-bold text-gray-900 mb-4">Requests</Text>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4 -mx-1"
          contentContainerClassName="px-1"
        >
          {CHIPS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              className={`rounded-full px-4 py-2 mr-2 ${
                activeFilter === key ? 'bg-indigo-600' : 'bg-gray-100'
              }`}
              onPress={() => setActiveFilter(key)}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-medium ${
                  activeFilter === key ? 'text-white' : 'text-gray-600'
                }`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : fetchError ? (
          <ErrorState
            message={fetchError}
            onRetry={() => { setFetchError(null); setRetryTick((t) => t + 1); }}
          />
        ) : items.length === 0 ? (
          <View className="items-center pt-16">
            <Text className="text-4xl mb-4">📋</Text>
            <Text className="text-lg font-semibold text-gray-900 mb-2">No requests yet</Text>
            <Text className="text-sm text-gray-500 text-center px-6">
              Appointment requests from customers will appear here.
            </Text>
          </View>
        ) : (
          <>
            {items.map((item) => (
              <AppointmentCard
                key={item.requestId}
                item={item}
                context="BUSINESS"
                isActioning={actioningId === item.requestId}
                onAccept={handleAccept}
                onDecline={handleDecline}
                onComplete={handleComplete}
                onNoShow={handleNoShow}
              />
            ))}

            {nextCursor ? (
              <TouchableOpacity
                className={`rounded-xl py-3 items-center mt-2 ${
                  isLoadingMore ? 'bg-gray-100' : 'bg-indigo-50'
                }`}
                onPress={handleLoadMore}
                disabled={isLoadingMore}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-medium ${
                    isLoadingMore ? 'text-gray-400' : 'text-indigo-600'
                  }`}
                >
                  {isLoadingMore ? 'Loading…' : 'Load more'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
