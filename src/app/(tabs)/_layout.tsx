import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { enableFreeze } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshButton, HomeButton } from '../../components/back-link';
import { BrandMenu } from '../../components/brand-menu';
import { theme } from '../../theme';

enableFreeze(false);

function PillLabel({ focused, children }: { focused: boolean; children: string }) {
  return (
    <View style={{ backgroundColor: focused ? theme.ink : 'transparent', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 6, maxWidth: '100%' }}>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72} style={{ color: focused ? theme.white : theme.text, fontSize: 13, fontWeight: '800', textAlign: 'center', lineHeight: 16 }}>
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

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 12) + 20;

  return (
    <Tabs
      detachInactiveScreens={false}
      screenOptions={{
        freezeOnBlur: false,
        lazy: false,
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerTitleAlign: 'left',
        headerTitle: () => <BrandMenu />,
        headerRight: () => <HeaderActions />,
        headerRightContainerStyle: { paddingRight: 16 },
        tabBarIcon: () => null,
        tabBarIconStyle: { width: 0, height: 0, display: 'none' },
        tabBarItemStyle: { paddingHorizontal: 2, paddingTop: 0, justifyContent: 'center' },
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.line,
          borderTopWidth: 1,
          height: 58 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
        },
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Rental Fleet',
          tabBarLabel: ({ focused }) => <PillLabel focused={focused}>Rental Log</PillLabel>,
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: 'My Rental Fleet',
          tabBarLabel: ({ focused }) => <PillLabel focused={focused}>Maintenance Log</PillLabel>,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          headerShown: false,
          tabBarLabel: ({ focused }) => <PillLabel focused={focused}>Add/Delete Vehicle</PillLabel>,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
