import { SafeAreaView, View, Platform, StyleSheet, Text, Image } from 'react-native';
import React from 'react';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          Platform.OS === 'web'
            ? 'http://localhost:8081/(auth)/callback'
            : 'toothandnail://(auth)/callback',
      },
    });
    if (error) console.log('Google sign-in error:', error.message);
  };

  return (
    <LinearGradient
      colors={['#0d0d0d', '#1a1a1a', '#000']}
      style={styles.container}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <SafeAreaView style={styles.content}>
        <Image
          source={require('@/assets/images/EchelonLogoBlue.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.header}>Debate Like It Matters.</Text>

        {/* Google Button with Press Feedback */}
        <Button onPress={handleGoogleSignIn} style={styles.whiteButton}>
          {({ pressed }) => (
            <View
              style={[
                styles.buttonContent,
                { transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
            >
              <Image
                source={require('@/assets/images/google.png')}
                style={styles.googleIcon}
                resizeMode="contain"
              />
              <ButtonText style={styles.blackText}>Sign up with Google</ButtonText>
            </View>
          )}
        </Button>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.line} />
        </View>

        {/* Create Account Button with Press Feedback */}
        <Button onPress={() => router.push('/(auth)/create-account')} style={styles.whiteButton}>
          {({ pressed }) => (
            <View
              style={[
                styles.buttonContent,
                { transform: [{ scale: pressed ? 0.96 : 1 }] },
              ]}
            >
              <ButtonText style={styles.blackText}>Create account</ButtonText>
            </View>
          )}
        </Button>

        {/* Already have account */}
        <View style={styles.loginContainer}>
          <Text style={styles.text}>Have an account already?</Text>
          <Text style={styles.loginText} onPress={() => router.push('/(auth)/login')}>
            Log in
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  glow1: {
    position: 'absolute',
    top: -100,
    left: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#00FFFF',
    opacity: 0.12,
  },
  glow2: {
    position: 'absolute',
    bottom: -120,
    right: -80,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#0077FF',
    opacity: 0.12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 24,
  },
  logo: {
    width: 300,
    height: 100,
    alignSelf: 'center',
    marginBottom: 24,
  },
  header: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
  },
  whiteButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 30,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  blackText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#444',
  },
  orText: {
    marginHorizontal: 8,
    color: '#ccc',
    fontSize: 14,
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  text: {
    color: '#fff',
    fontSize: 14,
  },
  loginText: {
    color: '#00FFFF',
    marginTop: 4,
    fontWeight: '600',
    fontSize: 16,
  },
});
