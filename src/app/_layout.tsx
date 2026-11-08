import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackLink, RefreshButton } from '../components/back-link';
import { syncAll, watchConnection } from '../fleet-store';
import { theme } from '../theme';

function ScreenHeader({ title }: { title?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: theme.bg, paddingTop: insets.top }}>
      <View style={{ minHeight: 48, justifyContent: 'center' }}>
        {title ? (
          <Text pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', color: theme.text, fontSize: 17, fontWeight: '700' }}>
            {title}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
          <BackLink />
          <RefreshButton />
        </View>
      </View>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void syncAll();
    return watchConnection();
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
      <Stack.Screen name="inspection" options={{ header: () => <ScreenHeader title="Inspection" /> }} />
      <Stack.Screen name="rental-history" options={{ header: () => <ScreenHeader /> }} />
    </Stack>
  );
}
