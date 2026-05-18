import { View, Text } from 'react-native';

export default function DashboardScreen() {
  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <Text className="text-xl font-semibold text-gray-900 mb-2">Dashboard</Text>
      <Text className="text-sm text-gray-500 text-center">
        Incoming appointment requests will appear here in a future update.
      </Text>
    </View>
  );
}
