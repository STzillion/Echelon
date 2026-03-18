import React, { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, Image } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Text } from '@/components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import * as Crypto from 'expo-crypto';

export default function DebatePage() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { user } = useAuth();
  const currentUser = user as any;
  const router = useRouter();
  const [post, setPost] = useState<{ id: string; text?: string; file?: string; user_id?: string; user?: { username: string } } | null>(null);
  const [fetching, setFetching] = useState(true);
  const [defendText, setDefendText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      });

      console.log('challenger_text:', defendText);

      if (error) {
        console.error('Error creating debate:', error);
        Alert.alert('Error', 'Could not create debate.');
      } else {
        Alert.alert('Debate created', 'Your counter argument has been submitted.');
        setDefendText('');
        router.back();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
          <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Debate</Text>
        <Text style={styles.description}>Respond to the selected argument with your counterpoint.</Text>
      </View>

      {fetching ? (
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      ) : post ? (
        <>
          <View style={styles.postCard}>
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
                  <Video source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user_id}/${post.file}` }} style={styles.mediaVideo} shouldPlay={false} resizeMode={ResizeMode.CONTAIN} />
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

      <View style={styles.composerCard}>
        <Text style={styles.subTitle}>Present Rebutal</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Write your counter-argument here..."
          placeholderTextColor="#bbb"
          multiline
          value={defendText}
          onChangeText={setDefendText}
        />
        <Pressable
          style={[styles.button, (!defendText.trim() || isSubmitting) && styles.buttonDisabled]}
          onPress={handleDefend}
          disabled={!defendText.trim() || isSubmitting}
        >
          <Text style={styles.buttonText}>{isSubmitting ? 'Posting...' : 'Post Defense'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    padding: 16,
  },
  headerRow: {
    marginBottom: 12,
    flexDirection: 'column',
    gap: 4,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1d2a46',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#3a4f7c',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 4,
  },
  backButtonText: {
    color: '#d2deff',
    fontWeight: '600',
    fontSize: 13,
  },
  screenTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 24,
  },
  description: {
    color: '#dce8ff',
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    maxWidth: '92%',
  },
  postCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 14,
    marginTop: 8,
    borderColor: '#334155',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  badge: {
    backgroundColor: '#2b81ff',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  postUser: {
    color: '#9dd6ff',
    fontWeight: '700',
    marginBottom: 4,
  },
  postText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  vsContainer: {
    marginTop: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  errorText: {
    color: '#f88',
    marginVertical: 14,
  },
  composerCard: {
    marginTop: 0,
    backgroundColor: '#1f2530',
    borderRadius: 22,
    padding: 16,
    borderColor: '#2f3a47',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 3,
  },
  subTitle: {
    color: '#f1f6ff',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 10,
  },
  textInput: {
    color: '#fff',
    minHeight: 90,
    borderRadius: 16,
    borderColor: '#3f4c61',
    borderWidth: 1,
    backgroundColor: '#121826',
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  button: {
    marginTop: 12,
    backgroundColor: '#3f8cff',
    borderRadius: 24,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#2f78ff',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#9dbdff',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    backgroundColor: '#44597f',
    shadowOpacity: 0,
  },
  vsText: {
    color: '#d0d8ea',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  media: {
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0e0e0e',
  },
  mediaLabel: {
    color: '#dce7ff',
    marginBottom: 8,
    fontWeight: '600',
    fontSize: 12,
  },
  mediaImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
  mediaVideo: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#000',
  },
});