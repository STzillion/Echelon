import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { usePosts } from '@/hooks/use-posts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useUploadFile } from '@/providers/uploadfile';
import { useQueryClient } from '@tanstack/react-query';
import { ResizeMode, Video } from 'expo-av';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Images, VideoIcon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImageWithText from '../../../components/ui/image-with-text';

export default function DebatePage() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user } = useAuth();
  const currentUser = user as any;
  const router = useRouter();
  const [post, setPost] = useState<{ id: string; text?: string; file?: string; user_id?: string; user?: { username: string } } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [defendText, setDefendText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputHeight, setInputHeight] = useState<number>(0);
  const [photo, setPhoto] = useState<string>('');
  const [imageFilename, setImageFilename] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<string>('');
  const [videoFilename, setVideoFilename] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const {data, refetch} = usePosts();
  const queryClient = useQueryClient(); 
  const uploadFile = useUploadFile().uploadFile;

  useEffect(() => {
    const loadPost = async () => {
      if (!postId) return;
      setFetching(true);
      const { data, error } = await supabase
        .from('Post')
        .select('*, user:User!user_id(*)')
        .eq('id', postId)
        .single();
      if (error) {
        console.error('Error loading post for debate', error);
        Alert.alert('Error', 'Could not load the selected post.');
      } else {
        setPost(data as any);
      }
      setFetching(false);
    };
    loadPost();
  }, [postId]);

  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

   

  const handleDefend = async () => {
    if (!defendText.trim()) {
      Alert.alert('Please write something', 'Enter your opinion to defend.');
      return;
    }
    if (!postId || !currentUser?.id) {
      Alert.alert('Cannot post', 'Missing post or user.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (!post?.user_id) {
        Alert.alert('Error', 'Cannot determine the original post author.');
        return;
      }

      const { error } = await supabase.from('Debate').insert({
        id: Crypto.randomUUID(),
        root_post_id: postId,
        challenger_id: currentUser.id,
        opponent_id: post.user_id,
        challenger_text: defendText,
        status: 'open',
        // developers can add a `challenger_file` column and include it here.
      });

      console.log('challenger_text:', defendText);

      if (error) {
        console.error('Error creating debate:', error);
        Alert.alert('Error', 'Could not create debate.');
      } else {
        await queryClient.invalidateQueries({ queryKey: ['posts'] });
        // After posting navigate to the main home tab
        router.push('/(tabs)');
      }
    } finally {
      setIsSubmitting(false);
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
      const generatedName = `${Date.now()}.jpg`;

      const userId = (user as any)?.id;
      if (!userId) {
        Alert.alert('Upload error', 'User not signed in.');
        return;
      }

      setPhoto(uri);
      setIsUploadingFile(true);
      const uploadedName = await uploadFile(userId, uri, type, generatedName);
      setIsUploadingFile(false);

      if (uploadedName) {
        setImageFilename(uploadedName);
      } else {
        setPhoto('');
        setImageFilename(null);
      }
    }
  };

  const pickVideo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.[0]) {
      const videoUri = result.assets[0].uri;
      const VideogeneratedName = `${Date.now()}.mp4`;
      const userId = (user as any)?.id;
      if (!userId) {
        Alert.alert('Upload error', 'User not signed in.');
        return;
      }

      setVideoFile(videoUri);
      setIsUploadingFile(true);
      const uploadVideo = await uploadFile(userId, videoUri, 'video/mp4', VideogeneratedName);
      setIsUploadingFile(false);

      if (uploadVideo) {
        setVideoFilename(uploadVideo);
      } else {
        setVideoFile('');
        setVideoFilename(null);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={75}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <VStack style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20 }}>
            <View>
              <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>← Back</Text>
            </Pressable>
            <Text style={styles.screenTitle}>Debate</Text>
          </View>

          {fetching ? (
            <ActivityIndicator color="#82b1ff" size="large" style={styles.loading} />
          ) : post ? (
            <>
              <View style={[
                styles.postCard,
                keyboardVisible && post?.file && { maxHeight: 200 }
              ]}>
                <View style={styles.postMetaRow}>
                  <View style={styles.badge}> 
                    <Text style={styles.badgeText}>OP</Text>
                  </View>
                  <Text style={styles.postUser}>{post.user?.username ?? 'Unknown'}</Text>
                </View>
                <Text style={styles.postText}>{post.text ?? 'No post text available.'}</Text>
                {post.file ? (
                  post.file.endsWith('.mp4') ? (
                    <View style={styles.media}>
                      <Text style={styles.mediaLabel}>Video attached</Text>
                      <Video
                        source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user_id}/${post.file}` }}
                        style={styles.mediaVideo}
                        shouldPlay={false}
                        resizeMode={ResizeMode.CONTAIN}
                      />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user_id}/${post.file}` }}
                      style={styles.mediaImage}
                    />
                  )
                ) : null}
              </View>

              <View style={styles.vsContainer}>
                <View style={styles.vsLine} />
                <Text style={styles.vsText}>VS</Text>
                <View style={styles.vsLine} />
              </View>
            </>
          ) : (
            <Text style={styles.errorText}>Unable to load the post.</Text>
          )}

            </View>

          <View style={styles.composerCard}>
            <View style={styles.composerHeaderRow}>
              <Text style={styles.subTitle}>Rebuttal</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.submitButton,
                  (!defendText.trim() || isSubmitting) && styles.submitButtonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleDefend}
                disabled={!defendText.trim() || isSubmitting}
              >
                <Text style={styles.submitButtonText}>{isSubmitting ? 'Posting...' : 'Post'}</Text>
              </Pressable>
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.textInput,
                      { minHeight: Math.max(56, inputHeight), flex: 1, color: '#f5f8ff', backgroundColor: 'transparent', borderWidth: 0, padding: 0 },
                ]}
                placeholder="Type your response"
                placeholderTextColor="rgba(255,255,255,0.55)"
                multiline
                value={defendText}
                onChangeText={setDefendText}
                onContentSizeChange={(e) => {
                  const h = e.nativeEvent.contentSize.height + 12; // add padding buffer
                  setInputHeight(h);
                }}
              />

              {/* Icons overlay inside the input box; hide when there's text or media */}
              {(!defendText.trim() && !photo && !videoFile) ? (
                <View style={styles.iconsOverlay} pointerEvents="box-none">
                  <Pressable onPress={addphoto} style={styles.iconButtonInline}>
                    <Images size={22} color="white" strokeWidth={1} />
                  </Pressable>
                  <Pressable onPress={() => { /* camera navigation if desired */ }} style={styles.iconButtonInline}>
                    <Camera size={22} color="white" strokeWidth={1} />
                  </Pressable>
                  <Pressable onPress={pickVideo} style={styles.iconButtonInline}>
                    <VideoIcon size={22} color="white" strokeWidth={1} />
                  </Pressable>
                </View>
              ) : null}

              {/* Media preview rendered inside the input box */}
              {photo ? (
                <ImageWithText
                  textArray={[]}
                  source={{ uri: photo }}
                  style={styles.postImagePreview}
                />
              ) : null}
              {videoFile ? (
                <View style={styles.postVideoPreview}>
                  <Video source={{ uri: videoFile }} style={{ width: '100%', height: '100%' }} shouldPlay={false} resizeMode={ResizeMode.CONTAIN} />
                </View>
              ) : null}
            </View>
          </View>
        </VStack>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerRow: {
    marginBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  backButtonText: {
    color: '#dbe2ff',
    fontWeight: '700',
    fontSize: 13,
  },
  screenTitle: {
    color: '#f8fbff',
    fontWeight: '900',
    fontSize: 32,
    marginBottom: 8,
  },
  description: {
    color: '#aab8d7',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: '88%',
  },
  loading: {
    marginTop: 30,
  },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
    overflow: 'hidden',
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  badge: {
    backgroundColor: 'rgba(116, 149, 255, 0.18)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 10,
  },
  badgeText: {
    color: '#d2e0ff',
    fontSize: 11,
    fontWeight: '700',
  },
  postUser: {
    color: '#e7edff',
    fontWeight: '700',
    fontSize: 15,
  },
  postText: {
    color: '#eef4ff',
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 14,
  },
  vsContainer: {
    marginTop: 18,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(53, 8, 201, 0.12)',
  },
  vsText: {
    color: '#c4d3ff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
    marginHorizontal: 18,
  },
  errorText: {
    color: '#ff9ea2',
    marginVertical: 18,
    fontSize: 14,
  },
  composerCard: {
    marginTop: 18,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowColor: 'transparent',
    elevation: 0,
  },
  composerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  composerFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 14,
  },
  replyInfo: {
    color: '#c4d3ff',
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: '#7c99ff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(124,153,255,0.4)',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  subTitle: {
    color: '#e8eeff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  textInput: {
    color: '#f5f8ff',
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: '#262a2f',
    paddingVertical: 12,
    paddingHorizontal: 18,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    position: 'relative',
    backgroundColor: '#262a2f',
    borderRadius: 999,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  iconsOverlay: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  iconButtonInline: {
    padding: 6,
    marginLeft: 6,
  },
  postImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 10,
    marginTop: 8,
  },
  postVideoPreview: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden',
  },
  button: {
    marginTop: 18,
    width: '100%',
    backgroundColor: '#7c99ff',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    shadowColor: '#7c99ff',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(124,153,255,0.4)',
    shadowOpacity: 0,
  },
  media: {
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mediaLabel: {
    color: '#d9e4ff',
    marginBottom: 10,
    fontWeight: '600',
    fontSize: 12,
  },
  mediaImage: {
    width: '100%',
    height: 210,
    borderRadius: 20,
    marginTop: 8,
  },
  mediaVideo: {
    width: '100%',
    height: 230,
    backgroundColor: '#000',
  },
});