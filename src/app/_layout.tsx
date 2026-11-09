import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackLink, HomeButton, RefreshButton } from '../components/back-link';
import { syncAll, watchConnection } from '../fleet-store';
import { theme } from '../theme';

function ScreenHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={{ minHeight: 48, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
          <BackLink />
          <HomeButton />
          <RefreshButton />
        </View>
      </View>
    </View>
  );
}

export function ErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>This page did not load offline.</Text>
      <Text style={{ color: theme.muted, marginTop: 8, fontSize: 16 }}>
        Turn the connection on once so the inspection page can be saved on this phone, then try again.
      </Text>
      <Pressable onPress={() => void retry()} style={{ marginTop: 16 }}>
        <Text style={{ color: theme.accent, fontWeight: '800' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  useEffect(() => {
    void syncAll();
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    router.prefetch('/inspection');
    router.prefetch('/vehicle');
    router.prefetch('/rental-history');
    return watchConnection();
  }, [router]);

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
      <Stack.Screen name="vehicle" options={{ header: () => <ScreenHeader /> }} />
      <Stack.Screen name="inspection" options={{ header: () => <ScreenHeader /> }} />
      <Stack.Screen name="rental-history" options={{ header: () => <ScreenHeader /> }} />
    </Stack>
  );
}
