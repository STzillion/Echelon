import { SafeAreaView, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import React, { useState } from 'react';
import { Button, ButtonText } from '@/components/ui/button';
import { useRouter } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';

export default function UsernameScreen() {
  const [username, setUsername] = useState('');
  const {createUser} = useAuth();
  
  const router = useRouter();

  /*const handleUsernameSubmit = async () => {
    console.log(username);
    createUser(username);

   
  };
  */

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Pick your username</Text>

      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>{''} Back</Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Username"
        placeholderTextColor="#aaa"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={styles.input}
      />

      <Button onPress={ () => createUser(username)} style={styles.button}>
        <ButtonText style={styles.buttonText}>Continue</ButtonText>
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
    height: 52,
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
