import { Tabs } from 'expo-router';

export default function BusinessLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="services" options={{ title: 'Services' }} />
      <Tabs.Screen name="availability" options={{ title: 'Availability' }} />
    </Tabs>
  );
}
