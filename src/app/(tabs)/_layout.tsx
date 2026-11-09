import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshButton } from '../../components/back-link';
import { theme } from '../../theme';

function PillLabel({ focused, children }: { focused: boolean; children: string }) {
  return (
    <View style={{ backgroundColor: focused ? theme.ink : 'transparent', borderRadius: 16, paddingHorizontal: 8, paddingVertical: 7 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: focused ? theme.white : theme.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>
        {children}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 12) + 18;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <RefreshButton />,
        headerRightContainerStyle: { paddingRight: 16 },
        tabBarIcon: () => null,
        tabBarStyle: {
          backgroundColor: theme.bg,
          borderTopColor: theme.line,
          height: 54 + bottom,
          paddingTop: 6,
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
          title: 'My Rental Fleet',
          tabBarLabel: ({ focused }) => <PillLabel focused={focused}>Add Vehicle</PillLabel>,
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
