// Helper to format time difference

import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Post, usedPosts } from '@/providers/PostsProvider';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { EyeIcon, Heart, MessageCircle, Repeat, Swords, VoteIcon } from 'lucide-react-native';
import React from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PostVideo } from '../../video/postVideo';





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


export default function HomeScreen() {
  const { user } = useAuth();
  const currentUser = user as any;
  const { posts, refetch } = usedPosts();
  const [debates, setDebates] = React.useState<any[]>([]);
  const [rootPosts, setRootPosts] = React.useState<Post[]>([]);
  const [repostRows, setRepostRows] = React.useState<any[]>([]);
  const [feedCursor, setFeedCursor] = React.useState<string | null>(null);
  const [hasMoreFeed, setHasMoreFeed] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const Image_Url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/`;
  


  const BUCKET = 'post-images'; 

 
  

  
  
  
 // const path = `${posts.user_id}/${post.file}`;
 // const imgUri = publicFileUrl(BUCKET, path);


 const AddLike = async (postId: string) => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
   try {
     const { data, error } = await supabase.from('Like').insert({
       user_id: currentUser?.id,
       post_id: postId,
       post_text: rootPosts.find((post) => post.id === postId)?.text || '',
     });
     if (error) {
       console.log('Error adding like:', error);
     } else {
       setRootPosts((currentPosts) => currentPosts.map((post) =>
         post.id === postId
           ? { ...post, likes: [...(post.likes || []), { user_id: currentUser.id }] }
           : post
       ));
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
         setRootPosts((currentPosts) => currentPosts.map((post) =>
           post.id === postId
             ? {
                 ...post,
                 likes: (post.likes || []).filter((like) => like.user_id !== currentUser.id),
               }
             : post
         ));
         await refetch();
       }
     } catch (err) {
       console.error('Exception removing like:', err);
     }
 }
const RemoveRepost = async (orig: Post) => {
  try {
    const rootPost = orig.parent_id
      ? posts?.find((post) => post.id === orig.parent_id) || orig
      : orig;
    const { error: repostError } = await supabase
      .from('Repost')
      .delete()
      .eq('post_id', rootPost.id)
      .eq('user_id', currentUser?.id);
    if (repostError) console.log('Error removing repost:', repostError);
    await refetch();
    await loadFeedData(true);
  } catch (err) {
    console.error('Exception removing repost:', err);
  }
};
 const addRepost = async (orig: Post) => {
  try {
    const rootPost = orig.parent_id
      ? posts?.find((post) => post.id === orig.parent_id) || orig
      : orig;
    const { error: repostError } = await supabase.from('Repost').insert({
      id: Crypto.randomUUID(),
      user_id: currentUser?.id,
      post_id: rootPost.id,
      post_text: rootPost.text,
    });

    if (repostError) {
      console.error('Error creating repost record:', repostError);
      return;
    }

    await refetch();
    await loadFeedData(true);
  } catch (err) {
    console.error('Error reposting:', err);
  }
};

  const loadFeedData = async (reset = false) => {
    if (isLoadingMore && !reset) return;
    setIsLoadingMore(true);

    const cursor = reset ? null : feedCursor;
    let rootQuery = supabase
      .from('Post')
      .select('*, user:User!user_id(*), likes:Like(*)')
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(0, 19);

    if (cursor) rootQuery = rootQuery.lt('created_at', cursor);

    const { data: rootData, error: rootError } = await rootQuery;

    if (rootError) {
      console.error('Error loading feed posts:', rootError);
      setIsLoadingMore(false);
      return;
    }

    const fetchedRoots = (rootData || []) as Post[];
    const nextRoots = reset
      ? fetchedRoots
      : [...rootPosts, ...fetchedRoots.filter(
          (post) => !rootPosts.some((existing) => existing.id === post.id)
        )];
    setRootPosts(nextRoots);
    setHasMoreFeed(fetchedRoots.length === 20);
    setFeedCursor(fetchedRoots[fetchedRoots.length - 1]?.created_at || feedCursor);

    if (nextRoots.length === 0) {
      setRepostRows([]);
      setIsLoadingMore(false);
      return;
    }

    const { data, error } = await supabase
      .from('Repost')
      .select('*, user:User!user_id(*)')
      .in('post_id', nextRoots.map((post) => post.id))
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading reposts:', error);
      setIsLoadingMore(false);
      return;
    }
    setRepostRows(data || []);
    setIsLoadingMore(false);
  };

  const handleFeedScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
    if (distanceFromBottom < 300 && hasMoreFeed && !isLoadingMore) {
      loadFeedData(false);
    }
  };

 
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
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);

    try {
      await refetch();
      await loadFeedData(true);
      const { data, error } = await supabase
        .from('Debate')
        .select('*, challenger:User!challenger_id(*), opponent:User!opponent_id(*)');
      if (!error && data) setDebates(data);
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  useFocusEffect(
  React.useCallback(() => {
    loadDebates();   
    refetch();       
    loadFeedData(true);
  }, [refetch])
);

  const regex = /(#\w+)|(@\w+)|([^#@]+)/g;

  const sortedPosts = React.useMemo(() => {
    return [...rootPosts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [rootPosts]);


  const feedPosts = React.useMemo(() => {
    const rootPosts = sortedPosts.filter((post) => !post.parent_id);
    const repostItems = repostRows
      .filter((repost) => repost.user_id !== currentUser?.id)
      .map((repost) => {
        const originalPost = rootPosts.find((post) => post.id === repost.post_id);
        if (!originalPost) return null;
        return {
          ...originalPost,
          id: `repost-${repost.id}`,
          parent_id: originalPost.id,
          repost_user_id: repost.user_id,
          repost_user: repost.user,
          created_at: repost.created_at,
        } as Post;
      })
      .filter(Boolean) as Post[];

    return [...rootPosts, ...repostItems].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [rootPosts, repostRows, sortedPosts, currentUser?.id]);



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
      <ScrollView
        style={styles.feed}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        onScroll={handleFeedScroll}
        scrollEventThrottle={250}
        refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> }
      >
        {(posts?.length ?? 0) === 0 ? (
          <Text style={{ color: 'gray', textAlign: 'center', marginTop: 24 }}>No posts yet.</Text>
        ) : null}
        {(feedPosts ?? []).map((post, idx) => {
          const originalPost = post.parent_id
            ? rootPosts.find((rootPost) => rootPost.id === post.parent_id)
            : post;
          const displayPost = originalPost || post;
          const originalPostId = originalPost?.id || post.id;
          const isLiked = originalPost?.likes?.some(
            (like: { user_id: string }) => like.user_id === currentUser?.id
          );
          const repostUserIds = new Set([
            ...repostRows
              .filter((repost) => repost.post_id === originalPostId)
              .map((repost) => repost.user_id as string),
            ...(rootPosts ?? [])
              .filter((p) => p.parent_id === originalPostId && p.repost_user_id)
              .map((p) => p.repost_user_id as string),
          ]);
          const repostCount = repostUserIds.size;
          // For reposts, check the original post's debate; otherwise check current post
          const hasExistingDebate = debates.some(d => d.root_post_id === originalPostId);
          const isSelectedAsDebate = Boolean(post.isDebate) || post.debate_side === 'root';
          const ifNotDebate = !hasExistingDebate;
          const isReposted = repostRows.some(
            (repost) => repost.post_id === originalPostId && repost.user_id === currentUser?.id
          ) || (rootPosts ?? []).some(
            p => p.parent_id === originalPostId && p.repost_user_id === currentUser?.id
          );
          const isOwnPost = Boolean(currentUser?.id && (originalPost?.user_id === currentUser.id || post.user_id === currentUser.id));
          const canDebate = isSelectedAsDebate && !isOwnPost && !hasExistingDebate;
          const imageUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${displayPost.user?.id}/${displayPost.user?.avatar}`;
          return (
          <React.Fragment key={post.id}>
            <View style={styles.postCard}>
              {displayPost.user?.avatar ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.avatar}
                  onError={(e) => console.log('Avatar load failed:', imageUrl, e.nativeEvent)}
                />
              ) : (
                <View style={styles.grayCircleAvatar}>
                  <Text style={styles.grayCircleText}>{displayPost.user?.username?.[0]?.toUpperCase() || '?'}</Text>
                </View>
              )}
              <View style={styles.postContent}>
                {/* if this post is a repost, show who reposted it */}
                
                {post.repost_user && (
                  <View style={styles.repostInfoRow}>
                    <Repeat size={16} color="#aaa" strokeWidth={2} />
                    <Text style={styles.repostInfo}>
                      Reposted by 
                    </Text>
                    <Pressable onPress = {() => router.push(
                      {pathname: `/user`, 
                      params: { userId: post.repost_user_id } 
                      })}>
                      <Text style={styles.repostInfo}>
                        {post.repost_user.username}
                      </Text>
                    </Pressable>
                  </View>
                )}
                <Pressable onPress = {() => router.push(
                  {pathname: `/user`, 
                  params: { userId: displayPost.user_id }
                  })}>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={styles.usernameNoMargin}>{displayPost.user?.username || (user as any)?.username}</Text>
                    <Text style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>
                      {timeAgo(displayPost.created_at)}
                    </Text>
                </View>
                </Pressable>
                
               {(ifNotDebate) && (
                  <View>
                    {renderPostText(displayPost.text)}
                      {displayPost.file && displayPost.file.endsWith('.mp4') ? (
                                    <PostVideo 
                                      uri={`${Image_Url}${displayPost.user_id}/${displayPost.file}`}
                                      isVisible={!!displayPost.file}
                                    />
                                  ) : (
                                    <Image
                                      source={{ uri: `${Image_Url}${displayPost.user_id}/${displayPost.file}` }}
                                      style={{ 
                                        width: !!displayPost.file ? '100%' : 0, 
                                        height: !!displayPost.file ? 200 : 0, 
                                        borderRadius: !!displayPost.file ? 10 : 0, 
                                        marginTop: !!displayPost.file ? 8 : 0 
                                      }}
                                    />
                                  )}
                                  
                  </View>
               )}
                {debates.filter((d) => d.root_post_id === originalPostId).map((debate) => (
                      <View key={debate.id} style={{ marginTop: 8 }}>
                        {/* ORIGINAL ARGUMENT */}
                        <View style={styles.argumentBox}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                            {originalPost?.user?.avatar ? (
                              <Image
                                source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${originalPost.user.id}/${originalPost.user.avatar}` }}
                                style={styles.avatar}
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
                                  source={{ uri: `${Image_Url}${originalPost?.user_id}/${originalPost?.file}` }}
                                  style={{ 
                                    width: !!originalPost?.file ? '100%' : 0, 
                                    height: !!originalPost?.file ? 200 : 0, 
                                    borderRadius: !!originalPost?.file ? 10 : 0, 
                                    marginTop: !!originalPost?.file ? 8 : 0 
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
                                style={styles.avatar}
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


                  

              
               {/**/}
              <View style={styles.actionsRow}>
                  <View style={styles.likeGroup}>
                    <Pressable onPress={ () => 
                      {
                        isLiked ? RemoveLike(originalPostId) : AddLike(originalPostId);
                      }} 
                      style={styles.actionIcon}>
                      <Heart size={20}  color={isLiked ? 'red' : 'grey'} fill={isLiked ? 'red' : 'transparent'} />
                    </Pressable>
                    {(displayPost.likes?.length ?? 0) > 0 && (
                      <Text style={styles.likeCount}>{displayPost.likes!.length}</Text>
                    )}
                  </View>
                  <Pressable style={styles.actionIcon}>
                    <MessageCircle size={20} color="#b0b0b0" />
                  </Pressable>

               
                  <View style={styles.repostGroup}>
                  <Pressable
                    onPress={() =>
                      
                      isReposted ? RemoveRepost(post) : addRepost(post)
                      //
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
                 
                  
                  
                  {hasExistingDebate ? (
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
  usernameNoMargin: {
  marginLeft: 0,
  color: 'white',
  fontWeight: '500',
  fontSize: 14.5,
},
 argumentBox: {
  backgroundColor: '#181818', // slightly different
  borderRadius: 12,
  padding: 10,
  marginTop: 8,

  borderWidth: 0.5,
  borderColor: '#343232', // 
},
 vsText: {
   color: '#888',
   textAlign: 'center',
   marginVertical: 6,
   fontSize: 12,
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
    fontWeight: '700',
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
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
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
    fontSize: 14,
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
  ongoingDebateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  ongoingDebateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  ongoingDebatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 211, 238, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ongoingDebateBadgeText: {
    color: '#22d3ee',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ongoingDebateSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
    maxWidth: '50%',
  },
  ongoingDebateViewPrompt: {
    color: '#22d3ee',
    fontSize: 12,
    fontWeight: '700',
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
    color: '#202124',
    fontWeight: '800',
    marginHorizontal: 4,
  },
  debateStatus: {
    marginTop: 4,
    color: '#272829',
    fontSize: 11,
    textAlign: 'center',
  },

});

