import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { BackLink } from '../components/back-link';
import { syncAll, watchConnection } from '../fleet-store';
import { theme } from '../theme';

const withBack = { headerLeft: () => <BackLink /> };

export default function RootLayout() {
  useEffect(() => {
    void syncAll();
    return watchConnection();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="vehicle" options={{ title: 'Machine', ...withBack }} />
      <Stack.Screen name="inspection" options={{ title: 'Inspection', ...withBack }} />
      <Stack.Screen name="rental-history" options={{ title: 'Rental', ...withBack }} />
    </Stack>
  );
}
