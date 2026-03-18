// Helper to format time difference

import React from 'react';
import {Pressable, RefreshControl, ScrollView} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/providers/AuthProvider';
import { View, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Avatar, AvatarFallbackText, AvatarImage, AvatarBadge } from '@/components/ui/avatar';
import { Heart, MessageCircle, Repeat, ScanEye, Swords } from 'lucide-react-native';
import { usedPosts } from '@/providers/PostsProvider';
import { PostVideo } from '../video/postVideo';
import { supabase } from '@/lib/supabase';
import * as Haptics from 'expo-haptics';
import { Post } from '@/providers/PostsProvider';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { HStack } from '@/components/ui/hstack';





function timeAgo(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 0 || diffSec < 600) return 'just now'; // less than 10 minutes
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


export default function HomeScreen(post: Post) {
  const { user } = useAuth();
  const currentUser = user as any;
  const { posts, refetch } = usedPosts();
  const [debates, setDebates] = React.useState<any[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);


  const BUCKET = 'post-images'; 

  
  
  
 // const path = `${posts.user_id}/${post.file}`;
 // const imgUri = publicFileUrl(BUCKET, path);


 const AddLike = async (postId: string) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
   try {
     const { data, error } = await supabase.from('Like').insert({
       user_id: currentUser?.id,
       post_id: postId,
     });
     if (error) {
       console.log('Error adding like:', error);
     } else {
       await refetch();
     }
   } catch (err) {
     console.error('Exception adding like:', err);
   }
 }

 const RemoveLike = async (postId: string) => {
   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
     try {
       const { data, error } = await supabase.from('Like').delete().eq('user_id', currentUser?.id).eq('post_id', postId);
       if (error) {
         console.log('Error removing like:', error);
       } else {
         await refetch();
       }
     } catch (err) {
       console.error('Exception removing like:', err);
     }
 }
