import { Alert } from 'react-native';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function BusinessSettingsScreen() {
  const { session, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-gray-50">
      <ScrollView>
        <View className="px-6 pt-4 pb-6">
          <Text className="text-2xl font-bold text-gray-900">Settings</Text>
        </View>

        {/* Account card */}
        <View className="mx-6 bg-white rounded-2xl p-5 mb-6 border border-gray-100">
          <View className="w-14 h-14 rounded-full bg-indigo-100 items-center justify-center mb-3">
            <Text className="text-2xl">🏢</Text>
          </View>
          <Text className="text-base font-semibold text-gray-900">Business Account</Text>
          {session?.role ? (
            <View className="mt-1.5 self-start bg-indigo-50 rounded-full px-3 py-0.5">
              <Text className="text-xs text-indigo-600 font-medium">{session.role}</Text>
            </View>
          ) : null}
        </View>

        {/* Manage section */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 mb-2">Manage</Text>
        <View className="mx-6 bg-white rounded-2xl overflow-hidden border border-gray-100 mb-6">
          <TouchableOpacity
            className="px-5 py-4 flex-row items-center justify-between border-b border-gray-100"
            onPress={() => router.navigate('/(business)/profile' as never)}
            activeOpacity={0.7}
          >
            <Text className="text-sm text-gray-800">Edit Profile</Text>
            <Text className="text-gray-400 text-lg">›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="px-5 py-4 flex-row items-center justify-between"
            onPress={() => router.navigate('/(business)/availability' as never)}
            activeOpacity={0.7}
          >
            <Text className="text-sm text-gray-800">Manage Availability</Text>
            <Text className="text-gray-400 text-lg">›</Text>
          </TouchableOpacity>
        </View>

        {/* Account section */}
        <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-6 mb-2">Account</Text>
        <View className="mx-6 bg-white rounded-2xl overflow-hidden border border-gray-100 mb-8">
          <TouchableOpacity className="px-5 py-4" onPress={handleLogout} activeOpacity={0.7}>
            <Text className="text-sm font-medium text-red-600">Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
