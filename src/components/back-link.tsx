import { Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
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
