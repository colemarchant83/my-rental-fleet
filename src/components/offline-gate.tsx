import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
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
      void NetInfo.fetch().then((state) => {
        if (!live) return;
        if (state.isConnected === false) {
          mark(false);
          return;
        }
        void fetch(`https://my-rental-fleet.web.app/sw.js?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store', mode: 'no-cors' })
          .then(() => mark(true))
          .catch(() => mark(false));
      });
    };
    const markOffline = () => mark(false);
    check();
    const stopNet = NetInfo.addEventListener((state) => {
      if (state.isConnected === false) markOffline();
      else check();
    });
    window.addEventListener('online', check);
    window.addEventListener('offline', markOffline);
    return () => {
      live = false;
      stopNet();
      window.removeEventListener('online', check);
      window.removeEventListener('offline', markOffline);
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