const RemoveRepost = async (orig: Post) => {
  try {
    // delete the repost row that this user created for orig
    const { error } = await supabase
      .from('Post')
      .delete()
      .eq('parent_id', orig.id)
      .eq('repost_user_id', currentUser?.id);
    if (error) console.log('Error removing repost:', error);
    await refetch();
  } catch (err) {
    console.error('Exception removing repost:', err);
  }
};
 const addRepost = async (orig: Post) => {
  try {
    const newPostId = Crypto.randomUUID();
    const { data: repostData, error: repostError } = await supabase.from('Post').insert({
      id: newPostId,
      user_id: orig.user_id,          // original author should stay on top row
      parent_id: orig.id,
      text: orig.text,
      file: orig.file,
      tag_name: orig.tag_name,
      repost_user_id: currentUser?.id,
    }).select('id').single();

    if (repostError) {
      console.error('Error reposting:', repostError);
      return;
    }

    // Copy likes from original post to repost so repost shows same like count
    const { data: originalLikes, error: likeError } = await supabase
      .from('Like')
      .select('user_id')
      .eq('post_id', orig.id);

    if (!likeError && originalLikes?.length) {
      const clonedLikes = originalLikes.map((like: { user_id: string }) => ({
        user_id: like.user_id,
        post_id: newPostId,
      }));
      const { error: cloneError } = await supabase.from('Like').insert(clonedLikes);
      if (cloneError) {
        console.error('Error copying likes to repost:', cloneError);
      }
    }

    await refetch();
  } catch (err) {
    console.error('Error reposting:', err);
  }
};

  React.useEffect(() => {
    const loadDebates = async () => {
      try {
        const { data, error } = await supabase
          .from('Debate')
          .select('*, challenger:User!challenger_id(*), opponent:User!opponent_id(*)');
        if (error) {
          console.error('Error loading debates:', error);
          return;
        }
        setDebates(data ?? []);
      } catch (err) {
        console.error('Error loading debates:', err);
      }
    };
    loadDebates();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);

    try {
      await refetch();
      const { data, error } = await supabase
        .from('Debate')
        .select('*, challenger:User!challenger_id(*), opponent:User!opponent_id(*)');
      if (!error && data) setDebates(data);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const regex = /(#\w+)|(@\w+)|([^#@]+)/g;

  const sortedPosts = React.useMemo(() => {
    if (!posts) return [];
    return [...posts].sort((a, b) => {
      const aIsOwnRepost = a.repost_user_id === currentUser?.id;
      const bIsOwnRepost = b.repost_user_id === currentUser?.id;
      if (aIsOwnRepost !== bIsOwnRepost) {
        return aIsOwnRepost ? 1 : -1;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [posts, currentUser?.id]);


  const feedPosts = React.useMemo(() => {
    return sortedPosts.filter((post) => {
      // Hide repost entries created by current user.
      return !(post.repost_user_id && post.repost_user_id === currentUser?.id);
    });
  }, [sortedPosts, currentUser?.id]);



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

  // try to show all posts
  return (
    <SafeAreaView style={styles.container}>
      {/* logo header */}
       <View style={styles.header}>
        <View style={styles.leftContainer}>
          <View style={styles.logoCircle}>
            <Image
              source={require('@/assets/images/EchelonLogo3d.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>
      {/* Feed */}
      <ScrollView style={styles.feed} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> }>
        {(posts?.length ?? 0) === 0 ? (
          <Text style={{ color: 'gray', textAlign: 'center', marginTop: 24 }}>No posts yet.</Text>
        ) : null}
        {(feedPosts ?? []).map((post, idx) => {
          const isLiked = post?.likes?.some((like: { user_id: string}) => like.user_id === currentUser?.id);
          const repostCount = (posts ?? []).filter(p => p.parent_id === post.id).length;
          const isReposted = (posts ?? []).some(
            p => p.parent_id === post.id && p.repost_user_id === currentUser?.id
          );
          return (
          <React.Fragment key={post.id}>
            <View style={styles.postCard}>
              {post.user?.avatar ? (
                <Avatar size="md" style={styles.avatar}>
                  <AvatarImage source={{ uri: post.user?.avatar }} />
                </Avatar>
              ) : (
                <View style={styles.grayCircleAvatar}>
                  <Text style={styles.grayCircleText}>{post.user?.username?.[0]?.toUpperCase() || '?'}</Text>
                </View>
              )}
              <View style={styles.postContent}>
                {/* if this post is a repost, show who reposted it */}
                
                        {post.repost_user && (
                  <View style={styles.repostInfoRow}>
                    <Repeat size={14} color="#aaa" strokeWidth={2} />
                    <Text style={styles.repostInfo}>
                      Reposted by {post.repost_user.username}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={[styles.username, { marginLeft: 0 }]}>{post.user?.username || (user as any)?.username}</Text>
                  <Text style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
                    {timeAgo(post.created_at)}
                  </Text>
                </View>
                {!debates.some(d => d.root_post_id === post.id) && renderPostText(post.text)}
                  {debates
                      .filter((d) => d.root_post_id === post.id)
                      .map((debate) => (
                        <View key={debate.id} style={{ marginTop: 8 }}>

                          {/* ORIGINAL ARGUMENT */}
                          <View style={styles.argumentBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                              
                              {post.user?.avatar ? (
                                <Avatar size="md" style={styles.avatar}>
                                  <AvatarImage source={{ uri: post.user.avatar }} />
                                </Avatar>
                              ) : (
                                <View style={styles.grayCircleAvatar}>
                                  <Text style={styles.grayCircleText}>
                                    {post.user?.username?.[0]?.toUpperCase() || '?'}
                                  </Text>
                                </View>
                              )}

                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <Text style={styles.username}>{post.user?.username}</Text>
                                  <Text style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
                                    {timeAgo(post.created_at)}
                                  </Text>
                                </View>

                                {renderPostText(post.text)}
                              </View>

                            </View>
                          </View>

                          {/* VS */}
                          <Text style={{
                            color: '#888',
                            textAlign: 'center',
                            marginVertical: 6,
                            fontSize: 12
                          }}>
                            ──── VS ────
                          </Text>

                          {/* COUNTER ARGUMENT */}
                          <View style={styles.argumentBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                              
                              {debate.challenger?.avatar ? (
                                <Avatar size="md" style={styles.avatar}>
                                  <AvatarImage source={{ uri: debate.challenger.avatar }} />
                                </Avatar>
                              ) : (
                                <View style={styles.grayCircleAvatar}>
                                  <Text style={styles.grayCircleText}>
                                    {debate.challenger?.username?.[0]?.toUpperCase() || '?'}
                                  </Text>
                                </View>
                              )}

                              <View style={{ flex: 1 }}>
                                <Text style={styles.username}>
                                  {debate.challenger?.username}
                                </Text>

                                {renderPostText(debate.challenger_text)}
                              </View>

                            </View>
                          </View>

                        </View>
                    ))}

              
              {post.file && post.file.endsWith('.mp4') ? (
                <PostVideo 
                  uri={`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user_id}/${post.file}`}
                  isVisible={!!post.file}
                />
              ) : (
                <Image
                  source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${post.user_id}/${post.file}` }}
                  style={{ 
                    width: !!post.file ? '100%' : 0, 
                    height: !!post.file ? 200 : 0, 
                    borderRadius: !!post.file ? 10 : 0, 
                    marginTop: !!post.file ? 8 : 0 
                  }}
                />
              )}
               {/**/}
              <View style={styles.actionsRow}>
                  <View style={styles.likeGroup}>
                    <Pressable onPress={ () => 
                      {
                        isLiked ? RemoveLike(post.id) : AddLike(post.id);
                      }} 
                      style={styles.actionIcon}>
                      <Heart size={20}  color={isLiked ? 'red' : 'grey'} fill={isLiked ? 'red' : 'transparent'} />
                    </Pressable>
                    {(post.likes?.length ?? 0) > 0 && (
                      <Text style={styles.likeCount}>{post.likes!.length}</Text>
                    )}
                  </View>
                  <Pressable style={styles.actionIcon}>
                    <MessageCircle size={20} color="#b0b0b0" />
                  </Pressable>
                  <View style={styles.repostGroup}>
                    <Pressable
                      onPress={() =>
                        isReposted ? RemoveRepost(post) : addRepost(post)
                      }
                      style={styles.actionIcon}
                    >
                      <Repeat
                        size={20}
                        color={isReposted ? 'cyan' : '#b0b0b0'}
                      />
                    </Pressable>
                    {repostCount > 0 && (
                      <Text style={styles.repostCount}>{repostCount}</Text>
                    )}
                  </View>
                  <Pressable
                    style={styles.actionIconDebateButton}
                    onPress={() =>
                      router.push({
                        pathname: '/debateScreen',
                        params: { postId: post.id },
                      })
                    }
                  >
                    <View style={styles.buttonContent}>
                      <Swords size={16} color="#b0b0b0" />
                      <Text style={styles.buttonText}>Debate</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
            {idx < ((feedPosts?.length ?? 0) - 1) && (
              <View style={styles.divider} />
            )}
          </React.Fragment>
        );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
 argumentBox: {
  backgroundColor: '#13212f', // slightly different
  borderRadius: 12,
  padding: 10,
  marginTop: 8,

  borderWidth: 1,
  borderColor: '#262626', // THIS is what makes it visible
},

  actionIcon: {
    padding: 4,
  },

  actionIconDebateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a', // Dark background
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20, // Rounded pill shape
    borderWidth: 1,
    borderColor: '#333', // Subtle border
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Space between icon and text
  },
  buttonText: {
    color: '#b0b0b0',
    fontSize: 11,
  },
  header: {
     flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181818',
    paddingHorizontal: 156,
    paddingVertical: 26,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
    logo: {
    width: 100,
    height: 100,
    marginRight: 1,
    
  },
  feed: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  postCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0f0f0f',
    borderRadius: 18,
    marginHorizontal: 10,
    marginTop: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  avatar: {
    marginRight: 15,
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
  postText: {
    color: '#fff',
    fontSize: 14.5,
    lineHeight: 22,          // increased line height for better spacing
    marginBottom: 5,
  },
  likeCount: {
    color: '#b0b0b0',
    fontSize: 13,
    fontWeight: '600', // make number stand out
    marginLeft: 1, // even closer to heart
  },
  likeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 36,
  },

  divider: {
    height: 1,
    backgroundColor: '#222',
    marginTop: 8,
    width: '100%',
    alignSelf: 'center',
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
    leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#181818',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  repostInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    marginLeft: 4,
  },
  repostInfo: {
    color: '#aaa',
    fontSize: 12,
    marginLeft: 4,
    marginRight: 4,
  },
  repostGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  repostCount: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 1,
  },
  debatePanel: {
    marginTop: 8,
    marginBottom: 2,
    backgroundColor: '#1b1b2a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#394156',
    padding: 8,
  },
  debateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debateUser: {
    color: '#d6e4ff',
    fontWeight: '700',
    fontSize: 12,
  },
  debateVs: {
    color: '#8ea5ef',
    fontWeight: '800',
    marginHorizontal: 4,
  },
  debateStatus: {
    marginTop: 4,
    color: '#9cb4ff',
    fontSize: 11,
    textAlign: 'center',
  },

});

