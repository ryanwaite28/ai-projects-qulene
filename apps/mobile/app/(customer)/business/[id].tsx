import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCustomerApi } from '../../../hooks/useCustomerApi';
import { useApi, ApiError } from '../../../hooks/useApi';
import type { BusinessProfile, Service, AvailabilityWindow } from '@qulene/api-types';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function SkeletonBox({ w, h }: { w: string; h: string }) {
  return <View className={`bg-gray-200 rounded-xl ${w} ${h}`} />;
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function BusinessDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { fetchBusiness, fetchBusinessServices, fetchBusinessAvailability } = useCustomerApi();
  const { request } = useApi();

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [joiningServiceId, setJoiningServiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setNotFound(false);
      try {
        const [profile, svcs, avail] = await Promise.all([
          fetchBusiness(id),
          fetchBusinessServices(id),
          fetchBusinessAvailability(id),
        ]);
        if (cancelled) return;
        setBusiness(profile);
        setServices(svcs.filter((s) => s.status === 'ACTIVE'));
        setWindows(avail);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'NOT_FOUND') {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, fetchBusiness, fetchBusinessServices, fetchBusinessAvailability]);

  const handleServiceTap = (service: Service) => {
    if (!business) return;
    router.push({
      pathname: '/(customer)/appointment-request/[serviceId]' as never,
      params: {
        serviceId: service.serviceId,
        businessId: business.businessId,
        businessName: business.businessName ?? '',
        serviceName: service.name,
        price: String(service.price),
        durationMinutes: String(service.durationMinutes),
      },
    });
  };

  const handleJoinWaitlist = (svc: Service) => {
    Alert.alert(
      'Join Waitlist?',
      `Join the waitlist for ${svc.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: async () => {
            setJoiningServiceId(svc.serviceId);
            try {
              await request('/waitlist', {
                method: 'POST',
                body: JSON.stringify({ serviceId: svc.serviceId }),
              });
              Alert.alert('Added', "You're on the waitlist!");
            } catch (e) {
              if (e instanceof ApiError && e.code === 'CONFLICT') {
                Alert.alert('Already on waitlist', "You're already on the waitlist for this service.");
              } else if (e instanceof ApiError && e.code === 'NOT_FOUND') {
                Alert.alert('Not available', 'This service is no longer available.');
              } else {
                Alert.alert('Error', 'Something went wrong. Please try again.');
              }
            } finally {
              setJoiningServiceId(null);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-white px-6 pt-12">
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Text className="text-indigo-600 font-medium">‹ Back</Text>
        </TouchableOpacity>
        <View className="flex-row items-center mb-6">
          <SkeletonBox w="w-16" h="h-16" />
          <View className="flex-1 ml-4">
            <SkeletonBox w="w-48" h="h-6 mb-2" />
            <SkeletonBox w="w-28" h="h-4" />
          </View>
        </View>
        <SkeletonBox w="w-full" h="h-16 mb-6" />
        <SkeletonBox w="w-32" h="h-5 mb-3" />
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} w="w-full" h="h-14 mb-3" />
        ))}
        <SkeletonBox w="w-32" h="h-5 mb-3 mt-2" />
        {[0, 1, 2].map((i) => (
          <SkeletonBox key={i} w="w-full" h="h-10 mb-2" />
        ))}
      </ScrollView>
    );
  }

  if (notFound || !business) {
    return (
      <View className="flex-1 bg-white px-6 pt-12 items-center">
        <TouchableOpacity onPress={() => router.back()} className="self-start mb-8">
          <Text className="text-indigo-600 font-medium">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-4xl mb-4">🔍</Text>
        <Text className="text-lg font-semibold text-gray-900 mb-2">Business not found</Text>
        <Text className="text-sm text-gray-500 text-center">
          This business may no longer be available.
        </Text>
      </View>
    );
  }

  const windowsByDay = DAY_LABELS.map((_, i) => windows.filter((w) => w.dayOfWeek === i));

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 pt-12 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-indigo-600 font-medium">‹ Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View className="flex-row items-center mb-4">
          {business.avatarUrl ? (
            <Image
              source={{ uri: business.avatarUrl }}
              className="w-16 h-16 rounded-full bg-gray-200 mr-4"
            />
          ) : (
            <View className="w-16 h-16 rounded-full bg-indigo-100 items-center justify-center mr-4">
              <Text className="text-2xl">🏢</Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">
              {business.businessName ?? 'Unnamed Business'}
            </Text>
            {business.category ? (
              <Text className="text-sm text-indigo-600 font-medium mt-0.5">{business.category}</Text>
            ) : null}
            {business.city || business.state ? (
              <Text className="text-sm text-gray-500 mt-0.5">
                {[business.city, business.state].filter(Boolean).join(', ')}
              </Text>
            ) : null}
          </View>
        </View>

        {business.description ? (
          <View className="bg-gray-50 rounded-xl px-4 py-3 mb-4">
            <Text className="text-sm text-gray-600">{business.description}</Text>
          </View>
        ) : null}

        {business.address ? (
          <Text className="text-sm text-gray-500 mb-6">📍 {business.address}</Text>
        ) : null}
      </View>

      {/* Services */}
      <View className="px-6 mb-6">
        <Text className="text-lg font-bold text-gray-900 mb-3">Services</Text>
        {services.length === 0 ? (
          <View className="bg-gray-50 rounded-xl px-4 py-6 items-center">
            <Text className="text-sm text-gray-500">No services listed yet.</Text>
          </View>
        ) : (
          services.map((svc) => (
            <View
              key={svc.serviceId}
              className="border border-gray-200 rounded-xl px-4 py-3 mb-2"
            >
              <View className="mb-3">
                <Text className="text-base font-medium text-gray-900">{svc.name}</Text>
                <Text className="text-sm text-gray-500 mt-0.5">
                  {svc.durationMinutes} min · {formatPrice(svc.price)}
                </Text>
                {svc.description ? (
                  <Text className="text-sm text-gray-400 mt-0.5" numberOfLines={1}>
                    {svc.description}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 bg-indigo-600 rounded-lg py-2 items-center"
                  onPress={() => handleServiceTap(svc)}
                  activeOpacity={0.7}
                >
                  <Text className="text-white text-sm font-medium">Request Appointment</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 border border-indigo-600 rounded-lg py-2 items-center"
                  onPress={() => handleJoinWaitlist(svc)}
                  disabled={joiningServiceId === svc.serviceId}
                  activeOpacity={0.7}
                >
                  <Text className="text-indigo-600 text-sm font-medium">
                    {joiningServiceId === svc.serviceId ? 'Joining…' : 'Join Waitlist'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Availability */}
      <View className="px-6 mb-8">
        <Text className="text-lg font-bold text-gray-900 mb-3">Weekly Availability</Text>
        {windows.length === 0 ? (
          <View className="bg-gray-50 rounded-xl px-4 py-6 items-center">
            <Text className="text-sm text-gray-500">No availability hours set.</Text>
          </View>
        ) : (
          DAY_LABELS.map((dayLabel, dayIndex) => (
            <View key={dayIndex} className="flex-row items-start mb-3">
              <Text className="text-sm font-medium text-gray-700 w-28">{dayLabel}</Text>
              <View className="flex-1 flex-row flex-wrap gap-1">
                {windowsByDay[dayIndex].length === 0 ? (
                  <Text className="text-sm text-gray-400">—</Text>
                ) : (
                  windowsByDay[dayIndex].map((win) => (
                    <View
                      key={win.windowId}
                      className="bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1"
                    >
                      <Text className="text-xs text-indigo-800">
                        {win.startTime}–{win.endTime}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
