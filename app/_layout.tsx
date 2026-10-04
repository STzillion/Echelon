import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";
import { AuthProvider } from '@/providers/AuthProvider';
import { PostsProvider } from '@/providers/PostsProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import React from 'react';
import 'react-native-reanimated';



export default function RootLayout() {
  const [queryClient] = React.useState(() => new QueryClient());
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
   //Apparently font loading only happens once I've started. Gotta come back to this
    return null;
  }

  return (
    <GluestackUIProvider mode="light">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PostsProvider>
            <Stack initialRouteName='(auth)' screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false}} />
              <Stack.Screen name="post" options={{ headerShown: false, presentation:'modal' }} />
              <Stack.Screen name="camera" options={{ headerShown: false, presentation:'modal' }} />
              <Stack.Screen
                name="mainDebate"
                options={{ headerShown: false, contentStyle: { backgroundColor: '#0f0f0f' } }}
              />
              <Stack.Screen name="user" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </PostsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
