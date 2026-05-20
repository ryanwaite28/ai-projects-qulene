import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useUserApi } from '../../hooks/useUserApi';

function TabIcon({ label }: { label: string }) {
  return <Text className="text-xs text-gray-400">{label}</Text>;
}

export default function CustomerLayout() {
  const { getMyProfile } = useUserApi();
  const [unreadCount, setUnreadCount] = useState(0);

  // Badge count fetched on layout mount; refreshes on re-mount (e.g. app open).
  // In-screen mark-as-read updates the list locally but not this badge — acceptable for portfolio.
  useEffect(() => {
    getMyProfile()
      .then((user) => setUnreadCount(user.unreadNotificationCount))
      .catch(() => undefined);
  }, [getMyProfile]);

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Browse',
          tabBarIcon: () => <TabIcon label="🔍" />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Appointments',
          tabBarIcon: () => <TabIcon label="📅" />,
        }}
      />
      <Tabs.Screen
        name="waitlist"
        options={{
          title: 'Waitlist',
          tabBarIcon: () => <TabIcon label="⏳" />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: () => <TabIcon label="🔔" />,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
    </Tabs>
  );
}
