import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="vehicle" options={{ title: 'Vehicle' }} />
      <Stack.Screen name="inspection" options={{ title: 'Inspection' }} />
    </Stack>
  );
}
