"use client";
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Post, User, usedPosts } from '@/providers/PostsProvider';
import { useUploadFile } from '@/providers/uploadfile';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { EyeIcon, Heart, MessageCircle, Repeat, Swords, VoteIcon } from 'lucide-react-native';
import { PostVideo } from '@/screens/video/postVideo';

const Image_Url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/`;
const regex = /(#\w+)|(@\w+)|([^#@]+)/g;

function timeAgo(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 0 || diffSec < 600) return 'just now';
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}hr`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek}w`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo`;
  const diffYear = Math.floor(diffDay / 365);
  return `${diffYear}y`;
}


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
  const [userDebates, setUserDebates] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!user?.id) {
      setUserDebates([]);
      return;
    }

    let cancelled = false;
    supabase
      .from('Debate')
      .select('*, challenger:User!challenger_id(*), opponent:User!opponent_id(*)')
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('Could not load user debates:', error.message);
          return;
        }
        setUserDebates(data ?? []);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const displayedPosts = React.useMemo(() => {
    if (!posts || !user?.id) return [];
    if (activeTab === 'reposts') {
      return posts.filter((post) => post.repost_user_id === user.id);
    }
    if (activeTab === 'replies') {
      const sortedDebates = [...userDebates].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const rootIds = Array.from(new Set(sortedDebates.map((d) => d.root_post_id).filter(Boolean)));
      return rootIds
        .map((rootId) => posts.find((p) => p.id === rootId))
        .filter((p): p is Post => Boolean(p));
    }
    return posts.filter((post) => post.user_id === user.id && !post.parent_id && !post.repost_user_id);
  }, [activeTab, posts, user?.id, userDebates]);

  const renderPostText = (text?: string) => {
    if (!text) return null;
    const parts = Array.from(text.matchAll(regex), (m) => m[0]);
    return (
      <Text style={styles.postText}>
        {parts.map((part, i) =>
          part.startsWith('#') ? (
            <Text key={i} style={{ fontWeight: 'bold' }}>
              {part}
            </Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  const toggleLike = async (post: Post) => {
    if (!authUser?.id) return;
    const liked = post.likes?.some((like) => like.user_id === authUser.id);
    if (liked) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await supabase.from('Like').delete().eq('user_id', authUser.id).eq('post_id', post.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
          <Pressable onPress={addphoto} style={styles.avatarCircle}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.avatarImage}
                onError={(e) => console.log('Avatar load failed:', imageUrl, e.nativeEvent)}
              />
            ) : null}
          </Pressable>
          <View style={styles.nameRow}>
            <Text size="3xl" bold style={styles.userName}>
              {user?.username ?? 'Unknown User'}
            </Text>
            <Text size="sm" style={styles.userHandle}>
              @{user?.username?.toLowerCase() ?? 'unknown'}
            </Text>
          </View>

          {isOwnProfile ? (
            <Pressable onPress={handleLogout} style={styles.logoutButton}>
              <Text size="sm" bold style={styles.logoutText}>
                Logout
              </Text>
            </Pressable>
          ) : null}
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

        <View style={styles.tabDivider} />

        {displayedPosts.length === 0 ? (
          <View style={styles.feedCard}>
            <Text size="lg" bold style={styles.feedTitle}>
              {activeTab === 'opinions' ? 'Opinions' : activeTab === 'replies' ? 'Debates' : 'Reposts'}
            </Text>
            <Text size="sm" style={styles.feedDescription}>
              {activeTab === 'opinions'
                ? 'No opinions yet.'
                : activeTab === 'replies'
                ? 'No debates yet.'
                : 'No reposts yet.'}
            </Text>
          </View>
        ) : (
          <View style={styles.profileFeed}>
            {displayedPosts.map((post, index) => {
              const isLiked = post.likes?.some((like) => like.user_id === authUser?.id);
              const repostCount = (posts ?? []).filter((item) => item.parent_id === post.id).length;
              const originalPostId = post.parent_id || post.id;
              const postDebates = userDebates
                .filter((debate) => debate.root_post_id === originalPostId)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              const hasDebate = postDebates.length > 0;
              const isSelectedAsDebate = Boolean(post.isDebate) || post.debate_side === 'root';
              const showDirectPost = activeTab === 'opinions' || !hasDebate;
              const showDebateBoxes = activeTab !== 'opinions' && hasDebate;
              const isReposted = (posts ?? []).some(
                (item) => item.parent_id === post.id && item.repost_user_id === authUser?.id
              );
              const originalPost = post.parent_id ? posts?.find((p) => p.id === post.parent_id) : post;
              const isOwnPost = Boolean(authUser?.id && (originalPost?.user_id === authUser.id || post.user_id === authUser.id));
              const canDebate = isSelectedAsDebate && !isOwnPost && !hasDebate;
              const postTime = originalPost?.created_at || post.created_at;
              const imageUrl = post.user?.avatar
                ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user.id}/${post.user.avatar}`
                : undefined;
              const originalImageUrl = originalPost?.user?.avatar
                ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${originalPost.user.id}/${originalPost.user.avatar}`
                : undefined;

              return (
                <React.Fragment key={post.id}>
                  <View style={styles.postCard}>
                    {post.user?.avatar ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.avatarSmall}
                        onError={(e) => console.log('Avatar load failed:', imageUrl, e.nativeEvent)}
                      />
                    ) : (
                      <View style={styles.grayCircleAvatar}>
                        <Text style={styles.grayCircleText}>{post.user?.username?.[0]?.toUpperCase() || '?'}</Text>
                      </View>
                    )}
                    <View style={styles.postContent}>
                      {post.repost_user && (
                        <View style={styles.repostInfoRow}>
                          <Repeat size={16} color="#aaa" strokeWidth={2} />
                          <Text style={styles.repostInfo}>Reposted by </Text>
                          <Pressable onPress={() => router.push({ pathname: `/user`, params: { userId: post.repost_user_id } })}>
                            <Text style={styles.repostInfo}>{post.repost_user.username}</Text>
                          </Pressable>
                        </View>
                      )}

                      <Pressable onPress={() => router.push({ pathname: `/user`, params: { userId: post.user_id } })}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                          <Text style={styles.usernameNoMargin}>{post.user?.username || user?.username || 'Unknown User'}</Text>
                          <Text style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
                            {timeAgo(postTime)}
                          </Text>
                        </View>
                      </Pressable>

                      {showDirectPost && (
                        <View>
                          {renderPostText(post.text)}
                          {post.file && post.file.endsWith('.mp4') ? (
                            <PostVideo
                              uri={`${Image_Url}${post.user_id}/${post.file}`}
                              isVisible={!!post.file}
                            />
                          ) : post.file ? (
                            <Image
                              source={{ uri: `${Image_Url}${post.user_id}/${post.file}` }}
                              style={{
                                width: '100%',
                                height: 200,
                                borderRadius: 10,
                                marginTop: 8,
                              }}
                            />
                          ) : null}
                        </View>
                      )}

                      {showDebateBoxes && postDebates.map((debate) => (
                        <View key={debate.id} style={{ marginTop: 8 }}>
                          {/* ORIGINAL ARGUMENT */}
                          <View style={styles.argumentBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                              {originalPost?.user?.avatar ? (
                                <Image
                                  source={{ uri: originalImageUrl }}
                                  style={styles.avatarSmall}
                                  onError={(e) => console.log('Avatar load failed (originalPost):', originalPost.user?.avatar, e.nativeEvent)}
                                />
                              ) : (
                                <View style={styles.grayCircleAvatar}>
                                  <Text style={styles.grayCircleText}>
                                    {originalPost?.user?.username?.[0]?.toUpperCase() || '?'}
                                  </Text>
                                </View>
                              )}

                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Text style={styles.username}>{originalPost?.user?.username}</Text>
                                  <Text style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
                                    {timeAgo(originalPost?.created_at || '')}
                                  </Text>
                                </View>

                                {renderPostText(originalPost?.text)}

                                {originalPost?.file && originalPost.file.endsWith('.mp4') ? (
                                  <PostVideo
                                    uri={`${Image_Url}${originalPost.user_id}/${originalPost.file}`}
                                    isVisible={!!originalPost.file}
                                  />
                                ) : originalPost?.file ? (
                                  <Image
                                    source={{ uri: `${Image_Url}${originalPost.user_id}/${originalPost.file}` }}
                                    style={{
                                      width: '100%',
                                      height: 200,
                                      borderRadius: 10,
                                      marginTop: 8,
                                    }}
                                  />
                                ) : null}
                              </View>
                            </View>
                          </View>

                          {/* VS */}
                          <Text style={styles.vsText}>
                            ──── VS ────
                          </Text>

                          {/* COUNTER ARGUMENT */}
                          <View style={styles.argumentBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                              {debate.challenger?.avatar ? (
                                <Image
                                  source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${debate.challenger?.id}/${debate.challenger?.avatar}` }}
                                  style={styles.avatarSmall}
                                  onError={(e) => console.log('Avatar load failed (challenger):', debate.challenger?.avatar, e.nativeEvent)}
                                />
                              ) : (
                                <View style={styles.grayCircleAvatar}>
                                  <Text style={styles.grayCircleText}>
                                    {debate.challenger?.username?.[0]?.toUpperCase() || '?'}
                                  </Text>
                                </View>
                              )}

                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Text style={styles.username}>{debate.challenger?.username}</Text>
                                  <Text style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
                                    {timeAgo(debate?.created_at)}
                                  </Text>
                                </View>
                                {renderPostText(debate.challenger_text)}
                              </View>
                            </View>
                          </View>
                        </View>
                      ))}

                      {/* ACTIONS ROW */}
                      <View style={styles.actionsRow}>
                        <View style={styles.likeGroup}>
                          <Pressable onPress={() => toggleLike(post)} style={styles.actionIcon}>
                            <Heart size={20} color={isLiked ? 'red' : 'grey'} fill={isLiked ? 'red' : 'transparent'} />
                          </Pressable>
                          {(post.likes?.length ?? 0) > 0 && (
                            <Text style={styles.likeCount}>{post.likes!.length}</Text>
                          )}
                        </View>

                        <Pressable style={styles.actionIcon}>
                          <MessageCircle size={20} color="#b0b0b0" />
                        </Pressable>

                        <View style={styles.repostGroup}>
                          <Pressable onPress={() => toggleRepost(post)} style={styles.actionIcon}>
                            <Repeat size={20} color={isReposted ? 'cyan' : '#b0b0b0'} />
                          </Pressable>
                          {repostCount > 0 && (
                            <Text style={styles.repostCount}>{repostCount}</Text>
                          )}
                        </View>

                        {hasDebate ? (
                          <Pressable
                            style={styles.actionIconDebateButton}
                            onPress={() =>
                              router.push({
                                pathname: '/mainDebate',
                                params: { postId: originalPostId },
                              })
                            }
                          >
                            <View style={styles.buttonContent}>
                              <VoteIcon size={16} color="#b0b0b0" />
                              <Text style={styles.buttonText}>Vote</Text>
                            </View>
                          </Pressable>
                        ) : canDebate ? (
                          <Pressable
                            style={styles.actionIconDebateButton}
                            onPress={() =>
                              router.push({
                                pathname: '/debateScreen',
                                params: { postId: originalPostId },
                              })
                            }
                          >
                            <View style={styles.buttonContent}>
                              <Swords size={16} color="#b0b0b0" />
                              <Text style={styles.buttonText}>Debate</Text>
                            </View>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={styles.actionIconDebateButton}
                            onPress={() =>
                              router.push({
                                pathname: '/mainDebate',
                                params: { postId: originalPostId },
                              })
                            }
                          >
                            <View style={styles.buttonContent}>
                              <EyeIcon size={16} color="#b0b0b0" />
                              <Text style={styles.buttonText}>View</Text>
                            </View>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                  {index < displayedPosts.length - 1 ? <View style={styles.profileDivider} /> : null}
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
    backgroundColor: '#0f0f0f',
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
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4b5563',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  nameRow: {
    flex: 1,
    marginLeft: 8,
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
  tabDivider: {
    height: 1,
    backgroundColor: '#222',
    marginHorizontal: -20,
    marginTop: -8,
  },
  tabLabel: {
    color: '#d1d5db',
  },
  logoutButton: {
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
  postCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0f0f0f',
    borderRadius: 18,
    marginTop: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarSmall: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  grayCircleAvatar: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  grayCircleText: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14.5,
  },
  postContent: {
    flex: 1,
    flexDirection: 'column',
  },
  username: {
    color: 'white',
    fontWeight: '500',
    fontSize: 14.5,
    marginBottom: 2,
  },
  usernameNoMargin: {
    marginLeft: 0,
    color: 'white',
    fontWeight: '500',
    fontSize: 14.5,
  },
  postText: {
    color: '#fff',
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 5,
  },
  argumentBox: {
    backgroundColor: '#181818',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 0.5,
    borderColor: '#343232',
  },
  vsText: {
    color: '#888',
    textAlign: 'center',
    marginVertical: 6,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 36,
  },
  likeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  repostGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    color: '#b0b0b0',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 1,
  },
  repostCount: {
    color: '#b0b0b0',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 1,
  },
  actionIcon: {
    padding: 4,
  },
  actionIconDebateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonText: {
    color: '#b0b0b0',
    fontSize: 11,
    fontWeight: '700',
  },
  repostInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    marginLeft: 4,
  },
  repostInfo: {
    color: '#aaa',
    fontSize: 14,
  },
  profileDivider: {
    height: 1,
    backgroundColor: '#222',
    marginHorizontal: -20,
    marginTop: 8,
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
