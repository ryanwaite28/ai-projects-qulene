import '../global.css';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

export default function RootLayout() {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      if (session.role === 'BUSINESS') {
        router.replace('/(business)');
      } else {
        router.replace('/(customer)');
      }
    }
  }, [session, isLoading, segments, router]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(business)" />
      <Stack.Screen name="(customer)" />
    </Stack>
  );
}
