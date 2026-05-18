import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ label }: { label: string }) {
  return <Text className="text-xs text-gray-400">{label}</Text>;
}

export default function CustomerLayout() {
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
          href: null,
        }}
      />
      <Tabs.Screen
        name="waitlist"
        options={{
          title: 'Waitlist',
          tabBarIcon: () => <TabIcon label="⏳" />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: () => <TabIcon label="🔔" />,
          href: null,
        }}
      />
    </Tabs>
  );
}
