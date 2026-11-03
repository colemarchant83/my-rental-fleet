import { Tabs } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';



export default function TabLayout() {

  return (

    <Tabs

      screenOptions={{

        tabBarActiveTintColor: '#f59e0b',

        tabBarInactiveTintColor: '#9ca3af',

        tabBarStyle: {

          backgroundColor: '#1f2937',

          borderTopColor: '#374151',

        },

        headerStyle: {

          backgroundColor: '#111827',

        },

        headerTintColor: '#fff',

      }}

    >

      <Tabs.Screen

        name="index"

        options={{

          title: 'Rental Log',

          tabBarIcon: ({ color }) => <Ionicons name="car-outline" size={24} color={color} />,

        }}

      />

      <Tabs.Screen

        name="maintenance"

        options={{

          title: 'Maintenance Log',

          tabBarIcon: ({ color }) => <Ionicons name="construct-outline" size={24} color={color} />,

        }}

      />

      <Tabs.Screen

        name="add"

        options={{

          title: 'Add Vehicle',

          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={24} color={color} />,

        }}

      />

    </Tabs>

  );

}