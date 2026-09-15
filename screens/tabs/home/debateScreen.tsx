import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { usePosts } from '@/hooks/use-posts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useUploadFile } from '@/providers/uploadfile';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ArrowLeft, Camera, Image as ImageIcon, Swords, Video as VideoIcon, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

function DebateVideo({ uri, style }: { uri: string; style: import('react-native').StyleProp<import('react-native').ViewStyle> }) {
  const player = useVideoPlayer(uri);

  return <VideoView player={player} style={style} contentFit="contain" />;
}

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
    if (post?.user_id === currentUser.id) {
      Alert.alert('Invalid action', 'You cannot debate your own post.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (!post?.user_id) {
        Alert.alert('Error', 'Cannot determine the original post author.');
        return;
      }

      const debateId = Crypto.randomUUID();
      const { error } = await supabase.from('Debate').insert({
        id: debateId,
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
        const { error: segmentError } = await supabase.from('DebateSegment').insert({
          id: Crypto.randomUUID(),
          debate_id: debateId,
          post_id: postId,
          speaker_id: currentUser.id,
          text: defendText.trim(),
          file: videoFilename ?? imageFilename,
          side: 'challenger',
          round_number: 2,
        });

        if (segmentError) {
          console.error('Error creating initial debate segment:', segmentError);
          Alert.alert('Error', 'The debate was created, but its first segment could not be saved.');
          return;
        }

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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <VStack style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 }}>
            <View>
              {/* Header */}
              <View style={styles.headerRow}>
                <Pressable
                  style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
                  onPress={() => router.back()}
                  hitSlop={8}
                >
                  <ArrowLeft size={16} color="#e5e7eb" />
                  <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
                <Text style={styles.screenTitle}>Debate</Text>
              </View>

              {fetching ? (
                <ActivityIndicator color="#1d9bf0" size="large" style={styles.loading} />
              ) : post ? (
                <>
                  {/* OP Post Card with Glassmorphism */}
                  <View
                    style={[
                      styles.postCard,
                      keyboardVisible && post?.file && { maxHeight: 180 },
                    ]}
                  >
                    <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0.02)']}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <View style={styles.postMetaRow}>
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>OP</Text>
                      </View>
                      <Text style={styles.postUser}>{post.user?.username ?? 'Unknown'}</Text>
                      <Text style={styles.postHandle}>
                        @{post.user?.username?.toLowerCase() ?? 'unknown'}
                      </Text>
                    </View>

                    <Text style={styles.postText}>{post.text ?? 'No post text available.'}</Text>

                    {post.file ? (
                      post.file.endsWith('.mp4') ? (
                        <View style={styles.media}>
                          <Text style={styles.mediaLabel}>Video attached</Text>
                          <DebateVideo
                            uri={`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user_id}/${post.file}`}
                            style={styles.mediaVideo}
                          />
                        </View>
                      ) : (
                        <Image
                          source={{
                            uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user_id}/${post.file}`,
                          }}
                          style={styles.mediaImage}
                          resizeMode="cover"
                        />
                      )
                    ) : null}
                  </View>

                  {/* VS Separator */}
                  <View style={styles.vsContainer}>
                    <View style={styles.vsLine} />
                    <View style={styles.vsPill}>
                      <Swords size={13} color="#22d3ee" strokeWidth={2.2} />
                      <Text style={styles.vsText}>VS</Text>
                    </View>
                    <View style={styles.vsLine} />
                  </View>
                </>
              ) : (
                <Text style={styles.errorText}>Unable to load the post.</Text>
              )}
            </View>

            {/* Rebuttal Composer */}
            <View style={styles.composerCard}>
              <View style={styles.composerHeaderRow}>
                <Text style={styles.subTitle}>Rebuttal</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.submitButton,
                    (!defendText.trim() || isSubmitting || isUploadingFile) && styles.submitButtonDisabled,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleDefend}
                  disabled={!defendText.trim() || isSubmitting || isUploadingFile}
                >
                  {isSubmitting || isUploadingFile ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Post</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.inputContainer}>
                <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                <TextInput
                  style={[
                    styles.textInput,
                    { minHeight: Math.max(56, inputHeight) },
                  ]}
                  placeholder="Type your response"
                  placeholderTextColor="rgba(255, 255, 255, 0.45)"
                  multiline
                  value={defendText}
                  onChangeText={setDefendText}
                  onContentSizeChange={(e) => {
                    const h = e.nativeEvent.contentSize.height + 12;
                    setInputHeight(h);
                  }}
                />

                {/* Icons overlay inside the input box; hide when there's text or media */}
                {!defendText.trim() && !photo && !videoFile ? (
                  <View style={styles.iconsOverlay} pointerEvents="box-none">
                    <Pressable onPress={addphoto} style={styles.iconButtonInline} hitSlop={6}>
                      <ImageIcon size={20} color="#9ca3af" strokeWidth={1.8} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        router.push({
                          pathname: '/camera',
                          params: { threadId: null },
                        });
                      }}
                      style={styles.iconButtonInline}
                      hitSlop={6}
                    >
                      <Camera size={20} color="#9ca3af" strokeWidth={1.8} />
                    </Pressable>
                    <Pressable onPress={pickVideo} style={styles.iconButtonInline} hitSlop={6}>
                      <VideoIcon size={20} color="#9ca3af" strokeWidth={1.8} />
                    </Pressable>
                  </View>
                ) : null}

                {/* Media previews with remove button */}
                {photo ? (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: photo }} style={styles.postImagePreview} resizeMode="cover" />
                    <Pressable
                      style={styles.removeMediaBtn}
                      onPress={() => {
                        setPhoto('');
                        setImageFilename(null);
                      }}
                    >
                      <X size={12} color="#fff" />
                    </Pressable>
                  </View>
                ) : null}

                {videoFile ? (
                  <View style={styles.previewContainer}>
                    <DebateVideo uri={videoFile} style={styles.postVideoPreview} />
                    <Pressable
                      style={styles.removeMediaBtn}
                      onPress={() => {
                        setVideoFile('');
                        setVideoFilename(null);
                      }}
                    >
                      <X size={12} color="#fff" />
                    </Pressable>
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
    backgroundColor: '#0a0a0c',
  },
  headerRow: {
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 10,
  },
  backButtonText: {
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 13,
  },
  screenTitle: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 0.3,
  },
  loading: {
    marginTop: 30,
  },
  postCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    overflow: 'hidden',
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
  },
  badgeText: {
    color: '#22d3ee',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  postUser: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  postHandle: {
    color: '#9ca3af',
    fontSize: 13,
    marginLeft: 6,
  },
  postText: {
    color: '#f3f4f6',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 8,
  },
  vsContainer: {
    marginVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  vsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginHorizontal: 12,
  },
  vsText: {
    color: '#22d3ee',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  errorText: {
    color: '#f87171',
    marginVertical: 18,
    fontSize: 14,
  },
  composerCard: {
    marginTop: 10,
  },
  composerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subTitle: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  submitButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(26, 26, 26, 0.4)',
    borderColor: 'rgba(51, 51, 51, 0.4)',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  inputContainer: {
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  textInput: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    paddingRight: 90,
    paddingTop: 2,
    paddingBottom: 2,
    paddingHorizontal: 4,
    textAlignVertical: 'top',
  },
  iconsOverlay: {
    position: 'absolute',
    right: 12,
    top: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  iconButtonInline: {
    padding: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  previewContainer: {
    position: 'relative',
    width: 140,
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginTop: 10,
  },
  postImagePreview: {
    width: '100%',
    height: '100%',
  },
  postVideoPreview: {
    width: '100%',
    height: '100%',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  mediaLabel: {
    color: '#9ca3af',
    padding: 8,
    fontWeight: '600',
    fontSize: 11,
  },
  mediaImage: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    marginTop: 6,
  },
  mediaVideo: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
});