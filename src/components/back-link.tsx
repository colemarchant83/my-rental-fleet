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
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4000);
      void fetch('/online.txt?t=' + Date.now(), { cache: 'no-store', signal: controller.signal })
        .then((response) => {
          if (live) setOnline(response.ok);
        })
        .catch(() => {
          if (live) setOnline(false);
        })
        .finally(() => window.clearTimeout(timer));
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
  const [flash, setFlash] = useState(false);
  return (
    <Pressable
      hitSlop={16}
      accessibilityRole="button"
      style={({ pressed }) => ({
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: pressed || flash ? theme.ink : 'transparent',
      })}
      onPress={() => {
        if (!online || label !== 'Refresh') return;
        setFlash(true);
        setTimeout(() => {
          setFlash(false);
          setLabel('Refreshing...');
        }, 320);
        const started = Date.now();
        void syncAll().finally(() => {
          const wait = Math.max(0, 700 - (Date.now() - started));
          setTimeout(() => setLabel('Refresh'), wait);
        });
      }}
    >
      <Text
        style={{
          color: flash ? theme.white : online ? theme.accent : theme.muted,
          fontSize: 16,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
