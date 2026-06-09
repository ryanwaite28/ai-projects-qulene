import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ErrorState } from '../../components/ui/ErrorState';
import { useBusinessApi } from '../../hooks/useBusinessApi';
import { useApi, ApiError } from '../../hooks/useApi';
import type { Service, WaitlistEntry } from '@qulene/api-types';

function SkeletonBox({ w, h }: { w: string; h: string }) {
  return <View className={`bg-gray-200 rounded ${w} ${h}`} />;
}

interface ServiceForm {
  name: string;
  description: string;
  durationMinutes: string;
  priceDollars: string;
  status: 'ACTIVE' | 'PAUSED';
}

const EMPTY_FORM: ServiceForm = {
  name: '',
  description: '',
  durationMinutes: '60',
  priceDollars: '0',
  status: 'ACTIVE',
};

function serviceToForm(s: Service): ServiceForm {
  return {
    name: s.name,
    description: s.description,
    durationMinutes: String(s.durationMinutes),
    priceDollars: (s.price / 100).toFixed(2),
    status: s.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
  };
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ServicesScreen() {
  const router = useRouter();
  const { fetchServices, createService, updateService, deleteService } = useBusinessApi();
  const { request } = useApi();

  const [isLoading, setIsLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [waitlistCounts, setWaitlistCounts] = useState<Record<string, number>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setField = (key: keyof ServiceForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const loadWaitlistCounts = useCallback(async (items: Service[]) => {
    const counts: Record<string, number> = {};
    for (const svc of items.filter((s) => s.status !== 'DELETED')) {
      try {
        const entries = await request<WaitlistEntry[]>(`/businesses/me/waitlist/${svc.serviceId}`);
        counts[svc.serviceId] = entries.length;
      } catch {
        // silent — count stays absent (shows "–")
      }
    }
    setWaitlistCounts(counts);
  }, [request]);

  const loadServices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await fetchServices();
      setServices(items);
      void loadWaitlistCounts(items);
    } catch {
      setError('Failed to load services.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchServices, loadWaitlistCounts]);

  useEffect(() => { loadServices(); }, [loadServices]);

  const openCreate = () => {
    setEditingService(null);
    setForm(EMPTY_FORM);
    setModalError(null);
    setModalVisible(true);
  };

  const openEdit = (service: Service) => {
    setEditingService(service);
    setForm(serviceToForm(service));
    setModalError(null);
    setModalVisible(true);
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Name is required.';
    if (form.name.trim().length > 100) return 'Name must be 100 characters or fewer.';
    if (form.description.length > 1000) return 'Description must be 1000 characters or fewer.';
    const dur = parseInt(form.durationMinutes, 10);
    if (isNaN(dur) || dur < 15 || dur > 480) return 'Duration must be between 15 and 480 minutes.';
    const price = parseFloat(form.priceDollars);
    if (isNaN(price) || price < 0) return 'Price must be 0 or greater.';
    return null;
  };

  const handleSave = async () => {
    const validationErr = validateForm();
    if (validationErr) { setModalError(validationErr); return; }

    setIsSaving(true);
    setModalError(null);
    const priceCents = Math.round(parseFloat(form.priceDollars) * 100);
    const dur = parseInt(form.durationMinutes, 10);

    try {
      if (editingService) {
        const updated = await updateService(editingService.serviceId, {
          name: form.name.trim(),
          description: form.description.trim(),
          durationMinutes: dur,
          price: priceCents,
          status: form.status,
        });
        setServices((prev) => prev.map((s) => s.serviceId === updated.serviceId ? updated : s));
      } else {
        const created = await createService({
          name: form.name.trim(),
          description: form.description.trim(),
          durationMinutes: dur,
          price: priceCents,
          status: form.status,
        });
        setServices((prev) => [...prev, created]);
      }
      setModalVisible(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LIMIT_REACHED') {
        setModalError('You have reached the limit of 20 active services.');
      } else {
        setModalError(err instanceof Error ? err.message : 'Failed to save service.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (service: Service) => {
    Alert.alert(
      'Delete Service',
      `Delete "${service.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteService(service.serviceId);
              setServices((prev) => prev.filter((s) => s.serviceId !== service.serviceId));
            } catch {
              setError('Failed to delete service.');
            }
          },
        },
      ],
    );
  };

  const handleTogglePause = async (service: Service) => {
    const newStatus = service.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      const updated = await updateService(service.serviceId, { status: newStatus });
      setServices((prev) => prev.map((s) => s.serviceId === updated.serviceId ? updated : s));
    } catch {
      setError('Failed to update service status.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white px-6">
        <SkeletonBox w="w-40" h="h-8 mb-6" />
        {[0, 1, 2].map((i) => (
          <View key={i} className="mb-4 border border-gray-100 rounded-xl p-4">
            <SkeletonBox w="w-32" h="h-5 mb-2" />
            <SkeletonBox w="w-24" h="h-4 mb-1" />
            <SkeletonBox w="w-full" h="h-4" />
          </View>
        ))}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <View className="px-6 pb-4">
        <Text className="text-2xl font-bold text-gray-900">Services</Text>
      </View>

      {error && services.length === 0 ? (
        <ErrorState message={error} onRetry={loadServices} />
      ) : (
        <>
          {error && (
            <View className="mx-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm">{error}</Text>
            </View>
          )}

      <ScrollView className="flex-1 px-6">
        {services.length === 0 ? (
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-4xl mb-4">✂️</Text>
            <Text className="text-lg font-semibold text-gray-900 mb-1">No services yet</Text>
            <Text className="text-sm text-gray-500 text-center">
              Tap the + button to add your first service offering.
            </Text>
          </View>
        ) : (
          services.map((service) => (
            <View
              key={service.serviceId}
              className="mb-3 border border-gray-200 rounded-xl p-4"
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-base font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
                  {service.name}
                </Text>
                <View
                  className={`px-2 py-0.5 rounded-full ${service.status === 'ACTIVE' ? 'bg-green-100' : 'bg-yellow-100'}`}
                >
                  <Text
                    className={`text-xs font-medium ${service.status === 'ACTIVE' ? 'text-green-700' : 'text-yellow-700'}`}
                  >
                    {service.status}
                  </Text>
                </View>
              </View>

              <Text className="text-sm text-gray-500 mb-2">
                {service.durationMinutes} min · {formatPrice(service.price)}
              </Text>

              {service.description ? (
                <Text className="text-sm text-gray-600 mb-3" numberOfLines={2}>
                  {service.description}
                </Text>
              ) : null}

              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 border border-gray-300 rounded-lg py-2 items-center"
                  onPress={() => openEdit(service)}
                >
                  <Text className="text-sm font-medium text-gray-700">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 border border-gray-300 rounded-lg py-2 items-center"
                  onPress={() => handleTogglePause(service)}
                >
                  <Text className="text-sm font-medium text-gray-700">
                    {service.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 border border-red-200 rounded-lg py-2 items-center"
                  onPress={() => handleDelete(service)}
                >
                  <Text className="text-sm font-medium text-red-600">Delete</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                className="mt-2 py-1.5 items-center"
                onPress={() =>
                  router.push({
                    pathname: '/(business)/waitlist/[serviceId]' as never,
                    params: { serviceId: service.serviceId, serviceName: service.name },
                  })
                }
              >
                <Text className="text-indigo-600 text-sm font-medium">
                  {`View Waitlist (${waitlistCounts[service.serviceId] !== undefined ? waitlistCounts[service.serviceId] : '…'})`}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
        <View className="h-24" />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-indigo-600 rounded-full items-center justify-center shadow-lg"
        onPress={openCreate}
      >
        <Text className="text-white text-3xl leading-none">+</Text>
      </TouchableOpacity>
        </>
      )}

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <ScrollView className="flex-1 bg-white px-6 pt-8">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold text-gray-900">
              {editingService ? 'Edit Service' : 'New Service'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text className="text-indigo-600 font-medium">Cancel</Text>
            </TouchableOpacity>
          </View>

          {modalError && (
            <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
              <Text className="text-red-700 text-sm">{modalError}</Text>
            </View>
          )}

          <Text className="text-sm font-medium text-gray-700 mb-1">Name *</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base text-gray-900"
            value={form.name}
            onChangeText={setField('name')}
            placeholder="e.g. Classic Haircut"
            editable={!isSaving}
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">Description</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base text-gray-900"
            value={form.description}
            onChangeText={setField('description')}
            placeholder="Describe this service..."
            multiline
            numberOfLines={3}
            editable={!isSaving}
          />

          <View className="flex-row gap-4 mb-4">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">Duration (min)</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
                value={form.durationMinutes}
                onChangeText={setField('durationMinutes')}
                keyboardType="numeric"
                placeholder="60"
                editable={!isSaving}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">Price ($)</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
                value={form.priceDollars}
                onChangeText={setField('priceDollars')}
                keyboardType="decimal-pad"
                placeholder="0.00"
                editable={!isSaving}
              />
            </View>
          </View>

          <Text className="text-sm font-medium text-gray-700 mb-2">Status</Text>
          <View className="flex-row gap-3 mb-6">
            {(['ACTIVE', 'PAUSED'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                className={`flex-1 py-3 rounded-lg items-center border ${
                  form.status === s ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'
                }`}
                onPress={() => setForm((prev) => ({ ...prev, status: s }))}
              >
                <Text
                  className={`text-sm font-medium ${form.status === s ? 'text-white' : 'text-gray-700'}`}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            className={`rounded-lg py-4 items-center mb-12 ${isSaving ? 'bg-indigo-300' : 'bg-indigo-600'}`}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">
                {editingService ? 'Save Changes' : 'Create Service'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}
