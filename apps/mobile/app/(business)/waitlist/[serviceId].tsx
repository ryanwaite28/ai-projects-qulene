import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApi } from '../../../hooks/useApi';
import type { WaitlistEntry } from '@qulene/api-types';

function SkeletonRow() {
  return (
    <View className="flex-row items-center border border-gray-100 rounded-xl px-4 py-3 mb-3">
      <View className="w-8 h-8 bg-gray-200 rounded-full mr-3" />
      <View className="flex-1">
        <View className="bg-gray-200 rounded h-4 w-24 mb-1" />
        <View className="bg-gray-200 rounded h-3 w-32" />
      </View>
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

export default function BusinessWaitlistScreen() {
  const { serviceId, serviceName } = useLocalSearchParams<{
    serviceId: string;
    serviceName: string;
  }>();
  const router = useRouter();
  const { request } = useApi();

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) return;
    setIsLoading(true);
    try {
      const data = await request<WaitlistEntry[]>(`/businesses/me/waitlist/${serviceId}`);
      setEntries(data);
    } catch {
      // silent — empty state covers this
    } finally {
      setIsLoading(false);
    }
  }, [request, serviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const title = serviceName ? `${serviceName} — Waitlist` : 'Waitlist';

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-white px-6 pt-14">
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Text className="text-indigo-600 font-medium">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900 mb-6">{title}</Text>
        {[0, 1, 2].map((i) => (
          <SkeletonRow key={i} />
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white px-6 pt-14">
      <TouchableOpacity onPress={() => router.back()} className="mb-6">
        <Text className="text-indigo-600 font-medium">‹ Back</Text>
      </TouchableOpacity>

      <Text className="text-2xl font-bold text-gray-900 mb-2">{title}</Text>
      <Text className="text-sm text-gray-500 mb-6">
        {entries.length} {entries.length === 1 ? 'customer' : 'customers'} waiting
      </Text>

      {entries.length === 0 ? (
        <View className="items-center pt-20">
          <Text className="text-4xl mb-4">⏳</Text>
          <Text className="text-base font-semibold text-gray-800 mb-2">No customers on the waitlist</Text>
          <Text className="text-sm text-gray-500 text-center">
            Customers can join from the business detail screen.
          </Text>
        </View>
      ) : (
        entries.map((entry, index) => (
          <View
            key={entry.entryId}
            className="flex-row items-center border border-gray-100 rounded-xl px-4 py-3 mb-3"
          >
            <View className="w-8 h-8 bg-indigo-100 rounded-full items-center justify-center mr-3">
              <Text className="text-xs font-bold text-indigo-700">#{index + 1}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-900">Customer</Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                Joined {formatDate(entry.createdAt)}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
