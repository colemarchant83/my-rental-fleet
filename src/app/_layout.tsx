import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { syncAll, watchConnection } from '../fleet-store';
import { theme } from '../theme';

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
      <Stack.Screen name="vehicle" options={{ title: 'Machine' }} />
      <Stack.Screen name="inspection" options={{ title: 'Inspection' }} />
      <Stack.Screen name="rental-history" options={{ title: 'Rental' }} />
    </Stack>
  );
}
