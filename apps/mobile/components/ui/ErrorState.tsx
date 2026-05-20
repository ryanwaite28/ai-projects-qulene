import { View, Text, TouchableOpacity } from 'react-native';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center pt-16 px-6">
      <Text className="text-4xl mb-4">⚠️</Text>
      <Text className="text-base font-semibold text-gray-800 mb-2 text-center">
        {message}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        activeOpacity={0.7}
        className="mt-2 rounded-lg bg-brand-600 px-5 py-2"
      >
        <Text className="text-sm font-semibold text-white">Try again</Text>
      </TouchableOpacity>
    </View>
  );
}
