import { useEffect, useState } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { syncAll } from '../fleet-store';
import { theme } from '../theme';

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let live = true;
    const check = () => {
      if (navigator.onLine === false) {
        setOnline(false);
        return;
      }
      void fetch('/sw.js', { method: 'HEAD', cache: 'no-store' })
        .then((response) => {
          if (live) setOnline(response.ok);
        })
        .catch(() => {
          if (live) setOnline(false);
        });
    };
    const markOffline = () => setOnline(false);
    check();
    window.addEventListener('online', check);
    window.addEventListener('offline', markOffline);
    document.addEventListener('visibilitychange', check);
    return () => {
      live = false;
      window.removeEventListener('online', check);
      window.removeEventListener('offline', markOffline);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return online;
}

export function goBack(router: { canGoBack: () => boolean; back: () => void; replace: (href: '/') => void }) {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function BackLink() {
  const router = useRouter();
  return (
    <Pressable onPress={() => goBack(router)} hitSlop={10}>
      <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '700' }}>‹ Back</Text>
    </Pressable>
  );
}

export function HomeButton() {
  const router = useRouter();
  return (
    <Pressable
      hitSlop={8}
      onPress={() => router.replace('/')}
    >
      <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '700' }}>Home</Text>
    </Pressable>
  );
}

export function RefreshButton() {
  const online = useOnline();
  const [label, setLabel] = useState('Refresh');
  return (
    <Pressable
      hitSlop={8}
      disabled={!online || label !== 'Refresh'}
      onPress={() => {
        if (!online || label !== 'Refresh') return;
        setLabel('Refreshing...');
        void syncAll().finally(() => {
          setLabel('Updated');
          setTimeout(() => setLabel('Refresh'), 900);
        });
      }}
    >
      <Text style={{ color: online ? theme.accent : theme.muted, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
