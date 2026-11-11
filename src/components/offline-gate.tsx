import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { theme } from '../theme';

function isOnlineOnly(path: string) {
  return (
    path === '/maintenance' ||
    path.startsWith('/maintenance-') ||
    path === '/add' ||
    path.startsWith('/share') ||
    path.startsWith('/compare') ||
    path.startsWith('/explore')
  );
}

function useConnection() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let live = true;
    const mark = (next: boolean) => {
      if (live) setOnline(next);
    };
    const check = () => {
      if (navigator.onLine === false) {
        mark(false);
        return;
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4000);
      void fetch('/online.txt?t=' + Date.now(), { cache: 'no-store', signal: controller.signal })
        .then((response) => mark(response.ok))
        .catch(() => mark(false))
        .finally(() => window.clearTimeout(timer));
    };
    const onOffline = () => mark(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    window.addEventListener('online', check);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      window.removeEventListener('online', check);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return online;
}

export function OfflineWall() {
  const path = usePathname();
  const router = useRouter();
  const online = useConnection();
  if (!isOnlineOnly(path) || online === true) return null;
  if (online === null) return <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, backgroundColor: theme.bg }} />;
  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, backgroundColor: theme.bg, padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Page unavailable offline</Text>
      <Text style={{ color: theme.muted, marginTop: 10, fontSize: 16, lineHeight: 22 }}>
        This page needs an internet connection. A rental check-out or check-in can still be done from the rental home.
      </Text>
      <Pressable onPress={() => router.replace('/')} style={{ marginTop: 16 }}>
        <Text style={{ color: theme.accent, fontWeight: '800' }}>Back to rental home</Text>
      </Pressable>
    </View>
  );
}

export function OfflineGate({ children }: { children: ReactNode }) {
  const online = useConnection();
  if (online === null) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;
  if (online) return children;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Page unavailable offline</Text>
      <Text style={{ color: theme.muted, marginTop: 10, fontSize: 16, lineHeight: 22 }}>
        This page needs an internet connection. A rental check-out or check-in can still be done from the rental home.
      </Text>
    </View>
  );
}
