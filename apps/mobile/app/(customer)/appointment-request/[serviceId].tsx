import { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApi, ApiError } from '../../../hooks/useApi';

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function AppointmentRequestScreen() {
  const { serviceId, businessName, serviceName, price, durationMinutes } =
    useLocalSearchParams<{
      serviceId: string;
      businessId: string;
      businessName: string;
      serviceName: string;
      price: string;
      durationMinutes: string;
    }>();
  const router = useRouter();
  const { request } = useApi();

  // Locked for screen lifetime — retries from this screen are idempotent
  const idempotencyKeyRef = useRef<string>(generateUUID());

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [dateError, setDateError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function buildProposedAt(): string | null {
    if (!date.trim() || !time.trim()) return null;
    return `${date.trim()}T${time.trim()}:00.000Z`;
  }

  function validateForm(): boolean {
    setDateError('');
    setSubmitError('');

    const proposedAt = buildProposedAt();
    if (!proposedAt) {
      setDateError('Date and time are required');
      return false;
    }

    const proposed = new Date(proposedAt);
    if (isNaN(proposed.getTime())) {
      setDateError('Invalid date or time — use YYYY-MM-DD and HH:MM');
      return false;
    }

    if (proposed <= new Date()) {
      setDateError('Please select a future date and time');
      return false;
    }

    return true;
  }

  async function handleSubmit() {
    if (!validateForm()) return;

    const proposedAt = buildProposedAt()!;
    setIsSubmitting(true);
    try {
      await request('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          serviceId,
          proposedAt,
          idempotencyKey: idempotencyKeyRef.current,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });
      Alert.alert('Request sent', 'Your appointment request has been submitted.');
      router.replace('/(customer)/appointments' as never);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'CONFLICT') {
          setSubmitError('You already have an active request for this service.');
        } else if (err.code === 'UNPROCESSABLE') {
          setDateError('Please select a future date and time.');
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
      <View className="px-6 pt-12 pb-10">
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Text className="text-indigo-600 font-medium">‹ Back</Text>
        </TouchableOpacity>

        <Text className="text-2xl font-bold text-gray-900 mb-1">Request Appointment</Text>

        {/* Service summary */}
        <View className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-4 mb-8">
          <Text className="text-base font-semibold text-gray-900">{serviceName}</Text>
          {businessName ? (
            <Text className="text-sm text-indigo-700 mt-0.5">{businessName}</Text>
          ) : null}
          <Text className="text-sm text-gray-500 mt-1">
            {durationMinutes} min · {formatPrice(Number(price))}
          </Text>
        </View>

        {/* Date */}
        <Text className="text-sm font-medium text-gray-700 mb-1">Date</Text>
        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 text-gray-900 mb-1"
          placeholder="YYYY-MM-DD"
          value={date}
          onChangeText={(v) => { setDate(v); setDateError(''); }}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        {/* Time */}
        <Text className="text-sm font-medium text-gray-700 mb-1 mt-4">Time (UTC)</Text>
        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 text-gray-900 mb-1"
          placeholder="HH:MM  (e.g. 14:30)"
          value={time}
          onChangeText={(v) => { setTime(v); setDateError(''); }}
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        {dateError ? <Text className="text-red-500 text-sm mt-1 mb-2">{dateError}</Text> : null}

        {/* Notes */}
        <Text className="text-sm font-medium text-gray-700 mb-1 mt-4">Notes (optional)</Text>
        <TextInput
          className="border border-gray-300 rounded-xl px-4 py-3 text-gray-900 h-24"
          placeholder="Any special requests or information..."
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
        />

        {submitError ? (
          <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4">
            <Text className="text-red-700 text-sm">{submitError}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          className={`rounded-xl py-4 mt-6 items-center ${isSubmitting ? 'bg-indigo-300' : 'bg-indigo-600'}`}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Send Request</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
