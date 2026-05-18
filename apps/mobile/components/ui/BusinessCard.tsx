import { View, Text, TouchableOpacity, Image } from 'react-native';
import type { BusinessProfile } from '@qulene/api-types';

interface Props {
  business: BusinessProfile;
  onPress: () => void;
}

export function BusinessCard({ business, onPress }: Props) {
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white border border-gray-200 rounded-xl p-4 mb-3"
      onPress={onPress}
      activeOpacity={0.7}
    >
      {business.avatarUrl ? (
        <Image
          source={{ uri: business.avatarUrl }}
          className="w-14 h-14 rounded-full bg-gray-200 mr-4"
        />
      ) : (
        <View className="w-14 h-14 rounded-full bg-indigo-100 items-center justify-center mr-4">
          <Text className="text-xl text-indigo-400">🏢</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {business.businessName ?? 'Unnamed Business'}
        </Text>
        {business.category ? (
          <Text className="text-xs text-indigo-600 font-medium mt-0.5">{business.category}</Text>
        ) : null}
        {business.city || business.state ? (
          <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
            {[business.city, business.state].filter(Boolean).join(', ')}
          </Text>
        ) : null}
      </View>
      <Text className="text-gray-300 text-xl ml-2">›</Text>
    </TouchableOpacity>
  );
}
