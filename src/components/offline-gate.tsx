import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import { theme } from '../theme';

function useConnection() {
  const [online, setOnline] = useState<boolean | null>(Platform.OS !== 'web' ? true : null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
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
      void fetch(`/online.txt?t=${Date.now()}`, { method: 'GET', cache: 'no-store', signal: controller.signal })
        .then((response) => {
          if (live) mark(response.ok);
        })
        .catch(() => {
          if (live) mark(false);
        })
        .finally(() => window.clearTimeout(timer));
    };
    const markOffline = () => mark(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    window.addEventListener('online', check);
    window.addEventListener('offline', markOffline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      window.removeEventListener('online', check);
      window.removeEventListener('offline', markOffline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return online;
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
