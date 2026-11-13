import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackLink, HomeButton, RefreshButton } from '../components/back-link';
import { SignInScreen, VerifyEmailScreen } from '../components/sign-in';
import { claimExistingRecords, needsEmailVerification, watchAccount } from '../account';
import { reportProblem } from '../problem-report';
import { auth } from '../firebase';
import { syncAll, watchConnection } from '../fleet-store';
import { OfflineWall } from '../components/offline-gate';
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
  useEffect(() => {
    if (!online) return;
    void reportProblem(error?.message || 'This page hit a problem.', 'screen');
  }, [error, online]);
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
  const path = usePathname();
  const [accountReady, setAccountReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [verified, setVerified] = useState(false);
  const sharing = path.startsWith('/share');
  const claimed = useRef('');
  const openAccount = useCallback((uid: string) => {
    setSignedIn(true);
    setVerified(true);
    if (claimed.current === uid) {
      setAccountReady(true);
      return;
    }
    claimed.current = uid;
    setAccountReady(false);
    void claimExistingRecords(uid).finally(() => setAccountReady(true));
  }, []);
  const finishVerification = useCallback(() => {
    const uid = auth.currentUser?.uid;
    if (uid) openAccount(uid);
  }, [openAccount]);
  useEffect(() => {
    return watchAccount((user) => {
      if (!user) {
        claimed.current = '';
        setSignedIn(false);
        setVerified(false);
        setAccountReady(true);
        return;
      }
      if (needsEmailVerification(user)) {
        setSignedIn(true);
        setVerified(false);
        setAccountReady(true);
        return;
      }
      openAccount(user.uid);
    });
  }, [openAccount]);
  useEffect(() => {
    if ((signedIn && verified) || sharing) void syncAll();
  }, [signedIn, verified, sharing]);
  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
      router.prefetch('/inspection');
      router.prefetch('/vehicle');
      router.prefetch('/rental-history');
    }
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
    const reportPageError = (event: ErrorEvent) => {
      void reportProblem(event.message || 'This page hit a problem.', 'screen');
    };
    const reportRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason || 'A background task failed.');
      void reportProblem(message, 'background');
    };
    window.addEventListener('error', reportPageError);
    window.addEventListener('unhandledrejection', reportRejection);
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
      window.removeEventListener('error', reportPageError);
      window.removeEventListener('unhandledrejection', reportRejection);
      if (updateCover) {
        window.removeEventListener('orientationchange', updateCover);
        window.removeEventListener('resize', updateCover);
      }
      stopWatching();
      cover?.remove();
    };
  }, [router]);

  const showApp = sharing || (accountReady && signedIn && verified);
  return (
    <View style={{ flex: 1 }}>
    {showApp ? (
    <View style={{ flex: 1 }}>
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
      <Stack.Screen name="problems" options={{ header: () => <ScreenHeader /> }} />
    </Stack>
    <OfflineWall />
    </View>
    ) : signedIn && accountReady && !verified ? (
      <VerifyEmailScreen onVerified={finishVerification} />
    ) : !accountReady ? (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} />
        <Text style={{ color: theme.muted, marginTop: 12 }}>Opening your account...</Text>
      </View>
    ) : (
      <SignInScreen />
    )}
    </View>
  );
}
