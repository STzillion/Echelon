import { SafeAreaView, View, Image, Linking } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { useSafeRouter as useRouter } from '@/lib/fixExpoRouterBug';

export default function CheckEmailScreen() {
  const router = useRouter();

  const handleOpenEmailApp = () => {
    Linking.openURL('mailto:');
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#f9fafb',
      }}
    >
      <Image
        source={require('@/assets/images/adaptive-icon.png')}
        style={{ width: 180, height: 180, marginBottom: 32 }}
        resizeMode="contain"
      />

      <Text className="text-2xl font-bold text-center mb-3">Verify Your Email</Text>
      <Text className="text-base text-center text-gray-600 mb-6">
        We've sent a link to your inbox. Tap the button in your email to verify your account and continue.
      </Text>

      {/* NEW CONTINUE BUTTON at the top */}
      <Button
        onPress={() => router.replace('/(auth)/username')}
        style={{ marginBottom: 12, width: '100%' }}
      >
        <ButtonText>Continue</ButtonText>
      </Button>

      <Button onPress={handleOpenEmailApp} style={{ marginBottom: 12, width: '100%' }}>
        <ButtonText>Open Email App</ButtonText>
      </Button>

      <Button
        variant="outline"
        onPress={() => router.replace('/')}
        style={{ width: '100%' }}
      >
        <ButtonText>Back to Home</ButtonText>
      </Button>
    </SafeAreaView>
  );
}


