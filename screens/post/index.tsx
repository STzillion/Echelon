import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import ImageWithText from '@/components/ui/image-with-text';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Post, usedPosts } from '@/providers/PostsProvider';
import { useUploadFile } from '@/providers/uploadfile';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Camera, Hash, Images, VideoIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, TouchableWithoutFeedback, View, } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Input from './input';

export default () => {
  const { user } = useAuth();
  const { addPost } = usedPosts();
  const [text, setText] = useState('');
  const {updatePost} = usedPosts();
  //const isImagePostEnabled = useAppStore((state) => state.isImagePostEnabled);
  const [photo, setPhoto] = useState<string>('');          
  const [ImageFilename, setImageFilename] = useState<string | null>(null); 
  const [VideoFilename, setVideoFilename] = useState<string | null>(null); 
  const [isUploading, setIsUploading] = useState(false);
  const [isDebate, setIsDebate] = useState(false);
  const { cameraPhotoUri } = useLocalSearchParams<{ cameraPhotoUri?: string }>();
  const [video, setVideo] = useState<string>('');
  const regex = /(#\w+)|(@\w+)|([^#@]+)/g;
  const textArray = Array.from(text.matchAll(regex), m => m[0]);



 
  const post: Post = {
    id: 'temp-id',
    user_id: (user as any)?.id || '',
    text,
    file: '',
    created_at: new Date().toISOString(),
  };
 
  const isDisabled = (!text.trim() && !photo && !video) || isUploading;
  
   const videoPlayer = useVideoPlayer(video, (player) => {
    player.loop = true;
    player.play();
  });

  // Upload file to Supabase 
  const uploadFile = useUploadFile().uploadFile;

  const pickVideo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
    });
    

    if (!result.canceled && result.assets?.[0]) {
      const videoUri = result.assets[0].uri;
      const videoId = result.assets[0].assetId ?? Crypto.randomUUID();
      const VideogeneratedName = `${Date.now()}.mp4`;

      console.log('=== PICK VIDEO DEBUG ===');
      console.log('Video URI:', videoUri);
      console.log('Generated name:', VideogeneratedName);


      const userId = (user as any)?.id;
      if (!userId) {
        Alert.alert('Upload error', 'User not signed in.');
        setVideo('');
        setIsUploading(false);
        return;
      }

      setVideo(videoUri);
      setIsUploading(true);

      const uploadVideo = await uploadFile(userId, videoUri, 'video/mp4', VideogeneratedName);

      setIsUploading(false);

      if (uploadVideo) {
        setVideoFilename(uploadVideo);
      } else {
        setVideo('');
        setVideoFilename(null);
      }
    }
  };

  const addphoto = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    

    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      const type = result.assets[0].mimeType ?? 'image/jpeg';
      const id = result.assets[0].assetId ?? Crypto.randomUUID();
      setPhoto(uri);

      
      const userId = (user as any)?.id;
      if (!userId) {
        Alert.alert('Upload error', 'User not signed in.');
        setPhoto('');
        setImageFilename(null);
        return;
      }
      const generatedName = `${Date.now()}.jpg`;
      const uploadedName = await uploadFile(
        userId,
        uri,
        type,
        generatedName
      );



      if (uploadedName) {
        setImageFilename(uploadedName);
      } else {
       
        setPhoto('');
        setImageFilename(null);
      }
    }
  };


  const handleIconPress = (idx: number) => {
    if (idx === 0) {
      addphoto();
    }
    else if(idx ===1){
      router.push({
        pathname:'/camera',
        params: {threadId: null}
      });
    }
    else if (idx === 2) {
      pickVideo();
    };
  }

  const submitPost = async (type: boolean) => {
    setIsDebate(type);

    if (!user) return;

     console.log('=== BEFORE INSERT ===');
     console.log('ImageFilename:', ImageFilename);
     console.log('VideoFilename:', VideoFilename);
     console.log('Will save:', ImageFilename || VideoFilename);
     console.log('=====================');

     console.log({
        id: post.id,
        parent_id: post.parent_id,
        text: post.text,
        user_id: post.user_id,
        created_at: post.created_at,
      });


    const mediaFile = VideoFilename ?? ImageFilename ?? null;
    const tagName = textArray.find((t) => t?.startsWith('#')) ?? null;

    try {
      if (tagName) {
        await supabase.from('Tag').upsert({ name: tagName, updated_at: new Date() }).select();
      }

      // Inserting post and request the related Tag row
      
      const { data, error } = await supabase
        .from('Post')
        .insert({
          id: Crypto.randomUUID(),
          user_id: (user as any)?.id,
          text,
          file: mediaFile,
          tag_name: tagName,
          debate_side: type ? 'root' : null,
        })
        .select('*, Tag(name)');

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
          isDebate: type,
          debate_side: type ? 'root' : null,
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

  const handlePostTypeSelection = () => {
    if (isDisabled || isUploading) return;

    Alert.alert(
      'Post type',
      'Do you want to post a debate or a regular post?',
      [
        {
          text: 'Regular post',
          onPress: () => submitPost(false),
        },
        {
          text: 'Debate',
          onPress: () => submitPost(true),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const icons = [Images, Camera, VideoIcon, Hash];



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
                  <Input 
                    value={{
                      id: 'temp-id',
                      user_id: (user as any)?.id || '',
                      text: text,
                      file: '',
                      created_at: new Date().toISOString(),
                    }}
                    onChange={(id, key, value) => {
                      if (key === 'text') {
                        setText(value);
                      }
                    }}
                    textArray={textArray}
                  />

                  {/* Local preview */}
                  {photo ? (
                    <ImageWithText
                      textArray={textArray}
                      source={{ uri: photo }}
                      style={{ width: 100, height: 100, borderRadius: 10, marginTop: 8 }}
                    />
                  ) : null}
                  {/* Video preview */}
                  {video ? (
                    <VideoView
                      player={videoPlayer}
                      style={{ width: 200, height: 200, borderRadius: 10, marginTop: 8 }}
                      contentFit="contain"
                      nativeControls={true}
                    />
                  ) : null}

                  <HStack style={styles.actionIconsRow}>
                    {icons.map((IconComponent, idx) => (
                      <Pressable onPress={() => handleIconPress(idx)} key={idx}>
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
                onPress={handlePostTypeSelection}
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
    gap: 38,
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

