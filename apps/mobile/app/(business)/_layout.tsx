import { useState, useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useUserApi } from '../../hooks/useUserApi';

export default function BusinessLayout() {
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
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="services" options={{ title: 'Services' }} />
      <Tabs.Screen name="availability" options={{ title: 'Availability' }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
    </Tabs>
  );
}
