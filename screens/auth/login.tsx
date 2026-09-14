import { SafeAreaView, Text, TextInput, View, StyleSheet, Image } from 'react-native';
import React, { useState } from 'react';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';



export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.log('Login error:', error.message);
    } 
  };

  return (
    <LinearGradient
      colors={['#0d0d0d', '#1a1a1a', '#000']}
      style={styles.screen}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <Image
        source={require('@/assets/images/EchelonLogoGold.png')}
        style={styles.backgroundImage}
        resizeMode="contain"
      />
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <LinearGradient
        colors={['rgba(255,255,255,0.04)', 'rgba(0,170,210,0.03)', 'rgba(0,0,0,0.18)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Log in to your account</Text>

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
      
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>{''} Back</Text>
      </TouchableOpacity>


        <Button onPress={handleLogin} style={styles.button}>
          <ButtonText style={styles.buttonText}>Log In</ButtonText>
        </Button>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  backgroundImage: {
    position: 'absolute',
    width: 560,
    height: 560,
    alignSelf: 'center',
    top: '12%',
    opacity: 0.07,
  },
  header: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
  },
  input: {
    width: '85%',
    maxWidth: 360,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  button: {
    width: '85%',
    maxWidth: 360,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderRadius: 30,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
 },
  buttonText: {
    color: '#fff',
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

