import { SafeAreaView } from 'react-native';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonText } from '@/components/ui/button';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import React from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function CreateAccount() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const router = useRouter();

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'toothandnail://(auth)/verify',
      },
    });

    if (error) {
      console.log('Sign up error:', error.message);
    } else {
      router.replace('/(auth)/check-email');
    }
  };

  return (
    <SafeAreaView style={{ padding: 24 }}>
      <VStack className="space-y-4">
        <Text className="text-xl font-bold text-center">Create Account</Text>

        <Input>
          <InputField
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
        </Input>

        <Input>
          <InputField
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </Input>

        <Button onPress={handleSignUp}>
          <ButtonText>Done</ButtonText>
        </Button>
      </VStack>
    </SafeAreaView>
  );
}
