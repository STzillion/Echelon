import { SafeAreaView, Text, TextInput, View, StyleSheet } from 'react-native';
import React, { useState } from 'react';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { TouchableOpacity } from 'react-native';
//import { useAuth } from '@/providers/AuthProvider';

export default function CreateAccountScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
 // const {createUser} = useAuth();
  const router = useRouter();

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'http://localhost:8081/debates',
      },
    });

    if (error) {
      console.log('Sign up error:', error.message);
    } else {
      router.replace('/(auth)/check-email');
      console.log(password);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Create your account</Text>

       <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backButtonText}>{''} Back</Text>
        </TouchableOpacity>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#aaa"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#aaa"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <Button onPress={handleSignUp} style={styles.button}>
        <ButtonText style={styles.buttonText}>Done</ButtonText>
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
  backgroundColor: '#fff',
  borderRadius: 30,
  height: 52, // ✅ same as home screen
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 8,
  marginBottom: 16,
},
  buttonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
  },
    backButton: {
    position: 'absolute',
    top: 50,
    left: 24,
    zIndex: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

