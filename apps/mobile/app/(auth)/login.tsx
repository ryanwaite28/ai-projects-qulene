import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useApi } from '../../hooks/useApi';
import type { User } from '@qulene/api-types';

export default function LoginScreen() {
  const { login, isProfileSynced, markProfileSynced } = useAuth();
  const { request } = useApi();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);

      // Retry profile sync if it failed during registration
      const synced = await isProfileSynced();
      if (!synced) {
        try {
          await request<User>('/auth/profile', {
            method: 'POST',
            body: JSON.stringify({}),
          });
          await markProfileSynced();
        } catch {
          // Profile sync will retry on next login; do not block the user
        }
      }

      router.replace('/(tabs)');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white justify-center px-6">
      <Text className="text-3xl font-bold text-gray-900 mb-2">Welcome back</Text>
      <Text className="text-base text-gray-500 mb-8">Sign in to your Qulene account</Text>

      {error && (
        <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      )}

      <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base text-gray-900"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!isSubmitting}
      />

      <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base text-gray-900"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        editable={!isSubmitting}
      />

      <TouchableOpacity
        className={`rounded-lg py-4 items-center ${isSubmitting ? 'bg-indigo-300' : 'bg-indigo-600'}`}
        onPress={handleLogin}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Sign in</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-center mt-6">
        <Text className="text-gray-500 text-sm">Don&apos;t have an account? </Text>
        <Link href="/(auth)/register">
          <Text className="text-indigo-600 font-medium text-sm">Register</Text>
        </Link>
      </View>
    </View>
  );
}
