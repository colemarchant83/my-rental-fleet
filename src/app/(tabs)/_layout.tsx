import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { RefreshButton, HomeButton } from '../../components/back-link';
import { BrandMenu } from '../../components/brand-menu';
import { theme } from '../../theme';

enableFreeze(false);

function PillLabel({ focused, children }: { focused: boolean; children: string }) {
  return (
    <View style={{ backgroundColor: focused ? theme.ink : 'transparent', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 6, maxWidth: '100%' }}>
      <Text numberOfLines={2} style={{ color: focused ? theme.white : theme.text, fontSize: 13, fontWeight: '800', textAlign: 'center', lineHeight: 16 }}>
        {children}
      </Text>
    </View>
  );
}

function HeaderActions({ home }: { home?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
      {home ? <HomeButton /> : null}
      <RefreshButton />
    </View>
  );
}

function TopTab({ href, focused, children }: { href: '/' | '/maintenance' | '/add'; focused: boolean; children: string }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(href)} style={{ backgroundColor: focused ? theme.ink : 'transparent', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 }}>
      <Text style={{ color: focused ? theme.white : theme.text, fontSize: 14, fontWeight: '800' }}>{children}</Text>
    </Pressable>
  );
}

function DesktopHeader() {
  const path = usePathname();
  return (
    <View style={{ backgroundColor: theme.bg, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <BrandMenu />
        <RefreshButton />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <TopTab href="/" focused={path === '/' || path === ''}>Rentals</TopTab>
        <TopTab href="/maintenance" focused={path.includes('maintenance')}>Maintenance</TopTab>
        <TopTab href="/add" focused={path.includes('/add')}>Add/Delete Vehicle</TopTab>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const safeBottom = Math.max(insets.bottom, 10);
  const labelSpace = 66;

  return (
    <Tabs
      detachInactiveScreens={false}
      safeAreaInsets={{ top: insets.top, right: insets.right, bottom: 0, left: insets.left }}
      screenOptions={{
        freezeOnBlur: false,
        lazy: false,
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        header: desktop ? () => <DesktopHeader /> : undefined,
        headerTitle: desktop ? undefined : () => <BrandMenu />,
        headerRight: desktop ? undefined : () => <HeaderActions />,
        headerRightContainerStyle: { paddingRight: 16 },
        tabBarIcon: () => <View />,
        tabBarIconStyle: { width: 0, height: 0, display: 'none', overflow: 'hidden' },
        tabBarItemStyle: { paddingHorizontal: 2, paddingTop: 2, justifyContent: 'flex-start', alignItems: 'center' },
        tabBarStyle: desktop
          ? { display: 'none', height: 0 }
          : {
              backgroundColor: theme.card,
              borderTopColor: theme.line,
              borderTopWidth: 1,
              height: labelSpace + safeBottom,
              paddingTop: 2,
              paddingBottom: safeBottom,
            },
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Rental Fleet',
          tabBarLabel: ({ focused }) => <PillLabel focused={focused}>Rentals</PillLabel>,
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: 'My Rental Fleet',
          tabBarLabel: ({ focused }) => <PillLabel focused={focused}>Maintenance</PillLabel>,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          headerShown: desktop,
          tabBarLabel: ({ focused }) => <PillLabel focused={focused}>{'Add/Delete\nVehicle'}</PillLabel>,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}