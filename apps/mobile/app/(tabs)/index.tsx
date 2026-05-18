import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../hooks/useAuth';

export default function HomeScreen() {
  const { logout } = useAuth();

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <Text className="text-2xl font-bold text-gray-900 mb-2">Welcome to Qulene</Text>
      <Text className="text-base text-gray-500 mb-8">You are signed in.</Text>
      <TouchableOpacity
        className="bg-gray-100 px-6 py-3 rounded-lg"
        onPress={logout}
      >
        <Text className="text-gray-700 font-medium">Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}
