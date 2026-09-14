"use client";
import { Avatar, AvatarBadge, AvatarFallbackText } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Post, User, usedPosts } from '@/providers/PostsProvider';
import { useUploadFile } from '@/providers/uploadfile';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { EyeIcon, Heart, MessageCircle, Repeat, Swords, VoteIcon } from 'lucide-react-native';
import { PostVideo } from '@/screens/video/postVideo';


const tabs = [
  { key: 'opinions', label: 'Opinions' },
  { key: 'replies', label: 'Debates' },
  { key: 'reposts', label: 'Reposts' },
] as const;



type TabKey = (typeof tabs)[number]['key'];

export default ({ user }: { user?: User }) => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('opinions');
  const { logOut, user: authUser, setUser } = useAuth() as any;
  const { posts, refetch } = usedPosts();
  const [photo, setPhoto] = React.useState<string | null>(null);
  const [ImageFilename, setImageFilename] = useState<string | null>(null); 
  const uploadFile = useUploadFile().uploadFile;
  const isOwnProfile = Boolean(user?.id) && authUser?.id === user?.id;
  const avatarName = ImageFilename ?? user?.avatar;
  const imageUrl = avatarName
    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${user?.id}/${avatarName}`
    : undefined;
  const [debates, setDebates] = React.useState<any[]>([]);

  const profilePosts = React.useMemo(() => {
    if (!posts || !user?.id) return [];
    if (activeTab === 'reposts') {
      return posts.filter((post) => post.repost_user_id === user.id);
    }
    return posts.filter((post) => post.user_id === user.id && !post.repost_user_id);
  }, [activeTab, posts, user?.id]);

  React.useEffect(() => {
    const postIds = profilePosts.map((post) => post.parent_id || post.id);
    if (postIds.length === 0) {
      setDebates([]);
      return;
    }

    let cancelled = false;
    supabase
      .from('Debate')
      .select('root_post_id')
      .in('root_post_id', postIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('Could not load profile debates:', error.message);
          return;
        }
        setDebates(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [profilePosts]);

  const renderPostText = (text?: string) => {
    if (!text) return null;
    return <Text style={styles.profilePostText}>{text}</Text>;
  };

  const toggleLike = async (post: Post) => {
    if (!authUser?.id) return;
    const liked = post.likes?.some((like) => like.user_id === authUser.id);
    if (liked) {
      await supabase.from('Like').delete().eq('user_id', authUser.id).eq('post_id', post.id);
    } else {
      await supabase.from('Like').insert({ user_id: authUser.id, post_id: post.id, post_text: post.text });
    }
    await refetch();
  };

  const toggleRepost = async (post: Post) => {
    if (!authUser?.id) return;
    const reposted = (posts ?? []).some(
      (item) => item.parent_id === post.id && item.repost_user_id === authUser.id
    );
    if (reposted) {
      await supabase
        .from('Post')
        .delete()
        .eq('parent_id', post.id)
        .eq('repost_user_id', authUser.id);
    } else {
      await supabase.from('Post').insert({
        id: Crypto.randomUUID(),
        user_id: post.user_id,
        parent_id: post.id,
        text: post.text,
        file: post.file,
        tag_name: post.tag_name,
        repost_user_id: authUser.id,
      });
    }
    await refetch();
  };

  React.useEffect(() => {
    if (!imageUrl) return;
  
    fetch(imageUrl).then((res) => {
      console.log('Avatar URL check:', imageUrl, 'status:', res.status);
    }).catch((err) => {
      console.log('Avatar URL fetch failed:', imageUrl, err);
    });
  }, [imageUrl]);

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (error) {
      Alert.alert('Logout failed', 'Please try again.');
    }
  };

    const addphoto = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.1,
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
        const generatedName = `avatar.${type.split('/')[1]}`;
        const uploadedName = await uploadFile(
          userId,
          uri,
          type,
          generatedName
        );
  
  
  
        if (uploadedName) {
          const { data: updateData, error: updateError } = await supabase
            .from('User')
            .update({ avatar: uploadedName })
            .eq('id', userId)
            .select('id, avatar');

          if (updateError) {
            console.log('Failed to save avatar reference:', updateError);
            Alert.alert('Upload error', 'Failed to save avatar.');
            setPhoto('');
            return;
          }

          if (!updateData || updateData.length === 0) {
            // RLS silently blocked the update (no error thrown, but 0 rows affected).
            console.log('Avatar DB update affected 0 rows — likely blocked by RLS on User table.');
            Alert.alert('Upload error', 'Avatar saved to storage but could not update your profile (permission denied).');
            setPhoto('');
            return;
          }

          console.log('Avatar DB update succeeded:', updateData);
          setImageFilename(uploadedName);
          setUser?.((prev: any) => ({ ...prev, avatar: uploadedName }));
        } else {
          Alert.alert('Upload error', 'Failed to upload image.');
          setPhoto('');
          setImageFilename(null);
        }
      }
      
    }

  return (
    <SafeAreaView style={styles.container}>
     

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileSummary}>
          <View>
            <Pressable onPress={addphoto} >
              <Avatar size="lg" className="bg-gray-600">
                <AvatarBadge size="lg" style={styles.avatarBadge}>
                  <Text size="sm" bold style={styles.avatarBadgeText}>
                    {user?.username ? user.username[0]?.toUpperCase() : ''}
                  </Text>
                </AvatarBadge>
                <AvatarFallbackText>
                  {user?.username ? user.username[0]?.toUpperCase() : ''}
                </AvatarFallbackText>
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.avatarImage}
                    onError={(e) => console.log('Avatar load failed:', imageUrl, e.nativeEvent)}
                  />
                ) : null}
              </Avatar>
            </Pressable>
          </View>
          <View style={styles.nameRow}>
            <Text size="3xl" bold style={styles.userName}>
              {user?.username ?? 'Unknown User'}
            </Text>
            <Text size="sm" style={styles.userHandle}>
              @{user?.username?.toLowerCase() ?? 'unknown'}
            </Text>
          </View>
        </View>

        <Text size="sm" style={styles.bioText}>
          Still processing... ?? | Just a huge nerd ?? | CS student
        </Text>

        <View style={styles.tabRow}>
          {tabs.map((tab) => {
            const selected = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, selected && styles.tabItemActive]}
              >
                <Text size="sm" bold style={[styles.tabLabel, selected && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {selected ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            );
          })}
        </View>

        {isOwnProfile ? (
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Text size="sm" bold style={styles.logoutText}>
              Logout
            </Text>
          </Pressable>
        ) : null}

        {activeTab === 'replies' ? (
          <View style={styles.feedCard}>
            <Text size="lg" bold style={styles.feedTitle}>Debates</Text>
            <Text size="sm" style={styles.feedDescription}>
              Debates this user has joined.
            </Text>
          </View>
        ) : profilePosts.length === 0 ? (
          <View style={styles.feedCard}>
            <Text size="lg" bold style={styles.feedTitle}>
              {activeTab === 'opinions' ? 'Opinions' : 'Reposts'}
            </Text>
            <Text size="sm" style={styles.feedDescription}>
              {activeTab === 'opinions' ? 'No opinions yet.' : 'No reposts yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.profileFeed}>
            {profilePosts.map((post, index) => {
              const isLiked = post.likes?.some((like) => like.user_id === authUser?.id);
              const repostCount = (posts ?? []).filter((item) => item.parent_id === post.id).length;
              const isReposted = (posts ?? []).some(
                (item) => item.parent_id === post.id && item.repost_user_id === authUser?.id
              );
              const originalPostId = post.parent_id || post.id;
              const hasDebate = debates.some((debate) => debate.root_post_id === originalPostId);
              const mediaUrl = post.file
                ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user_id}/${post.file}`
                : '';

              return (
                <React.Fragment key={post.id}>
                  <View style={styles.profilePost}>
                    <View style={styles.profilePostHeader}>
                      {post.user?.avatar ? (
                        <Image
                          source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user.id}/${post.user.avatar}` }}
                          style={styles.profilePostAvatar}
                        />
                      ) : (
                        <View style={styles.profilePostAvatarFallback}>
                          <Text style={styles.profilePostAvatarText}>
                            {post.user?.username?.[0]?.toUpperCase() ?? '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.profilePostUsername}>{post.user?.username ?? user?.username ?? 'Unknown User'}</Text>
                      <Text style={styles.profilePostTime}>{new Date(post.created_at).toLocaleDateString()}</Text>
                    </View>
                    {renderPostText(post.text)}
                    {post.file?.endsWith('.mp4') ? (
                      <PostVideo uri={mediaUrl} isVisible />
                    ) : post.file ? (
                      <Image source={{ uri: mediaUrl }} style={styles.profilePostMedia} />
                    ) : null}
                    <View style={styles.profileActionsRow}>
                      <Pressable onPress={() => toggleLike(post)} style={styles.profileAction}>
                        <Heart size={20} color={isLiked ? 'red' : '#b0b0b0'} fill={isLiked ? 'red' : 'transparent'} />
                        {post.likes?.length ? <Text style={styles.profileActionCount}>{post.likes.length}</Text> : null}
                      </Pressable>
                      <Pressable style={styles.profileAction}>
                        <MessageCircle size={20} color="#b0b0b0" />
                      </Pressable>
                      <Pressable onPress={() => toggleRepost(post)} style={styles.profileAction}>
                        <Repeat size={20} color={isReposted ? 'cyan' : '#b0b0b0'} />
                        {repostCount ? <Text style={styles.profileActionCount}>{repostCount}</Text> : null}
                      </Pressable>
                      <Pressable
                        onPress={() => router.push({ pathname: '/debateScreen', params: { postId: originalPostId } })}
                        style={styles.profileDebateButton}
                      >
                        {hasDebate ? <VoteIcon size={16} color="#b0b0b0" /> : <EyeIcon size={16} color="#b0b0b0" />}
                        <Text style={styles.profileDebateText}>{hasDebate ? 'Vote' : 'View'}</Text>
                      </Pressable>
                    </View>
                  </View>
                  {index < profilePosts.length - 1 ? <View style={styles.profileDivider} /> : null}
                </React.Fragment>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 24,
    gap: 18,
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: -20,
  },
 
  avatarImage: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    right: -50,
    bottom: -8,
  },
  avatarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#050505',
    position: 'absolute',
    right: -50,
    bottom: -8,
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  nameRow: {
    flex: 1,
    right: -50,
  },
  userName: {
    color: '#fff',
  },
  userHandle: {
    color: '#9ca3af',
    marginTop: 4,
  },
  bioText: {
    color: '#d1d5db',
    lineHeight: 22,
  },
  tabRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  tabItem: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  tabItemActive: {
    backgroundColor: 'transparent',
  },
  tabUnderline: {
    width: '100%',
    height: 2,
    marginTop: 6,
    borderRadius: 2,
    backgroundColor: '#22d3ee',
  },
  tabLabel: {
    color: '#d1d5db',
  },
  logoutButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#f3f4f6',
    fontWeight: '700',
  },
  profileFeed: {
    width: '100%',
  },
  profilePost: {
    paddingVertical: 14,
  },
  profilePostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  profilePostAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  profilePostAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#444',
  },
  profilePostAvatarText: {
    color: '#fff',
    fontSize: 14,
  },
  profilePostUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  profilePostTime: {
    color: '#888',
    fontSize: 12,
    marginLeft: 6,
  },
  repostInfo: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 6,
  },
  profilePostText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  profilePostMedia: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginTop: 4,
  },
  profileActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
    marginTop: 8,
  },
  profileAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 4,
  },
  profileActionCount: {
    color: '#b0b0b0',
    fontSize: 13,
  },
  profileDebateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1a1a1a',
  },
  profileDebateText: {
    color: '#b0b0b0',
    fontSize: 11,
    fontWeight: '700',
  },
  profileDivider: {
    height: 1,
    backgroundColor: '#222',
  },
  tabLabelActive: {
    color: '#22d3ee',
  },
  feedCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 20,
  },
  feedTitle: {
    color: '#fff',
    marginBottom: 10,
  },
  feedDescription: {
    color: '#9ca3af',
    lineHeight: 22,
  },
});
