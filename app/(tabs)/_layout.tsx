import { Tabs } from 'expo-router';
import React from 'react';
import Ionicons from '@expo/vector-icons/build/Ionicons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0a7ea4',
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name= {focused ?'home': 'home-outline'} color={color} size = {24} />
          ),
        }}
      />
    </Tabs>
  );
}

