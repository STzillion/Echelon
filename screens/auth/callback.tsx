import { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function CallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      const { access_token, refresh_token } = params;

      // Note to self: Always use getSession for redirects
      const { error } = await supabase.auth.getSession()

      if (error) {
        console.error('Verification error:', error.message);

        router.replace('/(auth)/username');
      } else {

       // router.replace('/(auth)/username');
      }
    };

    handleOAuthRedirect();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
    </SafeAreaView>
  );
}
