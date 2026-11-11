import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
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

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const reload = () => {
    if (typeof window === 'undefined') {
      void retry();
      return;
    }
    void (async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      window.location.replace(window.location.href);
    })();
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>
        {online ? 'This page hit a problem.' : 'This page did not load offline.'}
      </Text>
      <Text style={{ color: theme.muted, marginTop: 8, fontSize: 16 }}>
        {online
          ? error?.message || 'Reload the app and try that page again.'
          : 'Turn the connection on once so this page can be saved on this phone, then try again.'}
      </Text>
      <Pressable onPress={online ? reload : () => void retry()} style={{ marginTop: 16 }}>
        <Text style={{ color: theme.accent, fontWeight: '800' }}>{online ? 'Reload' : 'Try again'}</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void syncAll();
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    const refreshAfterReconnect = () => {
      if (typeof window === 'undefined') return;
      if (window.location.pathname.includes('inspection')) return;
      if (sessionStorage.getItem('fleet-refreshed-online') === '1') return;
      sessionStorage.setItem('fleet-refreshed-online', '1');
      window.location.reload();
    };
    window.addEventListener('online', refreshAfterReconnect);
    const stopWatching = watchConnection();
    return () => {
      window.removeEventListener('online', refreshAfterReconnect);
      stopWatching();
    };
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
      <Stack.Screen name="vehicle" options={{ header: () => <ScreenHeader /> }} />
      <Stack.Screen name="inspection" options={{ header: () => <ScreenHeader /> }} />
      <Stack.Screen name="rental-history" options={{ header: () => <ScreenHeader /> }} />
    </Stack>
  );
}
