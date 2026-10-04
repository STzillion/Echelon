import { useSafeRouter as useRouter } from '@/lib/fixExpoRouterBug';
import { Tabs } from 'expo-router';
import { Home, Plus, SearchIcon, User, Vote, } from 'lucide-react-native';
import { Platform } from 'react-native';

export default function TabLayout() {
  const router = useRouter();
  return (
    <Tabs
     screenOptions={{
     tabBarActiveTintColor: 'cyan',         // your logo's primary color
     tabBarInactiveTintColor: 'white',       // make all icons match
     sceneStyle: { backgroundColor: '#0f0f0f' },
     ...(Platform.OS === 'web'
       ? {
           tabBarPosition: 'left',
           tabBarVariant: 'material',
           tabBarShowLabel: false,
           tabBarStyle: {
             position: 'absolute',
             left: 0,
             top: 0,
             bottom: 0,
             zIndex: 1000,
             elevation: 1000,
             width: 64,
             minWidth: 64,
             padding: 4,
             backgroundColor: '#0f0f0f',
             borderColor: '#242424',
           },
         }
       : {
           tabBarStyle: {
             backgroundColor: '#000',
             borderTopColor: '#111',
           },
         }),
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

