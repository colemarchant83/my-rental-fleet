import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { theme } from '../../theme';

function PillLabel({ focused, children }: { focused: boolean; children: string }) {
  return (
    <View style={{ backgroundColor: focused ? theme.ink : 'transparent', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, minWidth: 86 }}>
      <Text style={{ color: focused ? theme.white : theme.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' }}>{children}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        tabBarIcon: () => null,
        tabBarStyle: { backgroundColor: theme.bg, borderTopColor: theme.line, height: 78, paddingTop: 8 },
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
