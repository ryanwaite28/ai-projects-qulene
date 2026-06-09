import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useApi, ApiError } from '../../hooks/useApi';
import { ErrorState } from '../../components/ui/ErrorState';
import type {
  AppointmentRequest, AppointmentStatus,
  WaitlistEntry, WaitlistStatus,
} from '@qulene/api-types';

type ActivityTab = 'appointments' | 'waitlist';

const APPT_STATUS: Record<AppointmentStatus, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  ACCEPTED:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Accepted' },
  DECLINED:  { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Declined' },
  CANCELLED: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Cancelled' },
  COMPLETED: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Completed' },
  NO_SHOW:   { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'No-Show' },
};

const WL_STATUS: Record<WaitlistStatus, { bg: string; text: string; label: string }> = {
  ACTIVE:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Active' },
  PROMOTED: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Promoted' },
  REMOVED:  { bg: 'bg-gray-100',   text: 'text-gray-500',   label: 'Removed' },
};

function StatusBadge({ bg, text, label }: { bg: string; text: string; label: string }) {
  return (
    <View className={`rounded-full px-3 py-1 ${bg}`}>
      <Text className={`text-xs font-medium ${text}`}>{label}</Text>
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
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

export default function ActivityScreen() {
  const router = useRouter();
  const { request, requestWithCursor } = useApi();
  const [activeTab, setActiveTab] = useState<ActivityTab>('appointments');

  // Appointments state
  const [appts, setAppts] = useState<AppointmentRequest[]>([]);
  const [apptCursor, setApptCursor] = useState<string | null>(null);
  const [apptLoading, setApptLoading] = useState(true);
  const [apptRefreshing, setApptRefreshing] = useState(false);
  const [apptLoadingMore, setApptLoadingMore] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [apptError, setApptError] = useState<string | null>(null);

  // Waitlist state
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [wlCursor, setWlCursor] = useState<string | null>(null);
  const [wlLoading, setWlLoading] = useState(false);
  const [wlRefreshing, setWlRefreshing] = useState(false);
  const [wlLoadingMore, setWlLoadingMore] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [wlError, setWlError] = useState<string | null>(null);
  const wlLoaded = useRef(false);

  // Appointments logic
  const loadAppts = useCallback(async (cursor?: string, replace = false) => {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    try {
      const { data, nextCursor: nc } = await requestWithCursor<AppointmentRequest[]>(`/appointments/me${qs}`);
      setAppts((prev) => (replace ? data : [...prev, ...data]));
      setApptCursor(nc);
    } catch (err) {
      setApptError(err instanceof ApiError ? err.message : 'Failed to load appointments');
    }
  }, [requestWithCursor]);

  const handleCancelAppt = useCallback((item: AppointmentRequest) => {
    Alert.alert('Cancel appointment', 'Are you sure?', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel request', style: 'destructive',
        onPress: async () => {
          setCancellingId(item.requestId);
          try {
            await request(`/appointments/${item.requestId}`, { method: 'DELETE' });
            setAppts((prev) =>
              prev.map((r) => r.requestId === item.requestId ? { ...r, status: 'CANCELLED' } : r),
            );
          } catch (err) {
            await loadAppts(undefined, true);
            if (err instanceof ApiError) Alert.alert('Could not cancel', err.message);
          } finally { setCancellingId(null); }
        },
      },
    ]);
  }, [request, loadAppts]);

  // Waitlist logic
  const loadWl = useCallback(async (cursor?: string, refresh = false) => {
    if (refresh) setWlRefreshing(true);
    else if (!cursor) setWlLoading(true);
    else setWlLoadingMore(true);
    try {
      const path = cursor ? `/waitlist/me?cursor=${encodeURIComponent(cursor)}` : '/waitlist/me';
      const result = await requestWithCursor<WaitlistEntry[]>(path);
      if (refresh || !cursor) setEntries(result.data);
      else setEntries((prev) => [...prev, ...result.data]);
      setWlCursor(result.nextCursor);
    } catch { setWlError('Failed to load waitlist'); }
    finally {
      setWlLoading(false);
      setWlRefreshing(false);
      setWlLoadingMore(false);
    }
  }, [requestWithCursor]);

  const handleLeaveWl = (entry: WaitlistEntry) => {
    Alert.alert('Leave Waitlist?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          setActioningId(entry.entryId);
          try {
            await request(`/waitlist/${entry.entryId}`, { method: 'DELETE' });
            setEntries((prev) =>
              prev.map((e) => e.entryId === entry.entryId ? { ...e, status: 'REMOVED' } : e),
            );
          } catch (e) {
            Alert.alert('Error', e instanceof ApiError ? e.message : 'Something went wrong.');
          } finally { setActioningId(null); }
        },
      },
    ]);
  };

  const handleBookNow = (entry: WaitlistEntry) => {
    router.push({
      pathname: '/(customer)/appointment-request/[serviceId]' as never,
      params: {
        serviceId: entry.serviceId, businessId: entry.businessId,
        businessName: '', serviceName: '', price: '0', durationMinutes: '0',
      },
    });
  };

  // Load appointments on mount; lazy-load waitlist when tab first opens
  useEffect(() => {
    loadAppts(undefined, true).finally(() => setApptLoading(false));
  }, [loadAppts]);

  useEffect(() => {
    if (activeTab === 'waitlist' && !wlLoaded.current) {
      wlLoaded.current = true;
      loadWl();
    }
  }, [activeTab, loadWl]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      {/* Header + tab toggle */}
      <View className="px-4 pt-2 pb-3">
        <Text className="text-2xl font-bold text-gray-900 mb-3">Activity</Text>
        <View className="flex-row gap-2">
          {(['appointments', 'waitlist'] as ActivityTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              className={`flex-1 py-2 rounded-lg items-center ${activeTab === tab ? 'bg-indigo-600' : 'bg-gray-100'}`}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-medium ${activeTab === tab ? 'text-white' : 'text-gray-600'}`}>
                {tab === 'appointments' ? 'Appointments' : 'Waitlist'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Appointments */}
      {activeTab === 'appointments' && (
        apptLoading ? (
          <ScrollView className="flex-1 px-4">
            {[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </ScrollView>
        ) : (
          <ScrollView
            className="flex-1"
            refreshControl={
              <RefreshControl
                refreshing={apptRefreshing}
                onRefresh={async () => { setApptRefreshing(true); await loadAppts(undefined, true); setApptRefreshing(false); }}
              />
            }
          >
            <View className="px-4 pb-10">
              {apptError ? (
                <ErrorState
                  message={apptError}
                  onRetry={() => { setApptError(null); setApptLoading(true); loadAppts(undefined, true).finally(() => setApptLoading(false)); }}
                />
              ) : appts.length === 0 ? (
                <View className="items-center pt-16">
                  <Text className="text-4xl mb-4">📅</Text>
                  <Text className="text-lg font-semibold text-gray-900 mb-2">No appointments yet</Text>
                  <Text className="text-sm text-gray-500 text-center px-6">Browse businesses to book your first appointment.</Text>
                </View>
              ) : (
                <>
                  {appts.map((item) => {
                    const s = APPT_STATUS[item.status];
                    const canCancel = item.status === 'PENDING' || item.status === 'ACCEPTED';
                    return (
                      <View key={item.requestId} className="border border-gray-100 rounded-xl p-4 mb-3 bg-white shadow-sm">
                        <View className="flex-row justify-between items-start mb-2">
                          <Text className="text-sm font-medium text-gray-900 flex-1 mr-2" numberOfLines={1}>{item.serviceId}</Text>
                          <StatusBadge bg={s.bg} text={s.text} label={s.label} />
                        </View>
                        <Text className="text-sm text-gray-500 mb-1">📅 {formatDateTime(item.proposedAt)}</Text>
                        {item.notes ? <Text className="text-sm text-gray-400 mb-2" numberOfLines={2}>{item.notes}</Text> : null}
                        {canCancel ? (
                          <TouchableOpacity
                            className={`mt-2 rounded-lg py-2 items-center ${cancellingId === item.requestId ? 'bg-gray-100' : 'bg-red-50'}`}
                            onPress={() => handleCancelAppt(item)}
                            disabled={cancellingId === item.requestId}
                            activeOpacity={0.7}
                          >
                            <Text className={`text-sm font-medium ${cancellingId === item.requestId ? 'text-gray-400' : 'text-red-600'}`}>
                              {cancellingId === item.requestId ? 'Cancelling…' : 'Cancel request'}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                  {apptCursor ? (
                    <TouchableOpacity
                      className={`rounded-xl py-3 items-center mt-2 ${apptLoadingMore ? 'bg-gray-100' : 'bg-indigo-50'}`}
                      onPress={() => { setApptLoadingMore(true); loadAppts(apptCursor, false).finally(() => setApptLoadingMore(false)); }}
                      disabled={apptLoadingMore}
                      activeOpacity={0.7}
                    >
                      <Text className={`text-sm font-medium ${apptLoadingMore ? 'text-gray-400' : 'text-indigo-600'}`}>
                        {apptLoadingMore ? 'Loading…' : 'Load more'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          </ScrollView>
        )
      )}

      {/* Waitlist */}
      {activeTab === 'waitlist' && (
        wlLoading ? (
          <ScrollView className="flex-1 px-4">
            {[0, 1, 2].map((i) => <SkeletonRow key={i} />)}
          </ScrollView>
        ) : (
          <ScrollView
            className="flex-1"
            refreshControl={<RefreshControl refreshing={wlRefreshing} onRefresh={() => loadWl(undefined, true)} />}
          >
            <View className="px-4 pb-10">
              {wlError ? (
                <ErrorState message={wlError} onRetry={() => { setWlError(null); loadWl(); }} />
              ) : entries.length === 0 ? (
                <View className="items-center pt-16">
                  <Text className="text-4xl mb-4">⏳</Text>
                  <Text className="text-lg font-semibold text-gray-900 mb-2">No waitlist entries</Text>
                  <Text className="text-sm text-gray-500 text-center">Join one from a business detail screen.</Text>
                </View>
              ) : (
                <>
                  {entries.map((entry) => {
                    const s = WL_STATUS[entry.status];
                    return (
                      <View key={entry.entryId} className="border border-gray-200 rounded-xl p-4 mb-3">
                        <View className="flex-row justify-between items-start mb-2">
                          <View className="flex-1 mr-3">
                            <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
                              Service {entry.serviceId.slice(0, 8)}…
                            </Text>
                            <Text className="text-xs text-gray-400 mt-0.5">Joined {formatDate(entry.createdAt)}</Text>
                          </View>
                          <StatusBadge bg={s.bg} text={s.text} label={s.label} />
                        </View>
                        {entry.status === 'ACTIVE' ? (
                          <TouchableOpacity
                            className="mt-1 border border-red-400 rounded-lg py-1.5 items-center"
                            onPress={() => handleLeaveWl(entry)}
                            disabled={actioningId === entry.entryId}
                            activeOpacity={0.7}
                          >
                            <Text className="text-red-500 text-sm font-medium">
                              {actioningId === entry.entryId ? 'Leaving…' : 'Leave'}
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
                    );
                  })}
                  {wlCursor ? (
                    <TouchableOpacity
                      className="py-3 items-center mb-6"
                      onPress={() => loadWl(wlCursor)}
                      disabled={wlLoadingMore}
                      activeOpacity={0.7}
                    >
                      <Text className="text-indigo-600 text-sm font-medium">
                        {wlLoadingMore ? 'Loading…' : 'Load More'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          </ScrollView>
        )
      )}
    </SafeAreaView>
  );
}
