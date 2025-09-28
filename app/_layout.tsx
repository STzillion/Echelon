import { useFonts } from 'expo-font';
import "@/global.css";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AuthProvider } from '@/providers/AuthProvider';
import { PostsProvider } from '@/providers/PostsProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';



export default function RootLayout() {
  const queryClient = new QueryClient();
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
            <Stack initialRouteName='(auth)'>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false}} />
              <Stack.Screen name="post" options={{ headerShown: false, presentation:'modal' }} />
              <Stack.Screen name="+not-found" />
            </Stack>
          </PostsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
