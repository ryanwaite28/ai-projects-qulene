import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useApi } from '../../hooks/useApi';
import type { User, UserRole } from '@qulene/api-types';

export default function RegisterScreen() {
  const { register, confirmRegistration, markProfileSynced } = useAuth();
  const { request } = useApi();
  const router = useRouter();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('CUSTOMER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirmation step
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState('');

  const syncProfile = async (firstName: string, lastName: string) => {
    try {
      await request<User>('/auth/profile', {
        method: 'POST',
        body: JSON.stringify({ firstName, lastName }),
      });
      await markProfileSynced();
    } catch {
      // profile sync will retry on next login
    }
  };

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const { needsConfirmation } = await register({
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
      });

      if (needsConfirmation) {
        setPendingEmail(email.trim().toLowerCase());
        return;
      }

      await syncProfile(firstName.trim(), lastName.trim());
      // Navigation handled by RootLayout's useEffect watching session state
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmCode.trim()) {
      setError('Please enter the confirmation code.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmRegistration(pendingEmail!, password, confirmCode.trim());
      await syncProfile(firstName.trim(), lastName.trim());
      // Navigation handled by RootLayout's useEffect watching session state
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed. Please check the code and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pendingEmail) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerClassName="flex-grow justify-center px-6 py-8"
            keyboardShouldPersistTaps="handled"
          >
            <Text className="text-3xl font-bold text-gray-900 mb-2">Check your email</Text>
            <Text className="text-base text-gray-500 mb-8">
              We sent a confirmation code to {pendingEmail}. Enter it below to activate your account.
            </Text>

            {error && (
              <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
                <Text className="text-red-700 text-sm">{error}</Text>
              </View>
            )}

            <Text className="text-sm font-medium text-gray-700 mb-1">Confirmation code</Text>
            <TextInput
              className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base text-gray-900 tracking-widest"
              placeholder="123456"
              value={confirmCode}
              onChangeText={setConfirmCode}
              keyboardType="number-pad"
              autoCapitalize="none"
              maxLength={6}
              editable={!isSubmitting}
            />

            <TouchableOpacity
              className={`rounded-lg py-4 items-center ${isSubmitting ? 'bg-indigo-300' : 'bg-indigo-600'}`}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-base">Confirm account</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
    <ScrollView contentContainerClassName="justify-center px-6 py-8">
      <Text className="text-3xl font-bold text-gray-900 mb-2">Create account</Text>
      <Text className="text-base text-gray-500 mb-8">Join Qulene today</Text>

      {error && (
        <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      )}

      <View className="flex-row gap-3 mb-4">
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 mb-1">First name</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
            placeholder="Jane"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            editable={!isSubmitting}
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-gray-700 mb-1">Last name</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
            placeholder="Doe"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            editable={!isSubmitting}
          />
        </View>
      </View>

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
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base text-gray-900"
        placeholder="••••••••"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        editable={!isSubmitting}
      />

      <Text className="text-sm font-medium text-gray-700 mb-2">I am a…</Text>
      <View className="flex-row gap-3 mb-6">
        {(['CUSTOMER', 'BUSINESS'] as UserRole[]).map((r) => (
          <TouchableOpacity
            key={r}
            className={`flex-1 py-3 rounded-lg border items-center ${
              role === r
                ? 'bg-indigo-600 border-indigo-600'
                : 'bg-white border-gray-300'
            }`}
            onPress={() => setRole(r)}
            disabled={isSubmitting}
          >
            <Text
              className={`font-medium text-sm ${role === r ? 'text-white' : 'text-gray-700'}`}
            >
              {r === 'CUSTOMER' ? 'Customer' : 'Business'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        className={`rounded-lg py-4 items-center ${isSubmitting ? 'bg-indigo-300' : 'bg-indigo-600'}`}
        onPress={handleRegister}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Create account</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-center mt-6">
        <Text className="text-gray-500 text-sm">Already have an account? </Text>
        <Link href="/(auth)/login">
          <Text className="text-indigo-600 font-medium text-sm">Sign in</Text>
        </Link>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}
