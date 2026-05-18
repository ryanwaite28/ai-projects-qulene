import { View, Text, TouchableOpacity } from 'react-native';
import type { AppointmentRequest, AppointmentStatus } from '@qulene/api-types';

const STATUS_STYLES: Record<AppointmentStatus, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  ACCEPTED:  { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Accepted' },
  DECLINED:  { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Declined' },
  CANCELLED: { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Cancelled' },
  COMPLETED: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Completed' },
  NO_SHOW:   { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'No-Show' },
};

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

interface ActionButtonProps {
  label: string;
  color: string;
  textColor: string;
  onPress: () => void;
  disabled?: boolean;
}

function ActionButton({ label, color, textColor, onPress, disabled }: ActionButtonProps) {
  return (
    <TouchableOpacity
      className={`flex-1 rounded-lg py-2 items-center mx-1 ${disabled ? 'bg-gray-100' : color}`}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text className={`text-sm font-medium ${disabled ? 'text-gray-400' : textColor}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export interface AppointmentCardProps {
  item: AppointmentRequest;
  context: 'BUSINESS' | 'CUSTOMER';
  isActioning?: boolean;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onComplete?: (id: string) => void;
  onNoShow?: (id: string) => void;
}

export function AppointmentCard({
  item,
  context,
  isActioning = false,
  onAccept,
  onDecline,
  onComplete,
  onNoShow,
}: AppointmentCardProps) {
  const badge = STATUS_STYLES[item.status];
  const isPastProposedAt = new Date(item.proposedAt) < new Date();

  const showAcceptDecline = context === 'BUSINESS' && item.status === 'PENDING';
  const showCompleteNoShow =
    context === 'BUSINESS' && item.status === 'ACCEPTED' && isPastProposedAt;

  return (
    <View className="border border-gray-100 rounded-xl p-4 mb-3 bg-white shadow-sm">
      {/* Header row */}
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-sm font-medium text-gray-900 flex-1 mr-2" numberOfLines={1}>
          {item.serviceId}
        </Text>
        <View className={`rounded-full px-3 py-1 ${badge.bg}`}>
          <Text className={`text-xs font-medium ${badge.text}`}>{badge.label}</Text>
        </View>
      </View>

      {/* Proposed time */}
      <Text className="text-sm text-gray-500 mb-1">
        📅 {formatDateTime(item.proposedAt)}
      </Text>

      {/* Notes */}
      {item.notes ? (
        <Text className="text-sm text-gray-400 mb-2" numberOfLines={2}>
          {item.notes}
        </Text>
      ) : null}

      {/* BUSINESS: Accept / Decline */}
      {showAcceptDecline ? (
        <View className="flex-row mt-3 -mx-1">
          <ActionButton
            label="Accept"
            color="bg-green-100"
            textColor="text-green-700"
            onPress={() => onAccept?.(item.requestId)}
            disabled={isActioning}
          />
          <ActionButton
            label="Decline"
            color="bg-red-50"
            textColor="text-red-600"
            onPress={() => onDecline?.(item.requestId)}
            disabled={isActioning}
          />
        </View>
      ) : null}

      {/* BUSINESS: Complete / No-Show */}
      {showCompleteNoShow ? (
        <View className="flex-row mt-3 -mx-1">
          <ActionButton
            label="Mark Complete"
            color="bg-blue-100"
            textColor="text-blue-700"
            onPress={() => onComplete?.(item.requestId)}
            disabled={isActioning}
          />
          <ActionButton
            label="No-Show"
            color="bg-gray-100"
            textColor="text-gray-600"
            onPress={() => onNoShow?.(item.requestId)}
            disabled={isActioning}
          />
        </View>
      ) : null}
    </View>
  );
}
