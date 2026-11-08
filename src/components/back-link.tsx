import { Platform, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { syncAll } from '../fleet-store';
import { theme } from '../theme';

export function goBack(router: { canGoBack: () => boolean; back: () => void; replace: (href: '/') => void }) {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function BackLink() {
  const router = useRouter();
  return (
    <Pressable onPress={() => goBack(router)} hitSlop={10} style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingRight: 12 }}>
      <Text style={{ color: theme.accent, fontSize: 17, fontWeight: '700' }}>‹ Back</Text>
    </Pressable>
  );
}

export function RefreshButton() {
  return (
    <Pressable
      hitSlop={8}
      style={{ marginRight: 20 }}
      onPress={() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.reload();
          return;
        }
        void syncAll();
      }}
    >
      <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '700' }}>Refresh</Text>
    </Pressable>
  );
}
