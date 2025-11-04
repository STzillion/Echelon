import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Image as RNImage,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/providers/AuthProvider';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Button, ButtonText } from '@/components/ui/button';
import { Input, InputField } from '@/components/ui/input';
import { Images, Camera, Mic, VideoIcon, Hash } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { usedPosts } from '@/providers/PostsProvider';
import { Pressable } from '@/components/ui/pressable';
import * as ImagePicker from 'expo-image-picker';

export default function PostScreen() {
  const { user } = useAuth();
  const { addPost } = usedPosts();

  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string>('');          
  const [fileName, setFileName] = useState<string | null>(null); 
  const [isUploading, setIsUploading] = useState(false);

  const isDisabled = !text.trim() && !photo; 

  // Upload file to Supabase 
  const uploadFile = async (uri: string, type: string | null, name: string) => {
    try {
      setIsUploading(true);

      
      const res = await fetch(uri);
      const arrayBuffer = await res.arrayBuffer();

      
      const { data, error } = await supabase.storage
        .from('files') // bucket name
        .upload(`${(user as any).id}/${name}`, arrayBuffer, {
          contentType: type ?? 'image/jpeg',
          upsert: true,
        });

      console.log('Upload result:', data, error);
      if (error) throw error;

      return name; // return fileName
    } catch (err) {
      console.error('Upload failed:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const addphoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      const type = result.assets[0].mimeType ?? 'image/jpeg';
      setPhoto(uri);

      
      const generatedName = `${Date.now()}.jpg`;
      const uploadedName = await uploadFile(uri, type, generatedName);

      if (uploadedName) {
        setFileName(uploadedName);
      } else {
       
        setPhoto('');
        setFileName(null);
      }
    }
  };

  const onPress = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('Post')
        .insert({
          id: Crypto.randomUUID(),
          user_id: (user as any)?.id,
          text,
          file: fileName, // setting just the filename to the table. I previously had a bug here with the full path
        })
        .select();

      if (error) {
        console.error('Post insert error:', error);
        return;
      }

      if (data && data[0]) {
        // Fetch user info for the new post
        const { data: userData, error: userError } = await supabase
          .from('User')
          .select('id, username, avatar')
          .eq('id', (user as any)?.id)
          .single();

        if (userError) {
          console.log('User fetch error:', userError);
        }

        
        const postWithUser = {
          ...data[0],
          user:
            userData || {
              id: (user as any)?.id,
              username: (user as any)?.username,
              avatar: (user as any)?.avatar,
            },
        };

        addPost(postWithUser);
        router.back();
      }
    } catch (err) {
      console.error('onPress error:', err);
    }
  };

  const icons = [Images, Camera, Mic, VideoIcon, Hash];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={75}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <VStack style={{ flex: 1, justifyContent: 'space-between' }}>
            {/* Header */}
            <HStack style={styles.headerRow}>
              <Button
                onPress={() => router.back()}
                size="md"
                variant="link"
                style={styles.cancelButton}
              >
                <ButtonText style={styles.cancelText}>Cancel</ButtonText>
              </Button>
              <Text style={styles.headerTitle}>New opinion</Text>
              <View style={{ width: 40 }} />
            </HStack>

            {/* Main content */}
            <VStack style={styles.body}>
              <HStack style={styles.composeRow}>
                <Avatar size="md" style={styles.avatarMarginTop}>
                  {(user as any)?.avatar ? (
                    <AvatarImage source={{ uri: (user as any)?.avatar }} />
                  ) : (
                    <View style={styles.grayCircleAvatar}>
                      <Text style={styles.grayCircleText}>
                        {(user as any)?.username?.[0]?.toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                </Avatar>

                <VStack style={styles.inputArea}>
                  <Text style={styles.username}>
                    {(user as any)?.username || 'Unknown'}
                  </Text>
                  <Input size="md" style={styles.inputBox}>
                    <InputField
                      placeholder="Defend your opinion..."
                      style={styles.inputText}
                      placeholderTextColor="#b0b0b0"
                      value={text}
                      onChangeText={setText}
                      multiline
                    />
                  </Input>

                  {/* Local preview only */}
                  {photo ? (
                    <RNImage
                      source={{ uri: photo }}
                      style={{ width: 100, height: 100, borderRadius: 10, marginTop: 8 }}
                    />
                  ) : null}

                  <HStack style={styles.actionIconsRow}>
                    {icons.map((IconComponent, idx) => (
                      <Pressable onPress={addphoto} key={idx}>
                        <View>
                          <IconComponent size={24} color="white" strokeWidth={0.9} />
                        </View>
                      </Pressable>
                    ))}
                  </HStack>
                </VStack>
              </HStack>
            </VStack>

            {/* Post Button */}
            <HStack style={styles.footerRow}>
              <Text style={styles.replyInfo}>Anyone can reply & debate</Text>
              <Button
                style={[styles.postButton, { opacity: isDisabled ? 0.3 : 1 }]}
                onPress={onPress}
                disabled={isDisabled || isUploading}
              >
                <ButtonText>{isUploading ? 'Uploading...' : 'Post'}</ButtonText>
              </Button>
            </HStack>
          </VStack>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 28,
    paddingBottom: 8,
  },

  cancelButton: {
    width: 56,
  },

  cancelText: {
    color: '#b0b0b0',
    fontSize: 16,
  },

  headerTitle: {
    flex: 2,
    textAlign: 'center',
    fontWeight: 'bold',
    color: 'white',
    fontSize: 16,
    marginLeft: -28,
  },

  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
  },

  inputArea: {
    flex: 1,
    marginLeft: 12,
  },

  username: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },

  inputBox: {
    backgroundColor: '#0f0f0f',
    borderRadius: 14,
    padding: 0,
    minHeight: 40,
    justifyContent: 'flex-start',
    marginBottom: 8,
  },

  inputText: {
    color: 'white',
    fontSize: 14,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  actionIconsRow: {
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: 8,
    justifyContent: 'flex-start',
    gap: 24,
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  replyInfo: {
    color: '#888',
    fontSize: 15,
  },

  postButton: {
    borderRadius: 9999,
    paddingHorizontal: 24,
    paddingVertical: 8,
    backgroundColor: '#fffefeff',
    shadowColor: '#ffffffff',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },

  grayCircleAvatar: {
    backgroundColor: '#232323',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  grayCircleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  avatarMarginTop: {
    marginTop: 8,
  },
});

