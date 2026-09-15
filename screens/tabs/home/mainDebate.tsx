import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Repeat,
  Send,
  Swords,
  Video as VideoIcon,
  X,
} from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Post, User } from '@/providers/PostsProvider';
import { useUploadFile } from '@/providers/uploadfile';
import { PostVideo } from '@/screens/video/postVideo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH;

interface ExchangeItem {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerHandle: string;
  avatar?: string | null;
  text: string;
  file?: string | null;
  createdAt: string;
  side: 'root' | 'challenger';
  roundNumber: number;
}

function formatExchangeDate(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
}

export default function MainDebateScreen() {
  const { postId, debateId } = useLocalSearchParams<{ postId?: string; debateId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const currentUser = user as any;
  const { uploadFile } = useUploadFile();

  const [loading, setLoading] = useState(true);
  const [rootPost, setRootPost] = useState<Post | null>(null);
  const [debate, setDebate] = useState<any | null>(null);
  const [exchanges, setExchanges] = useState<ExchangeItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hideExchangesBanner, setHideExchangesBanner] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [isReposted, setIsReposted] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // Votes state
  const [opVotes, setOpVotes] = useState(31);
  const [challengerVotes, setChallengerVotes] = useState(44);
  const [userVote, setUserVote] = useState<'op' | 'challenger' | null>(null);

  // Reply Composer State
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyPhoto, setReplyPhoto] = useState<string>('');
  const [replyVideo, setReplyVideo] = useState<string>('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const mainScrollRef = useRef<ScrollView>(null);

  const loadDebateData = async () => {
    try {
      setLoading(true);
      const targetPostId = postId;

      // 1. Fetch root post
      let postData: any = null;
      if (targetPostId) {
        const { data, error } = await supabase
          .from('Post')
          .select('*, user:User!user_id(*), likes:Like(*)')
          .eq('id', targetPostId)
          .maybeSingle();

        if (error) console.warn('Error loading root post:', error.message);
        postData = data;

        if (data?.parent_id && data?.repost_user_id) {
          const { data: originalPost } = await supabase
            .from('Post')
            .select('*, user:User!user_id(*), likes:Like(*)')
            .eq('id', data.parent_id)
            .maybeSingle();
          if (originalPost) postData = originalPost;
        }

        setRootPost(postData as any);
      }

      // 2. Fetch debate record
      let debateQuery = supabase
        .from('Debate')
        .select('*, challenger:User!challenger_id(*), opponent:User!opponent_id(*)');

      if (debateId) {
        debateQuery = debateQuery.eq('id', debateId);
      } else if (postData?.id || targetPostId) {
        debateQuery = debateQuery.eq('root_post_id', postData?.id || targetPostId);
      }

      const { data: debateData, error: debateErr } = await debateQuery.maybeSingle();
      if (debateErr) console.warn('Error loading debate:', debateErr.message);

      setDebate(debateData);

      let debateSegments: any[] = [];
      if (debateData?.id) {
        const { data: segmentData, error: segmentError } = await supabase
          .from('DebateSegment')
          .select('*')
          .eq('debate_id', debateData.id)
          .order('round_number', { ascending: true });

        if (segmentError) {
          console.warn('Error loading debate segments:', segmentError.message);
        } else {
          debateSegments = segmentData || [];
        }
      }

      // 3. Fetch any additional replies / threaded posts in this debate
      const currentRootId = postData?.id || debateData?.root_post_id;
      let threadPosts: any[] = [];
      if (currentRootId) {
        const { data: repliesData } = await supabase
          .from('Post')
          .select('*, user:User!user_id(*)')
          .eq('parent_id', currentRootId)
          .is('repost_user_id', null)
          .order('created_at', { ascending: true });

        threadPosts = (repliesData || []).filter((p) => !p.repost_user_id);
        setCommentCount(threadPosts.filter((p) => !p.debate_side).length);

        const [{ data: postReposts }, { data: legacyReposts }] = await Promise.all([
          supabase
            .from('Post')
            .select('repost_user_id')
            .eq('parent_id', currentRootId)
            .not('repost_user_id', 'is', null),
          supabase
            .from('Repost')
            .select('user_id')
            .eq('post_id', currentRootId),
        ]);
        const repostUserIds = new Set([
          ...(postReposts || []).map((repost) => repost.repost_user_id),
          ...(legacyReposts || []).map((repost) => repost.user_id),
        ]);
        setRepostCount(repostUserIds.size);

        if (currentUser?.id) {
          setIsReposted(repostUserIds.has(currentUser.id));
        }
      }

      // 4. Construct exchanges list
      const items: ExchangeItem[] = [];

      // Exchange 0: Root opinion
      if (postData) {
        items.push({
          id: postData.id,
          speakerId: postData.user_id,
          speakerName: postData.user?.username || 'Original Poster',
          speakerHandle: postData.user?.username?.toLowerCase() || 'op',
          avatar: postData.user?.avatar,
          text: postData.text || '',
          file: postData.file,
          createdAt: postData.created_at,
          side: 'root',
          roundNumber: 1,
        });
      }

      if (debateSegments.length > 0) {
        debateSegments.forEach((segment) => {
          const speaker =
            segment.speaker_id === debateData?.challenger_id
              ? debateData.challenger
              : segment.speaker_id === debateData?.opponent_id
                ? debateData.opponent
                : segment.speaker_id === postData?.user_id
                  ? postData.user
                  : null;
          items.push({
            id: segment.id,
            speakerId: segment.speaker_id,
            speakerName: speaker?.username || 'Debater',
            speakerHandle: speaker?.username?.toLowerCase() || 'debater',
            avatar: speaker?.avatar,
            text: segment.text || '',
            file: segment.file,
            createdAt: segment.created_at,
            side: segment.side === 'root' ? 'root' : 'challenger',
            roundNumber: segment.round_number,
          });
        });
      } else {
        // Legacy debates created before DebateSegment existed.
        if (debateData && debateData.challenger_text) {
          items.push({
            id: `${debateData.id}-challenger`,
            speakerId: debateData.challenger_id,
            speakerName: debateData.challenger?.username || 'Challenger',
            speakerHandle: debateData.challenger?.username?.toLowerCase() || 'challenger',
            avatar: debateData.challenger?.avatar,
            text: debateData.challenger_text || '',
            file: debateData.challenger_file || null,
            createdAt: debateData.created_at,
            side: 'challenger',
            roundNumber: 2,
          });
        }

        threadPosts.forEach((tp) => {
          const isOp = tp.user_id === postData?.user_id;
          items.push({
            id: tp.id,
            speakerId: tp.user_id,
            speakerName: tp.user?.username || (isOp ? 'Original Poster' : 'Challenger'),
            speakerHandle: tp.user?.username?.toLowerCase() || 'user',
            avatar: tp.user?.avatar,
            text: tp.text || '',
            file: tp.file,
            createdAt: tp.created_at,
            side: isOp ? 'root' : 'challenger',
            roundNumber: items.length + 1,
          });
        });
      }

      setExchanges(items);

      // Initial vote counts based on debate or defaults
      const baseOp = 31 + (postData?.likes?.length || 0);
      const baseChallenger = 44;
      setOpVotes(baseOp);
      setChallengerVotes(baseChallenger);
    } catch (err) {
      console.error('Error fetching debate screen data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebateData();
  }, [postId, debateId]);

  // Determine who has the next turn to reply
  const opUser: User = rootPost?.user || {
    id: rootPost?.user_id || '',
    username: 'Original Poster',
  };

  const challengerUser: User = debate?.challenger || {
    id: debate?.challenger_id || '',
    username: 'Challenger',
  };

  const lastExchange = exchanges.length > 0 ? exchanges[exchanges.length - 1] : null;
  const isLastSpeakerChallenger = lastExchange ? lastExchange.side === 'challenger' : true;

  // Next speaker is OP if last was challenger; otherwise next is Challenger
  const nextSpeakerId = isLastSpeakerChallenger ? opUser.id : challengerUser.id;
  const nextSpeakerName = isLastSpeakerChallenger ? opUser.username : challengerUser.username;
  const isCurrentUserDebater = Boolean(
    currentUser?.id && (currentUser.id === opUser.id || currentUser.id === challengerUser.id)
  );
  const isCurrentUserTurn = Boolean(
    currentUser?.id && isCurrentUserDebater && currentUser.id === nextSpeakerId
  );

  // Total slides = all exchanges + (1 final slide if it is currently the logged-in user's turn)
  const totalSlides = exchanges.length + (isCurrentUserTurn ? 1 : 0);

  const scrollToSlide = (index: number) => {
    if (index < 0 || index >= totalSlides) return;
    scrollRef.current?.scrollTo({
      x: index * SLIDE_WIDTH,
      animated: true,
    });
    setActiveIndex(index);
    Haptics.selectionAsync();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SLIDE_WIDTH);
    if (index !== activeIndex && index >= 0 && index < totalSlides) {
      setActiveIndex(index);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setReplyPhoto(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Pick photo error:', e);
    }
  };

  const handlePickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setReplyVideo(result.assets[0].uri);
      }
    } catch (e) {
      console.warn('Pick video error:', e);
    }
  };

  const handleSubmitCounterOpinion = async () => {
    if (!replyText.trim() && !replyPhoto && !replyVideo) {
      Alert.alert('Please enter your rebuttal', 'Write your counter-opinion before submitting.');
      return;
    }

    if (!currentUser?.id) {
      Alert.alert('Sign in required', 'Please log in to participate in the debate.');
      return;
    }

    try {
      setIsSubmittingReply(true);
      let mediaFilename: string | null = null;

      if (replyPhoto) {
        setIsUploadingMedia(true);
        mediaFilename = await uploadFile(
          currentUser.id,
          replyPhoto,
          'image/jpeg',
          `${Date.now()}-reply.jpg`
        );
        setIsUploadingMedia(false);
      } else if (replyVideo) {
        setIsUploadingMedia(true);
        mediaFilename = await uploadFile(
          currentUser.id,
          replyVideo,
          'video/mp4',
          `${Date.now()}-reply.mp4`
        );
        setIsUploadingMedia(false);
      }

      const rootId = rootPost?.id || debate?.root_post_id;
      const debateDbId = debate?.id;
      const currentSide = currentUser.id === opUser.id ? 'root' : 'challenger';

      const { error: segmentError } = await supabase.from('DebateSegment').insert({
        id: Crypto.randomUUID(),
        debate_id: debateDbId,
        post_id: rootId,
        speaker_id: currentUser.id,
        text: replyText.trim(),
        file: mediaFilename,
        side: currentSide,
        round_number: exchanges.length + 1,
      });

      if (segmentError) {
        console.error('Error creating debate segment:', segmentError);
        Alert.alert('Error', 'The response was posted, but its debate segment could not be saved.');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReplyText('');
      setReplyPhoto('');
      setReplyVideo('');

      // Reload exchanges
      await loadDebateData();
      scrollToSlide(exchanges.length);
    } catch (e: any) {
      console.error('Submit rebuttal exception:', e);
      Alert.alert('Error', e?.message || 'Something went wrong.');
    } finally {
      setIsSubmittingReply(false);
      setIsUploadingMedia(false);
    }
  };

  const isLiked = Boolean(rootPost?.likes?.some((like) => like.user_id === currentUser?.id));

  const handleToggleLike = async () => {
    if (!rootPost?.id || !currentUser?.id) {
      Alert.alert('Sign in required', 'Please log in to like this post.');
      return;
    }

    if (isLiked) {
      await supabase.from('Like').delete().eq('user_id', currentUser.id).eq('post_id', rootPost.id);
      setRootPost((post) =>
        post
          ? { ...post, likes: (post.likes || []).filter((like) => like.user_id !== currentUser.id) }
          : post
      );
    } else {
      const { error } = await supabase.from('Like').insert({
        user_id: currentUser.id,
        post_id: rootPost.id,
        post_text: rootPost.text,
      });
      if (!error) {
        setRootPost((post) =>
          post
            ? { ...post, likes: [...(post.likes || []), { user_id: currentUser.id }] }
            : post
        );
      }
    }
  };

  const handleToggleRepost = async () => {
    if (!rootPost?.id || !currentUser?.id) {
      Alert.alert('Sign in required', 'Please log in to repost this post.');
      return;
    }

    if (isReposted) {
      const { error: feedPostError } = await supabase
        .from('Post')
        .delete()
        .eq('parent_id', rootPost.id)
        .eq('repost_user_id', currentUser.id);
      const { error: repostError } = await supabase
        .from('Repost')
        .delete()
        .eq('post_id', rootPost.id)
        .eq('user_id', currentUser.id);
      if (!feedPostError && !repostError) {
        setIsReposted(false);
        setRepostCount((count) => Math.max(0, count - 1));
      }
      return;
    }

    const { error: repostError } = await supabase.from('Repost').insert({
      id: Crypto.randomUUID(),
      user_id: currentUser.id,
      post_id: rootPost.id,
      post_text: rootPost.text,
    });
    if (repostError) {
      console.error('Error creating repost record:', repostError);
      return;
    }

    const { error: feedPostError } = await supabase.from('Post').insert({
      id: Crypto.randomUUID(),
      user_id: rootPost.user_id,
      parent_id: rootPost.id,
      text: rootPost.text,
      file: rootPost.file,
      repost_user_id: currentUser.id,
    });
    if (feedPostError) {
      await supabase.from('Repost').delete().eq('post_id', rootPost.id).eq('user_id', currentUser.id);
      console.error('Error creating repost feed entry:', feedPostError);
      return;
    }
    if (!repostError && !feedPostError) {
      setIsReposted(true);
      setRepostCount((count) => count + 1);
    }
  };

  const totalVotes = opVotes + challengerVotes;
  const opPercentage = totalVotes > 0 ? (opVotes / totalVotes) * 100 : 50;

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {/* Top Header */}
          <View style={styles.topHeader}>
            <Pressable onPress={() => router.back()} style={styles.headerBackButton} hitSlop={12}>
              <ArrowLeft size={20} color="#fff" />
            </Pressable>

            <Text style={styles.topHeaderTitle}>Debate</Text>

            <View style={{ width: 36 }} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22c55e" />
            </View>
          ) : (
            <ScrollView
              ref={mainScrollRef}
              contentContainerStyle={styles.mainScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Carousel Section (Horizontal swipeable opinion cards) */}
              <View style={styles.carouselContainer}>
                <ScrollView
                  ref={scrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  decelerationRate="fast"
                  snapToInterval={SLIDE_WIDTH}
                  snapToAlignment="center"
                  style={styles.horizontalScrollView}
                >
                  {/* Render existing exchanges */}
                  {exchanges.map((item, index) => {
                    const isOpCard = item.side === 'root';
                    return (
                      <View key={item.id} style={styles.cardWrapper}>
                        <View
                          style={[
                            styles.debateCard,
                            isOpCard ? styles.opCardBorder : styles.challengerCardBorder,
                          ]}
                        >
                          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                          <LinearGradient
                            colors={['rgba(255, 255, 255, 0.03)', 'rgba(0, 0, 0, 0.3)']}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                          />

                          {/* Author info */}
                          <View style={styles.cardHeader}>
                            <View style={styles.cardAuthorRow}>
                              <Text style={styles.cardAuthorName}>{item.speakerName}</Text>
                              <View
                                style={[
                                  styles.cardSideTag,
                                  isOpCard ? styles.cardSideTagOp : styles.cardSideTagChallenger,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.cardSideTagText,
                                    isOpCard ? { color: '#c084fc' } : { color: '#22d3ee' },
                                  ]}
                                >
                                  {isOpCard ? 'ORIGINAL' : 'COUNTER'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Body text */}
                          <Text style={styles.cardBodyText}>{item.text}</Text>

                          {/* Optional Media */}
                          {item.file ? (
                            item.file.endsWith('.mp4') ? (
                              <View style={styles.cardMediaContainer}>
                                <PostVideo
                                  uri={`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${item.speakerId}/${item.file}`}
                                  isVisible={activeIndex === index}
                                />
                              </View>
                            ) : (
                              <Image
                                source={{
                                  uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${item.speakerId}/${item.file}`,
                                }}
                                style={styles.cardMediaImage}
                                resizeMode="cover"
                              />
                            )
                          ) : null}

                          {/* Timestamp at bottom */}
                          <Text style={styles.cardTimestamp}>
                            {formatExchangeDate(item.createdAt)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}

                  {/* FINAL SLIDE: Render ONLY if it is currently the logged-in user's debate and turn */}
                  {isCurrentUserTurn ? (
                    <View style={styles.cardWrapper}>
                      <View style={[styles.debateCard, styles.inputCardBorder]}>
                        <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                        <LinearGradient
                          colors={['rgba(34, 211, 238, 0.05)', 'rgba(0, 0, 0, 0.4)']}
                          style={StyleSheet.absoluteFill}
                          pointerEvents="none"
                        />

                        {/* Header for next turn */}
                        <View style={styles.cardHeader}>
                          <View style={styles.cardAuthorRow}>
                            <Text style={styles.cardAuthorName}>Your Counter-Opinion</Text>
                            <View style={styles.cardSideTagActive}>
                              <Text style={styles.cardSideTagActiveText}>NEXT ROUND</Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.inputCardBody}>
                          <TextInput
                            style={styles.rebuttalTextInput}
                            placeholder="Reply to the counter-argument..."
                            placeholderTextColor="#64748b"
                            multiline
                            value={replyText}
                            onChangeText={setReplyText}
                          />

                          {/* Attached Photo Preview */}
                          {replyPhoto ? (
                            <View style={styles.composerMediaPreview}>
                              <Image
                                source={{ uri: replyPhoto }}
                                style={styles.composerMediaThumb}
                              />
                              <Pressable
                                onPress={() => setReplyPhoto('')}
                                style={styles.removeMediaBtn}
                              >
                                <X size={14} color="#fff" />
                              </Pressable>
                            </View>
                          ) : null}

                          {/* Attached Video Preview */}
                          {replyVideo ? (
                            <View style={styles.composerMediaPreview}>
                              <PostVideo uri={replyVideo} isVisible={true} />
                              <Pressable
                                onPress={() => setReplyVideo('')}
                                style={styles.removeMediaBtn}
                              >
                                <X size={14} color="#fff" />
                              </Pressable>
                            </View>
                          ) : null}

                          {/* Actions row inside input slide */}
                          <View style={styles.inputCardActions}>
                            <View style={styles.inputMediaButtons}>
                              <Pressable onPress={handlePickPhoto} style={styles.mediaActionBtn}>
                                <ImageIcon size={18} color="#94a3b8" />
                              </Pressable>
                              <Pressable onPress={handlePickVideo} style={styles.mediaActionBtn}>
                                <VideoIcon size={18} color="#94a3b8" />
                              </Pressable>
                            </View>

                            <Pressable
                              onPress={handleSubmitCounterOpinion}
                              disabled={isSubmittingReply || isUploadingMedia}
                              style={({ pressed }) => [
                                styles.submitCounterBtn,
                                pressed && { opacity: 0.8 },
                              ]}
                            >
                              {isSubmittingReply || isUploadingMedia ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <>
                                  <Text style={styles.submitCounterBtnText}>Post Counter</Text>
                                  <Send size={14} color="#fff" />
                                </>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                {/* Pagination Dots (Synced with active slide) */}
                <View style={styles.paginationRow}>
                  <View style={styles.dotsIndicatorContainer}>
                    {Array.from({ length: totalSlides }).map((_, idx) => {
                      const isActive = idx === activeIndex;
                      return (
                        <Pressable
                          key={idx}
                          onPress={() => scrollToSlide(idx)}
                          style={[
                            styles.dot,
                            isActive ? styles.dotActive : styles.dotInactive,
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={styles.postActionsRow}>
                <Pressable onPress={handleToggleLike} style={styles.postAction}>
                  <Heart
                    size={20}
                    color={isLiked ? '#ef4444' : '#b0b0b0'}
                    fill={isLiked ? '#ef4444' : 'transparent'}
                  />
                  {(rootPost?.likes?.length || 0) > 0 ? (
                    <Text style={styles.postActionText}>{rootPost?.likes?.length}</Text>
                  ) : null}
                </Pressable>
                <Pressable
                  onPress={() => mainScrollRef.current?.scrollToEnd({ animated: true })}
                  style={styles.postAction}
                >
                  <MessageCircle size={20} color="#b0b0b0" />
                  {commentCount > 0 ? (
                    <Text style={styles.postActionText}>{commentCount}</Text>
                  ) : null}
                </Pressable>
                <Pressable onPress={handleToggleRepost} style={styles.postAction}>
                  <Repeat size={20} color={isReposted ? '#22d3ee' : '#b0b0b0'} />
                  {repostCount > 0 ? (
                    <Text style={styles.postActionText}>{repostCount}</Text>
                  ) : null}
                </Pressable>
              </View>

              {/* Debate Separator Line extending edge-to-edge */}
              <View style={styles.fullWidthDivider} />

              {/* Comments Section */}
              <View style={styles.commentsContainer}>
                <Text style={styles.noCommentsText}>No comments yet.</Text>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  safeArea: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topHeaderTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainScrollContent: {
    paddingBottom: 40,
  },
  carouselContainer: {
    marginTop: 56,
    alignItems: 'center',
  },
  horizontalScrollView: {
    width: SCREEN_WIDTH,
  },
  cardWrapper: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debateCard: {
    width: '100%',
    minHeight: 140,
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#181818',
    justifyContent: 'space-between',
  },
  opCardBorder: {
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  challengerCardBorder: {
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  inputCardBorder: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardAuthorName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cardSideTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardSideTagOp: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  cardSideTagChallenger: {
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
  },
  cardSideTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardSideTagActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardSideTagActiveText: {
    color: '#22d3ee',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  cardBodyText: {
    color: '#e5e7eb',
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 10,
  },
  cardMediaContainer: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  cardMediaImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: 10,
  },
  cardTimestamp: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  inputCardBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  rebuttalTextInput: {
    color: '#ffffff',
    fontSize: 14.5,
    lineHeight: 21,
    minHeight: 64,
    textAlignVertical: 'top',
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  composerMediaPreview: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    marginVertical: 8,
  },
  composerMediaThumb: {
    width: '100%',
    height: '100%',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333333',
  },
  inputMediaButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mediaActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  submitCounterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  submitCounterBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  postActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  postAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  postActionText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  dotsIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: '#22d3ee',
  },
  dotInactive: {
    width: 6,
    backgroundColor: '#333333',
  },
  fullWidthDivider: {
    height: 1,
    backgroundColor: '#222222',
    marginTop: 12,
    width: '100%',
  },
  commentsContainer: {
    paddingTop: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noCommentsText: {
    color: '#71767b',
    fontSize: 14,
    fontWeight: '500',
  },
});