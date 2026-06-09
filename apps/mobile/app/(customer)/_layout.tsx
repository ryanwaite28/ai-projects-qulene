import { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useUserApi } from '../../hooks/useUserApi';

export default function CustomerLayout() {
  const { getMyProfile } = useUserApi();
  const [unreadCount, setUnreadCount] = useState(0);

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
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🔍</Text>,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>🔔</Text>,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>⚙️</Text>,
        }}
      />
      {/* Navigable screens hidden from the tab bar */}
      <Tabs.Screen name="appointments"                      options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="waitlist"                          options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="business/[id]"                    options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="appointment-request/[serviceId]"  options={{ tabBarItemStyle: { display: 'none' } }} />
    </Tabs>
  );
}
