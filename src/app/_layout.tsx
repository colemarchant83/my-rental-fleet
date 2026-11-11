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
        {online ? 'This page hit a problem.' : 'Page unavailable offline'}
      </Text>
      <Text style={{ color: theme.muted, marginTop: 8, fontSize: 16 }}>
        {online
          ? error?.message || 'Reload the app and try that page again.'
          : 'This page needs an internet connection. A rental check-out or check-in can still be done from the rental home.'}
      </Text>
      <Pressable
        onPress={() => {
          if (!online && typeof window !== 'undefined') {
            window.location.assign('/');
            return;
          }
          if (online) reload();
        }}
        style={{ marginTop: 16 }}
      >
        <Text style={{ color: theme.accent, fontWeight: '800' }}>{online ? 'Reload' : 'Back to rental home'}</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      router.prefetch('/inspection');
      router.prefetch('/vehicle');
      router.prefetch('/rental-history');
    }
    void syncAll();
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        if (navigator.onLine === false) return;
        if (window.location.pathname.includes('inspection')) return;
        refreshing = true;
        window.location.reload();
      });
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
    let cover: HTMLDivElement | undefined;
    let updateCover: (() => void) | undefined;
    if (typeof document !== 'undefined') {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = '/manifest.webmanifest';
      document.head.appendChild(manifest);
      const phone = window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) < 600;
      if (phone) {
        const orientation = window.screen.orientation as { lock?: (orientation: string) => Promise<void> } | undefined;
        if (orientation?.lock) void orientation.lock('portrait').catch(() => undefined);
        cover = document.createElement('div');
        cover.setAttribute('role', 'alertdialog');
        cover.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;padding:32px;background:#e4d9c8;color:#1c1917;text-align:center;font-family:system-ui,sans-serif';
        cover.innerHTML = '<div style="font-size:28px;font-weight:800;line-height:1.2">Turn the phone upright</div>';
        document.body.appendChild(cover);
        updateCover = () => {
          if (!cover) return;
          cover.style.display = window.matchMedia('(orientation: landscape)').matches ? 'flex' : 'none';
        };
        updateCover();
        window.addEventListener('orientationchange', updateCover);
        window.addEventListener('resize', updateCover);
      }
    }
    return () => {
      window.removeEventListener('online', refreshAfterReconnect);
      if (updateCover) {
        window.removeEventListener('orientationchange', updateCover);
        window.removeEventListener('resize', updateCover);
      }
      stopWatching();
      cover?.remove();
    };
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
      <Stack.Screen name="maintenance-record" options={{ header: () => <ScreenHeader /> }} />
      <Stack.Screen name="maintenance-entry" options={{ header: () => <ScreenHeader /> }} />
      <Stack.Screen name="share" options={{ title: 'Rental card', headerBackVisible: false }} />
    </Stack>
  );
}
