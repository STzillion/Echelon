import { Tabs } from 'expo-router';
import React from 'react';
import {Home,Plus,User,Scale, BookOpen, Speech, Vote, SearchIcon,} from 'lucide-react-native'
import {useSafeRouter as useRouter} from '@/lib/fixExpoRouterBug';

export default function TabLayout() {
  const router = useRouter();
  return (
    <Tabs
     screenOptions={{
     tabBarActiveTintColor: 'cyan',         // your logo's primary color
     tabBarInactiveTintColor: 'white',       // make all icons match
     tabBarStyle: 
     {
       backgroundColor: '#000',                // matches your app's black background
       borderTopColor: '#111',                 // subtle top border (optional)
     },
      headerShown: false,
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarIcon: ({ color, focused }) => (<Home color={color} size = {28} />
          ),
        }}
      />
        <Tabs.Screen
        name="topics"
        options={{
            title: '',
          tabBarIcon: ({ color, focused }) => (<SearchIcon color={color} size = {28} />
          ),
        }}
      />
       <Tabs.Screen
        name="empty"
        options={{
            title: '',
          tabBarIcon: ({ color, focused }) => (<Plus color={color} size = {31} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/post');

          },
        }}
      />
        <Tabs.Screen
        name="debates"
        options={{
            title: '',
          tabBarIcon: ({ color, focused }) => (<Vote color={color} size = {30} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
            title: '',
          tabBarIcon: ({ color, focused }) => (<User color={color} size = {28} />
          ),
        }}
      />
    </Tabs>
    
  );
}

