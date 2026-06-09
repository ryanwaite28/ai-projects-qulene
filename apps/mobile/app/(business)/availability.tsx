import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBusinessApi } from '../../hooks/useBusinessApi';
import { ApiError } from '../../hooks/useApi';
import type { AvailabilityWindow } from '@qulene/api-types';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function SkeletonBox({ w, h }: { w: string; h: string }) {
  return <View className={`bg-gray-200 rounded ${w} ${h}`} />;
}

export default function AvailabilityScreen() {
  const { fetchAvailability, addAvailabilityWindow, removeAvailabilityWindow } = useBusinessApi();

  const [isLoading, setIsLoading] = useState(true);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const loadWindows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAvailability();
      setWindows(data);
    } catch {
      setError('Failed to load availability.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchAvailability]);

  useEffect(() => { loadWindows(); }, [loadWindows]);

  const openAddModal = (day: number) => {
    setSelectedDay(day);
    setStartTime('09:00');
    setEndTime('17:00');
    setModalError(null);
    setModalVisible(true);
  };

  const handleAdd = async () => {
    if (!TIME_RE.test(startTime)) {
      setModalError('Start time must be in HH:MM format (e.g. 09:00).');
      return;
    }
    if (!TIME_RE.test(endTime)) {
      setModalError('End time must be in HH:MM format (e.g. 17:00).');
      return;
    }
    if (endTime <= startTime) {
      setModalError('End time must be after start time.');
      return;
    }

    setIsAdding(true);
    setModalError(null);
    try {
      const window = await addAvailabilityWindow({
        dayOfWeek: selectedDay,
        startTime,
        endTime,
      });
      setWindows((prev) => [...prev, window]);
      setModalVisible(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LIMIT_REACHED') {
        setModalError('You have reached the maximum of 14 availability windows.');
      } else if (err instanceof ApiError && err.code === 'DAY_LIMIT_REACHED') {
        setModalError('You can only add 2 windows per day.');
      } else {
        setModalError(err instanceof Error ? err.message : 'Failed to add window.');
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (windowId: string) => {
    try {
      await removeAvailabilityWindow(windowId);
      setWindows((prev) => prev.filter((w) => w.windowId !== windowId));
    } catch {
      setError('Failed to remove window.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView edges={['top']} className="flex-1 bg-white px-6">
        <SkeletonBox w="w-48" h="h-8 mb-6" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} className="mb-4">
            <SkeletonBox w="w-28" h="h-5 mb-2" />
            <SkeletonBox w="w-full" h="h-10" />
          </View>
        ))}
      </SafeAreaView>
    );
  }

  const windowsByDay = DAY_LABELS.map((_, dayIndex) =>
    windows.filter((w) => w.dayOfWeek === dayIndex),
  );

  const hasAnyWindows = windows.length > 0;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      <View className="px-6 pb-4">
        <Text className="text-2xl font-bold text-gray-900">Availability</Text>
        <Text className="text-sm text-gray-500 mt-1">
          Set your weekly recurring hours. Tap + to add a window.
        </Text>
      </View>

      {error && (
        <View className="mx-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      )}

      {!hasAnyWindows && (
        <View className="mx-6 mb-4 bg-gray-50 rounded-xl px-4 py-6 items-center">
          <Text className="text-3xl mb-2">🗓️</Text>
          <Text className="text-base font-semibold text-gray-900 mb-1">No hours set yet</Text>
          <Text className="text-sm text-gray-500 text-center">
            Add availability windows so customers know when to book.
          </Text>
        </View>
      )}

      <ScrollView className="flex-1 px-6">
        {DAY_LABELS.map((dayLabel, dayIndex) => (
          <View key={dayIndex} className="mb-5">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-semibold text-gray-700">{dayLabel}</Text>
              <TouchableOpacity
                className="w-7 h-7 rounded-full bg-indigo-600 items-center justify-center"
                onPress={() => openAddModal(dayIndex)}
              >
                <Text className="text-white text-lg leading-none">+</Text>
              </TouchableOpacity>
            </View>

            {windowsByDay[dayIndex].length === 0 ? (
              <View className="h-10 border border-dashed border-gray-200 rounded-lg items-center justify-center">
                <Text className="text-xs text-gray-400">No hours</Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {windowsByDay[dayIndex].map((win) => (
                  <View
                    key={win.windowId}
                    className="flex-row items-center bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1.5 gap-2"
                  >
                    <Text className="text-sm text-indigo-800">
                      {win.startTime}–{win.endTime}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemove(win.windowId)}>
                      <Text className="text-indigo-400 text-base leading-none">×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
        <View className="h-8" />
      </ScrollView>

      {/* Add Window Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white px-6 pt-8">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold text-gray-900">
              Add Window — {DAY_LABELS[selectedDay]}
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

          <View className="flex-row gap-4 mb-6">
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">Start Time</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
                value={startTime}
                onChangeText={setStartTime}
                placeholder="09:00"
                autoCapitalize="none"
                editable={!isAdding}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-gray-700 mb-1">End Time</Text>
              <TextInput
                className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
                value={endTime}
                onChangeText={setEndTime}
                placeholder="17:00"
                autoCapitalize="none"
                editable={!isAdding}
              />
            </View>
          </View>

          <Text className="text-xs text-gray-400 mb-6">Use 24-hour format: HH:MM (e.g. 09:00, 17:30)</Text>

          <TouchableOpacity
            className={`rounded-lg py-4 items-center ${isAdding ? 'bg-indigo-300' : 'bg-indigo-600'}`}
            onPress={handleAdd}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Add Window</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
