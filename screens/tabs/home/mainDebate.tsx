import { Text } from '@/components/ui/text';
import { CommentItem, useComments } from '@/hooks/use-comments';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { Post, User } from '@/providers/PostsProvider';
import { useUploadFile } from '@/providers/uploadfile';
import { PostVideo } from '@/screens/video/postVideo';
import { BlurView } from 'expo-blur';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Repeat,
  Send,
  Swords,
  Video as VideoIcon,
  X
} from 'lucide-react-native';
import { ComponentRef, Fragment, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  ListRenderItem,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createCompactStyleSheet } from '@/lib/compact-ui';

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

function timeAgo(dateString: string) {
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 600) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}hr`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return `${Math.floor(diffDay / 7)}w`;
}

function createCommentMediaFilename(extension: 'jpg' | 'mp4') {
  return `${Date.now()}-comment.${extension}`;
}

type ThreadScrollRequest = {
  token: number;
  index?: number;
  offset?: number;
};

type InlineDebateSegment = {
  id: string;
  debate_id: string;
  speaker_id: string;
  text: string | null;
  file: string | null;
  side: 'root' | 'challenger';
  round_number: number;
  created_at: string;
  speaker?: { id: string; username: string; avatar?: string | null };
};

type InlineCommentDebate = {
  id: string;
  root_comment_id: string;
  challenger_id: string;
  opponent_id: string | null;
  challenger?: { id: string; username: string; avatar?: string | null };
  opponent?: { id: string; username: string; avatar?: string | null } | null;
  segments: InlineDebateSegment[];
};

function CommentDebateSection({
  targetComment,
  width,
  comments,
  renderComment,
}: {
  targetComment: CommentItem;
  width: number;
  comments: CommentItem[];
  renderComment: (
    comment: CommentItem,
    referenceComment: CommentItem,
    isActive: boolean,
  ) => ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [scrollRequest, setScrollRequest] = useState<ThreadScrollRequest>();
  const carouselWidth = Math.max(width, 1);
  const webWindowStart = Math.max(0, activeIndex - 1);
  const webWindowEnd = Math.min(comments.length, activeIndex + 2);

  const goToPage = (index: number) => {
    const boundedIndex = Math.max(0, Math.min(index, comments.length - 1));
    setActiveIndex(boundedIndex);
    setScrollRequest((current) => ({
      token: (current?.token ?? 0) + 1,
      offset: boundedIndex * carouselWidth,
    }));
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / carouselWidth);
    setActiveIndex(Math.max(0, Math.min(index, comments.length - 1)));
  };

  return (
    <View style={styles.commentDebateSection}>
      <View style={[styles.commentDivider, styles.debateDivider]} />
      <View style={styles.commentCarouselViewport}>
        <CommentThreadScroller
          width={carouselWidth}
          items={comments}
          slideCount={comments.length}
          request={scrollRequest}
          onLayout={() => {}}
          renderItem={({ item, index }) => renderComment(item, targetComment, activeIndex === index)}
          onMomentumScrollEnd={handleMomentumScrollEnd}
        >
          {webWindowStart > 0 ? <View style={{ width: webWindowStart * carouselWidth }} /> : null}
          {comments.slice(webWindowStart, webWindowEnd).map((comment, index) => (
            <Fragment key={comment.id}>
              {renderComment(comment, targetComment, activeIndex === webWindowStart + index)}
            </Fragment>
          ))}
        </CommentThreadScroller>
        {Platform.OS === 'web' && comments.length > 1 ? (
          <View pointerEvents="box-none" style={styles.webCarouselArrows}>
            <Pressable
              onPress={() => goToPage(activeIndex - 1)}
              disabled={activeIndex <= 0}
              accessibilityRole="button"
              accessibilityLabel="Previous debate comment"
              style={[styles.webCarouselArrow, styles.webCarouselArrowLeft, activeIndex <= 0 && styles.webCarouselArrowDisabled]}
            >
              <ChevronLeft size={16} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => goToPage(activeIndex + 1)}
              disabled={activeIndex >= comments.length - 1}
              accessibilityRole="button"
              accessibilityLabel="Next debate comment"
              style={[styles.webCarouselArrow, styles.webCarouselArrowRight, activeIndex >= comments.length - 1 && styles.webCarouselArrowDisabled]}
            >
              <ChevronRight size={16} color="#fff" />
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={styles.threadPagination}>
        {comments.map((comment, index) => (
          <View
            key={comment.id}
            style={[styles.threadDot, index === activeIndex && styles.threadDotActive]}
          />
        ))}
      </View>
    </View>
  );
}

function CommentThreadScroller({
  width,
  items,
  slideCount,
  request,
  onLayout,
  renderItem,
  onMomentumScrollEnd,
  debugThreadRootId,
  children,
}: {
  width: number;
  items: CommentItem[];
  slideCount: number;
  request?: ThreadScrollRequest;
  onLayout: (event: LayoutChangeEvent) => void;
  renderItem: ListRenderItem<CommentItem>;
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  debugThreadRootId?: string;
  children: ReactNode;
}) {
  const [translateX] = useState(() => new Animated.Value(0));
  const listRef = useRef<FlatList<CommentItem>>(null);
  const debugScrollRequestToken = useRef<number | undefined>(undefined);
  const debugScrollEventCount = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || request?.offset === undefined || !width) return;
    const nextIndex = Math.max(0, Math.min(Math.round(request.offset / width), slideCount - 1));
    Animated.timing(translateX, {
      toValue: -nextIndex * width,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [request?.token, request?.offset, slideCount, translateX, width]);

  useEffect(() => {
    if (Platform.OS === 'web' || request?.offset === undefined || !width) return;
    const offset = request.offset;
    const frame = requestAnimationFrame(() => {
      if (__DEV__) {
        console.log('[thread-carousel-debug] request effect scroll', {
          threadRootId: debugThreadRootId,
          index: request.index,
          offset,
          width,
          hasListRef: Boolean(listRef.current),
        });
      }
      listRef.current?.scrollToOffset({ offset, animated: true });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [debugThreadRootId, request?.token, request?.offset, request?.index, width]);

  if (Platform.OS === 'web') {
    return (
      <View style={{ width, overflow: 'hidden' }} onLayout={onLayout}>
        <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
          {children}
        </Animated.View>
      </View>
    );
  }

  const handleNativeScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (__DEV__ && request?.token !== undefined) {
      if (debugScrollRequestToken.current !== request.token) {
        debugScrollRequestToken.current = request.token;
        debugScrollEventCount.current = 0;
      }
      if (debugScrollEventCount.current < 6) {
        debugScrollEventCount.current += 1;
        console.log('[thread-carousel-debug] native scroll offset', {
          threadRootId: debugThreadRootId,
          requestIndex: request.index,
          requestedOffset: request.offset,
          actualOffset: event.nativeEvent.contentOffset.x,
          width,
          sample: debugScrollEventCount.current,
        });
      }
    }
  };

  return (
    <FlatList
      ref={listRef}
      data={items}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={width}
      snapToAlignment="start"
      initialNumToRender={2}
      maxToRenderPerBatch={3}
      updateCellsBatchingPeriod={16}
      windowSize={5}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      onLayout={onLayout}
      onScroll={handleNativeScroll}
      scrollEventThrottle={100}
      onMomentumScrollEnd={onMomentumScrollEnd}
    />
  );
}

export default function MainDebateScreen() {
  const { postId, debateId } = useLocalSearchParams<{ postId?: string; debateId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const currentUser = user as any;
  const { uploadFile } = useUploadFile();
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = Platform.OS === 'web' ? Math.min(windowWidth, 500) : windowWidth;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rootPost, setRootPost] = useState<Post | null>(null);
  const [debate, setDebate] = useState<any | null>(null);
  const [debateTargetComment, setDebateTargetComment] = useState<CommentItem | null>(null);
  const [commentDebates, setCommentDebates] = useState<Record<string, InlineCommentDebate>>({});
  const [collapsedCommentDebates, setCollapsedCommentDebates] = useState<Record<string, boolean>>({});
  const [exchanges, setExchanges] = useState<ExchangeItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hideExchangesBanner, setHideExchangesBanner] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [isReposted, setIsReposted] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const {
    data: comments,
    commentCount: commentsCount,
    isLoadingMoreTopLevel,
    hasMoreTopLevel,
    threadErrors,
    isThreadLoading,
    threadHasMore,
    loadMoreTopLevel,
    loadMoreThreadReplies,
    loadCommentPath,
    addComment,
    updateComment,
    refetch: refetchComments,
  } = useComments(rootPost?.id);
  const loadedCommentIdsKey = (comments ?? []).map((comment) => comment.id).join(',');

  useEffect(() => {
    if (!loadedCommentIdsKey) return;

    const loadedCommentIds = loadedCommentIdsKey.split(',');
    let cancelled = false;
    const loadCommentDebates = async () => {
      const { data: debates, error: debatesError } = await supabase
        .from('Debate')
        .select('*, challenger:User!challenger_id(id,username,avatar), opponent:User!opponent_id(id,username,avatar)')
        .in('root_comment_id', loadedCommentIds);

      if (debatesError) {
        console.error('Error loading comment debates:', debatesError);
        return;
      }

      const debateIds = (debates ?? []).map((item) => item.id);
      let segments: InlineDebateSegment[] = [];
      if (debateIds.length) {
        const { data: segmentData, error: segmentsError } = await supabase
          .from('DebateSegment')
          .select('*, speaker:User!speaker_id(id,username,avatar)')
          .in('debate_id', debateIds)
          .order('round_number', { ascending: true });

        if (segmentsError) {
          console.error('Error loading comment debate responses:', segmentsError);
          return;
        }
        segments = (segmentData ?? []) as unknown as InlineDebateSegment[];
      }

      if (cancelled) return;
      const segmentsByDebate = new Map<string, InlineDebateSegment[]>();
      segments.forEach((segment) => {
        const existing = segmentsByDebate.get(segment.debate_id) ?? [];
        existing.push(segment);
        segmentsByDebate.set(segment.debate_id, existing);
      });

      const nextDebates: Record<string, InlineCommentDebate> = {};
      (debates ?? []).forEach((item) => {
        if (!item.root_comment_id) return;
        nextDebates[item.root_comment_id] = {
          ...(item as unknown as Omit<InlineCommentDebate, 'segments'>),
          segments: segmentsByDebate.get(item.id) ?? [],
        };
      });
      setCommentDebates(nextDebates);
    };

    void loadCommentDebates();
    return () => {
      cancelled = true;
    };
  }, [loadedCommentIdsKey]);

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

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const mainScrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const loadDebateData = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
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

        // A reposted comment opens the debate/post the comment was made on
        if (data?.source_comment_id) {
          const { data: sourceComment } = await supabase
            .from('Comment')
            .select('post_id')
            .eq('id', data.source_comment_id)
            .maybeSingle();
          if (sourceComment?.post_id) {
            const { data: sourcePost } = await supabase
              .from('Post')
              .select('*, user:User!user_id(*), likes:Like(*)')
              .eq('id', sourceComment.post_id)
              .maybeSingle();
            if (sourcePost) postData = sourcePost;
          }
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

      let targetComment: CommentItem | null = null;
      if (debateData?.root_comment_id) {
        const { data: targetData, error: targetError } = await supabase
          .from('Comment')
          .select('*, speaker:User!speaker_id(id,username,avatar)')
          .eq('id', debateData.root_comment_id)
          .maybeSingle();

        if (targetError) {
          console.error('Error loading debate target comment:', targetError);
        } else {
          targetComment = targetData as unknown as CommentItem | null;
        }
      }
      setDebateTargetComment(targetComment);

      if (!postData && targetComment?.post_id) {
        const { data: targetPost, error: targetPostError } = await supabase
          .from('Post')
          .select('*, user:User!user_id(*), likes:Like(*)')
          .eq('id', targetComment.post_id)
          .maybeSingle();

        if (targetPostError) {
          console.error('Error loading post for comment-rooted debate:', targetPostError);
        } else if (targetPost) {
          postData = targetPost;
          setRootPost(targetPost as Post);
        }
      }

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
      if (postData && !debateData?.root_comment_id) {
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
      if (showLoader) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    try {
      await loadDebateData(false);
      await refetchComments();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadDebateData());
  }, [postId, debateId]);

  const opUser: User = (debate?.root_comment_id
    ? debate?.opponent || debateTargetComment?.speaker
    : rootPost?.user) || {
      id: debate?.opponent_id || rootPost?.user_id || '',
      username: 'Original Poster',
    };

  const challengerUser: User = debate?.challenger || {
    id: debate?.challenger_id || '',
    username: 'Challenger',
  };

  const lastExchange = exchanges.length > 0 ? exchanges[exchanges.length - 1] : null;
  const isLastSpeakerChallenger = lastExchange ? lastExchange.side === 'challenger' : true;

  // Next speaker is OP if last was challenger otherwise next is Challenger
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
      x: index * screenWidth,
      animated: true,
    });
    setActiveIndex(index);
    Haptics.selectionAsync();
  };

  const stepThreadSlide = (threadRootId: string, direction: -1 | 1, slideCount: number) => {
    const threadComments = getThreadComments(threadRootId);
    const activeId = activeThreadCommentIds[threadRootId];
    const activeIndex = Math.max(0, threadComments.findIndex((comment) => comment.id === activeId));
    const currentIndex = activeId ? activeIndex : 0;
    const nextIndex = Math.max(0, Math.min(currentIndex + direction, slideCount - 1));
    if (nextIndex === currentIndex) return;
    handleThreadCarouselPageChange(threadRootId, threadComments, nextIndex);
    requestThreadScroll(threadRootId, nextIndex);
    Haptics.selectionAsync();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / screenWidth);
    if (index !== activeIndex && index >= 0 && index < totalSlides) {
      setActiveIndex(index);
    }
  };

  const handleMainScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!rootPost?.id || !hasMoreTopLevel || isLoadingMoreTopLevel) return;
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromEnd = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromEnd < 600) void loadMoreTopLevel();
  };

  const prefetchNextThreadImage = (threadComments: CommentItem[], index: number) => {
    if (Platform.OS === 'web') return;
    const nextComment = threadComments[index + 1];
    if (!nextComment?.file || nextComment.file.endsWith('.mp4')) return;

    const uri = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${nextComment.speaker_id}/${nextComment.file}`;
    void Image.prefetch(uri).catch((error) => {
      console.warn('Could not prefetch the next comment image:', error);
    });
  };

  const handleThreadCarouselPageChange = (
    threadRootId: string,
    threadComments: CommentItem[],
    index: number
  ) => {
    const boundedIndex = Math.max(0, Math.min(index, threadComments.length - 1));
    setActiveThreadCommentIds((ids) => ({
      ...ids,
      [threadRootId]: threadComments[boundedIndex]?.id ?? threadRootId,
    }));

    if (lastThreadSlideIndices.current[threadRootId] === boundedIndex) return;
    lastThreadSlideIndices.current[threadRootId] = boundedIndex;
    prefetchNextThreadImage(threadComments, boundedIndex);
    if (boundedIndex === 0) return;

    const activeComment = threadComments[boundedIndex];
    if (activeComment) {
      if (threadHasMore(activeComment.id) && !isThreadLoading(activeComment.id) && !threadErrors[activeComment.id]) {
        void loadMoreThreadReplies(activeComment.id);
      }

      const siblings = comments.filter((item) => item.parent_comment_id === activeComment.parent_comment_id);
      const siblingIndex = siblings.findIndex((item) => item.id === activeComment.id);
      const parentId = activeComment.parent_comment_id;
      if (
        parentId &&
        siblingIndex >= Math.max(0, siblings.length - 2) &&
        threadHasMore(parentId) &&
        !isThreadLoading(parentId) &&
        !threadErrors[parentId]
      ) {
        void loadMoreThreadReplies(parentId);
      } else if (
        !parentId &&
        threadHasMore(threadRootId) &&
        !isThreadLoading(threadRootId) &&
        !threadErrors[threadRootId]
      ) {
        void loadMoreThreadReplies(threadRootId);
      }
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

  const addCommentLike = async (comment: CommentItem) => {
    if (!currentUser?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { error } = await supabase.from('Like').insert({
      user_id: currentUser.id,
      comment_id: comment.id,
      post_text: comment.text || '',
    });
    if (error) console.error('Error liking comment:', error);
    else await refetchComments();
  };

  const removeCommentLike = async (comment: CommentItem) => {
    if (!currentUser?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { error } = await supabase
      .from('Like')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('comment_id', comment.id);
    if (error) console.error('Error unliking comment:', error);
    else await refetchComments();
  };

  const addCommentRepost = async (comment: CommentItem) => {
    if (!currentUser?.id) return;
    const { error } = await supabase.from('Repost').insert({
      id: Crypto.randomUUID(),
      user_id: currentUser.id,
      comment_id: comment.id,
      post_text: comment.text || '',
    });
    if (error) console.error('Error reposting comment:', error);
    else {
      // The Post carries the comment's content so it can render in the home feed
      const { error: postError } = await supabase.from('Post').insert({
        id: Crypto.randomUUID(),
        user_id: comment.speaker_id,
        text: comment.text,
        file: comment.file,
        repost_user_id: currentUser.id,
        source_comment_id: comment.id,
      });
      if (postError) console.error('Error creating comment repost post:', postError);
      await refetchComments();
    }
  };

  const removeCommentRepost = async (comment: CommentItem) => {
    if (!currentUser?.id) return;
    const { error } = await supabase
      .from('Repost')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('comment_id', comment.id);
    if (error) console.error('Error removing repost:', error);
    else {
      const { error: postError } = await supabase
        .from('Post')
        .delete()
        .eq('source_comment_id', comment.id)
        .eq('repost_user_id', currentUser.id);
      if (postError) console.error('Error removing comment repost post:', postError);
      await refetchComments();
    }
  };

  const handleCommentDebatePress = (commentId: string) => {
    setCollapsedCommentDebates((current) => ({
      ...current,
      [commentId]: !current[commentId],
    }));
  };

  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentPhoto, setNewCommentPhoto] = useState('');
  const [newCommentVideo, setNewCommentVideo] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showCommentTypeSelection, setShowCommentTypeSelection] = useState(false);
  const [pendingReplyTarget, setPendingReplyTarget] = useState<{ threadRootId: string; commentId: string } | null>(null);
  const [replyMode, setReplyMode] = useState<'comment' | 'debate'>('comment');
  const [replyingTo, setReplyingTo] = useState<{ threadRootId: string; commentId: string } | null>(null);
  const [replyingToDebate, setReplyingToDebate] = useState<{ rootCommentId: string; segmentId: string } | null>(null);
  const [activeThreadCommentIds, setActiveThreadCommentIds] = useState<Record<string, string>>({});
  const [threadScrollRequests, setThreadScrollRequests] = useState<Record<string, ThreadScrollRequest>>({});
  const [threadCarouselWidth, setThreadCarouselWidth] = useState(screenWidth);
  const newCommentInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const pendingThreadTargets = useRef<Record<string, string>>({});
  const lastThreadSlideIndices = useRef<Record<string, number>>({});
  const threadSlideWidth = threadCarouselWidth;

  const getThreadComments = useCallback((threadRootId: string) => {
    const threadIds = new Set([threadRootId]);
    let foundDescendant = true;

    while (foundDescendant) {
      foundDescendant = false;
      (comments ?? []).forEach((comment) => {
        if (comment.parent_comment_id && threadIds.has(comment.parent_comment_id) && !threadIds.has(comment.id)) {
          threadIds.add(comment.id);
          foundDescendant = true;
        }
      });
    }

    return (comments ?? []).filter((comment) => threadIds.has(comment.id));
  }, [comments]);

  const requestThreadScroll = useCallback((threadRootId: string, index: number) => {
    const threadComments = getThreadComments(threadRootId);
    if (!threadComments.length) return;
    const boundedIndex = Math.max(0, Math.min(index, threadComments.length - 1));
    const offset = boundedIndex * threadSlideWidth;
    if (__DEV__) {
      console.log('[thread-carousel-debug] request scroll', {
        threadRootId,
        index: boundedIndex,
        offset,
        width: threadSlideWidth,
        threadCommentIds: threadComments.map((comment) => comment.id),
      });
    }
    setThreadScrollRequests((requests) => ({
      ...requests,
      [threadRootId]: {
        index: boundedIndex,
        offset,
        token: (requests[threadRootId]?.token ?? 0) + 1,
      },
    }));
    setActiveThreadCommentIds((ids) => ({
      ...ids,
      [threadRootId]: threadComments[boundedIndex]?.id ?? threadRootId,
    }));
  }, [getThreadComments, threadSlideWidth]);
  //

  useEffect(() => {
    Object.entries(pendingThreadTargets.current).forEach(([threadRootId, targetCommentId]) => {
      const targetIndex = getThreadComments(threadRootId).findIndex((comment) => comment.id === targetCommentId);
      if (targetIndex < 0) return;

      delete pendingThreadTargets.current[threadRootId];
      requestThreadScroll(threadRootId, targetIndex);
      Haptics.selectionAsync();
    });
  }, [comments, getThreadComments, requestThreadScroll, threadSlideWidth]);

  const selectThreadReplyTarget = (threadRootId: string, targetCommentId: string) => {
    setPendingReplyTarget({ threadRootId, commentId: targetCommentId });
    setShowCommentTypeSelection(true);
    Haptics.selectionAsync();
  };

  const navigateToThreadComment = async (threadRootId: string, targetCommentId: string) => {
    const threadComments = getThreadComments(threadRootId);
    const targetIndex = threadComments.findIndex((comment) => comment.id === targetCommentId);
    if (__DEV__) {
      console.log('[thread-carousel-debug] reference pressed', {
        threadRootId,
        targetCommentId,
        targetIndex,
        width: threadSlideWidth,
        threadCommentIds: threadComments.map((comment) => comment.id),
      });
    }
    if (targetIndex >= 0) {
      requestThreadScroll(threadRootId, targetIndex);
      Haptics.selectionAsync();
      return;
    }

    pendingThreadTargets.current[threadRootId] = targetCommentId;
    try {
      await loadCommentPath(targetCommentId);
    } catch (error) {
      delete pendingThreadTargets.current[threadRootId];
      console.error('Error loading replied-to comment:', error);
      Alert.alert('Error', 'Could not load the comment being replied to.');
    }
  };

  const renderThreadCommentCard = (
    comment: CommentItem,
    threadRootId: string,
    isActive: boolean,
    onDebateReply?: (() => void) | null,
    referenceComment?: CommentItem,
  ) => {
    const isDebateComment = Boolean(referenceComment);
    const isCommentLiked = comment.likes?.some((like) => like.user_id === currentUser?.id);
    const isCommentReposted = comment.reposts?.some((repost: any) => repost.user_id === currentUser?.id);
    const replyTargetId = onDebateReply === undefined && !referenceComment
      ? comment.reply_to_comment_id ?? comment.parent_comment_id
      : null;
    const replyTarget = replyTargetId
      ? comments?.find((item) => item.id === replyTargetId)
      : null;
    const avatarUrl = comment.speaker?.avatar
      ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${comment.speaker.id}/${comment.speaker.avatar}`
      : null;

    return (
      <View style={[styles.commentSlideWrapper, { width: threadSlideWidth }]}>
        <View style={[styles.debateCard, styles.commentThreadCard]}>
          <View style={[styles.cardHeader, styles.threadCardHeader]}>
            <View style={styles.cardAuthorRow}>
              <View style={styles.commentAuthor}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.threadAvatar} />
                ) : (
                  <View style={styles.threadGrayAvatar}>
                    <Text style={styles.threadGrayAvatarText}>{comment.speaker?.username?.[0]?.toUpperCase() || '?'}</Text>
                  </View>
                )}
                <Text style={[styles.cardAuthorName, Platform.OS === 'web' && styles.webCardAuthorName]}>{comment.speaker?.username || 'Unknown'}</Text>
                <Text style={styles.commentTimestamp}>{timeAgo(comment.created_at)}</Text>
              </View>
            </View>
          </View>

          {referenceComment ? (
            <Pressable
              style={styles.commentReplyContext}
              onPress={() => void navigateToThreadComment(threadRootId, referenceComment.id)}
              accessibilityRole="button"
              accessibilityLabel={`Go to comment by ${referenceComment.speaker?.username || 'user'}`}
            >
              <Text style={styles.commentReplyAttribution}>
                {`Debating @${referenceComment.speaker?.username || 'user'}`}
              </Text>
              <Text
                style={[styles.commentReplyExcerpt, Platform.OS === 'web' && styles.webCommentReplyExcerpt]}
                numberOfLines={2}
              >
                {referenceComment.text || (referenceComment.file?.endsWith('.mp4') ? 'Video' : referenceComment.file ? 'Photo' : 'View comment')}
              </Text>
            </Pressable>
          ) : replyTargetId ? (
            <Pressable
              style={styles.commentReplyContext}
              onPress={() => void navigateToThreadComment(threadRootId, replyTargetId)}
              accessibilityRole="button"
              accessibilityLabel={`Go to comment by ${replyTarget?.speaker?.username || 'user'}`}
            >
              <Text style={styles.commentReplyAttribution}>
                Replying to @{replyTarget?.speaker?.username || 'user'}
              </Text>
              <Text
                style={[styles.commentReplyExcerpt, Platform.OS === 'web' && styles.webCommentReplyExcerpt]}
                numberOfLines={2}
              >
                {replyTarget?.text || (replyTarget?.file?.endsWith('.mp4') ? 'Video' : replyTarget?.file ? 'Photo' : 'View replied-to comment')}
              </Text>
            </Pressable>
          ) : null}
          <Text
            style={[
              styles.cardBodyText,
              styles.threadCardBody,
              Platform.OS === 'web' && styles.webCardBodyText,
            ]}
          >
            {comment.text || ''}
          </Text>
          {isActive && comment.file ? (
            comment.file.endsWith('.mp4') ? (
              <View style={styles.commentMedia}>
                <PostVideo
                  uri={`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${comment.speaker_id}/${comment.file}`}
                  isVisible={isActive}
                />
              </View>
            ) : (
              <Image
                source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${comment.speaker_id}/${comment.file}` }}
                style={styles.commentMedia}
                resizeMode="contain"
              />
            )
          ) : null}

          <View style={styles.threadCardFooter}>
            <View style={styles.threadCardActions}>
                {isDebateComment ? (
                  <Pressable
                    onPress={onDebateReply ?? undefined}
                    disabled={!onDebateReply}
                    style={[styles.postAction, !onDebateReply && styles.debateReplyDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel="Debate"
                  >
                    <Swords size={14} color="#fbbf24" />
                    <Text style={styles.postActionText}>Debate</Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable
                      onPress={() => (isCommentLiked ? removeCommentLike(comment) : addCommentLike(comment))}
                      style={styles.postAction}
                    >
                      <Heart size={14} color={isCommentLiked ? '#ef4444' : '#b0b0b0'} fill={isCommentLiked ? '#ef4444' : 'transparent'} />
                      {(comment.likes?.length ?? 0) > 0 ? <Text style={styles.postActionText}>{comment.likes!.length}</Text> : null}
                    </Pressable>
                    <Pressable
                      onPress={() => (isCommentReposted ? removeCommentRepost(comment) : addCommentRepost(comment))}
                      style={styles.postAction}
                    >
                      <Repeat size={14} color={isCommentReposted ? '#22d3ee' : '#b0b0b0'} />
                      {(comment.reposts?.length ?? 0) > 0 ? <Text style={styles.postActionText}>{comment.reposts!.length}</Text> : null}
                    </Pressable>
                    <Pressable
                      onPress={() => selectThreadReplyTarget(threadRootId, comment.id)}
                      style={styles.postAction}
                    >
                      <MessageCircle size={14} color="#b0b0b0" />
                      <Text style={styles.postActionText}>Reply</Text>
                    </Pressable>
                    {comment.is_debatable ? (
                      <Pressable onPress={() => handleCommentDebatePress(comment.id)} style={styles.postAction}>
                        <Swords size={14} color="#b0b0b0" />
                      </Pressable>
                    ) : null}
                  </>
                )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const pickNewCommentPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setNewCommentPhoto(result.assets[0].uri);
      setNewCommentVideo('');
    }
  };

  const pickNewCommentVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setNewCommentVideo(result.assets[0].uri);
      setNewCommentPhoto('');
    }
  };

  const createCommentDebate = async (mediaFilename: string | null) => {
    const targetComment = replyingTo
      ? comments?.find((comment) => comment.id === replyingTo.commentId)
      : null;

    if (!rootPost?.id || !currentUser?.id || !replyingTo || !targetComment) {
      Alert.alert('Cannot start debate', 'The comment being debated could not be found.');
      return;
    }

    if (targetComment.speaker_id === currentUser.id) {
      Alert.alert('Invalid action', 'You cannot debate your own comment.');
      return;
    }

    const debateId = Crypto.randomUUID();
    const { error: debateError } = await supabase.from('Debate').insert({
      id: debateId,
      root_post_id: null,
      root_comment_id: targetComment.id,
      challenger_id: currentUser.id,
      opponent_id: targetComment.speaker_id,
      challenger_text: newCommentText.trim(),
      status: 'open',
    });

    if (debateError) {
      console.error('Error creating comment-rooted debate:', debateError);
      Alert.alert('Error', 'Could not create a debate for this comment.');
      return;
    }

    const { data: segmentData, error: segmentError } = await supabase.from('DebateSegment').insert({
      id: Crypto.randomUUID(),
      debate_id: debateId,
      post_id: rootPost.id,
      speaker_id: currentUser.id,
      text: newCommentText.trim(),
      file: mediaFilename,
      side: 'challenger',
      round_number: 2,
    }).select('*, speaker:User!speaker_id(id,username,avatar)').single();

    if (segmentError) {
      console.error('Error creating initial comment debate segment:', segmentError);
      const { error: cleanupError } = await supabase.from('Debate').delete().eq('id', debateId);
      if (cleanupError) {
        console.error('Error cleaning up incomplete comment debate:', cleanupError);
      }
      Alert.alert('Error', 'The debate could not be started. Please try again.');
      return;
    }

    const { error: commentUpdateError } = await supabase
      .from('Comment')
      .update({ is_debatable: true })
      .eq('id', targetComment.id);
    if (commentUpdateError) {
      console.error('Error marking debate target comment as debatable:', commentUpdateError);
    } else {
      updateComment(targetComment.id, (comment) => ({ ...comment, is_debatable: true }));
    }

    setCommentDebates((current) => ({
      ...current,
      [targetComment.id]: {
        id: debateId,
        root_comment_id: targetComment.id,
        challenger_id: currentUser.id,
        opponent_id: targetComment.speaker_id,
        challenger: {
          id: currentUser.id,
          username: currentUser.username,
          avatar: currentUser.avatar,
        },
        opponent: targetComment.speaker,
        segments: [segmentData as unknown as InlineDebateSegment],
      },
    }));
    setCollapsedCommentDebates((current) => ({ ...current, [targetComment.id]: false }));
    setNewCommentText('');
    setNewCommentPhoto('');
    setNewCommentVideo('');
    setReplyingTo(null);
    setReplyMode('comment');
  };

  const submitCommentDebateResponse = async (
    commentDebate: InlineCommentDebate,
    text: string,
    mediaFilename: string | null,
  ) => {
    if (!rootPost?.id || !currentUser?.id) {
      throw new Error('Sign in to respond to this debate.');
    }

    const lastSegment = commentDebate.segments[commentDebate.segments.length - 1];
    const nextSpeakerId = !lastSegment
      ? commentDebate.challenger_id
      : lastSegment.side === 'challenger'
        ? commentDebate.opponent_id
        : commentDebate.challenger_id;
    if (currentUser.id !== nextSpeakerId) {
      throw new Error('It is not your turn in this debate.');
    }

    const side = currentUser.id === commentDebate.challenger_id ? 'challenger' : 'root';
    const { data: segment, error } = await supabase.from('DebateSegment').insert({
      id: Crypto.randomUUID(),
      debate_id: commentDebate.id,
      post_id: rootPost.id,
      speaker_id: currentUser.id,
      text,
      file: mediaFilename,
      side,
      round_number: commentDebate.segments.length + 2,
    }).select('*, speaker:User!speaker_id(id,username,avatar)').single();

    if (error) {
      console.error('Error creating comment debate response:', error);
      throw new Error('Could not post your debate response.');
    }

    setCommentDebates((current) => {
      const existing = current[commentDebate.root_comment_id] ?? commentDebate;
      return {
        ...current,
        [commentDebate.root_comment_id]: {
          ...existing,
          segments: [...existing.segments, segment as unknown as InlineDebateSegment],
        },
      };
    });
  };

  const submitNewComment = async (isDebatable: boolean) => {
    if (!rootPost?.id || !currentUser?.id) {
      Alert.alert('Sign in required', 'Please log in to comment or reply.');
      return;
    }
    if (!newCommentText.trim() && !newCommentPhoto && !newCommentVideo) return;
    if (isDebatable && replyingTo) {
      const targetComment = comments?.find((comment) => comment.id === replyingTo.commentId);
      if (!targetComment) {
        Alert.alert('Cannot start debate', 'The comment being debated could not be found.');
        return;
      }
      if (targetComment.speaker_id === currentUser.id) {
        Alert.alert('Invalid action', 'You cannot debate your own comment.');
        return;
      }
    }

    try {
      setIsSubmittingComment(true);
      let mediaFilename: string | null = null;

      if (newCommentPhoto) {
        mediaFilename = await uploadFile(currentUser.id, newCommentPhoto, 'image/jpeg', createCommentMediaFilename('jpg'));
      } else if (newCommentVideo) {
        mediaFilename = await uploadFile(currentUser.id, newCommentVideo, 'video/mp4', createCommentMediaFilename('mp4'));
      }

      if (replyingToDebate) {
        const commentDebate = commentDebates[replyingToDebate.rootCommentId];
        if (!commentDebate) {
          Alert.alert('Cannot reply', 'This debate is no longer available.');
          return;
        }
        await submitCommentDebateResponse(commentDebate, newCommentText.trim(), mediaFilename);
        setNewCommentText('');
        setNewCommentPhoto('');
        setNewCommentVideo('');
        setReplyingToDebate(null);
        setReplyMode('comment');
        return;
      }

      if (isDebatable && replyingTo) {
        await createCommentDebate(mediaFilename);
        return;
      }

      const { data, error } = await supabase.from('Comment').insert({
        id: Crypto.randomUUID(),
        post_id: rootPost.id,
        parent_comment_id: replyingTo?.threadRootId ?? null,
        reply_to_comment_id: replyingTo?.commentId ?? null,
        speaker_id: currentUser.id,
        text: newCommentText.trim(),
        file: mediaFilename,
        is_debatable: isDebatable,
      }).select('*, speaker:User!speaker_id(id,username,avatar), likes:Like(user_id), reposts:Repost(user_id)').single();

      if (error) {
        console.error('Error posting comment:', error);
        Alert.alert('Error', 'Could not post your comment.');
        return;
      }

      setNewCommentText('');
      setNewCommentPhoto('');
      setNewCommentVideo('');
      setReplyingTo(null);
      setReplyMode('comment');
      addComment(data as unknown as CommentItem);
    } catch (error) {
      console.error('Error submitting comment:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not submit your comment.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const isNewCommentDisabled =
    (!newCommentText.trim() && !newCommentPhoto && !newCommentVideo) || isSubmittingComment;

  const handleNewCommentTypeSelection = () => {
    if (isNewCommentDisabled) return;
    setShowCommentTypeSelection(true);
  };

  const chooseCommentType = (isDebatable: boolean) => {
    setShowCommentTypeSelection(false);
    if (pendingReplyTarget) {
      setReplyingTo(pendingReplyTarget);
      setReplyingToDebate(null);
      setPendingReplyTarget(null);
      setReplyMode(isDebatable ? 'debate' : 'comment');
      requestAnimationFrame(() => newCommentInputRef.current?.focus());
      return;
    }

    void submitNewComment(isDebatable);
  };

  const handleComposerSubmit = () => {
    if (isNewCommentDisabled) return;
    if (replyingTo || replyingToDebate) {
      void submitNewComment(replyMode === 'debate');
      return;
    }
    handleNewCommentTypeSelection();
  };

  const replyingToComment = replyingTo
    ? comments.find((comment) => comment.id === replyingTo.commentId)
    : null;
  const replyingToDebateSegment = replyingToDebate
    ? commentDebates[replyingToDebate.rootCommentId]?.segments.find(
        (segment) => segment.id === replyingToDebate.segmentId
      )
    : null;

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
    <View style={[styles.screen, Platform.OS === 'web' && styles.webColumn]}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {/* Top Header */}
          <View style={styles.topHeader}>
            <Pressable onPress={() => router.back()} style={styles.headerBackButton} hitSlop={12}>
              <ArrowLeft size={18} color="#fff" />
            </Pressable>

            <Text style={styles.topHeaderTitle}>Debate</Text>

            <View style={{ width: 36 }} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22c55e" />
            </View>
          ) : (
            <>
            <ScrollView
              ref={mainScrollRef}
              contentContainerStyle={styles.mainScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={() => Keyboard.dismiss()}
              onScroll={handleMainScroll}
              scrollEventThrottle={250}
              refreshControl={(
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#22d3ee"
                  colors={['#22d3ee']}
                />
              )}
            >
              {/* Carousel Section (Horizontal swipeable opinion cards) */}
              <View style={styles.carouselContainer}>
                {debateTargetComment ? (
                  <View style={styles.debateTargetCard}>
                    <View style={styles.debateTargetHeading}>
                      <Swords size={13} color="#fbbf24" />
                      <Text style={styles.debateTargetLabel}>DEBATING THIS COMMENT</Text>
                    </View>
                    <Text style={styles.debateTargetAuthor}>
                      @{debateTargetComment.speaker?.username || 'user'}
                    </Text>
                    {debateTargetComment.text ? (
                      <Text style={styles.debateTargetText}>{debateTargetComment.text}</Text>
                    ) : null}
                    {debateTargetComment.file ? (
                      debateTargetComment.file.endsWith('.mp4') ? (
                        <View style={styles.debateTargetMedia}>
                          <PostVideo
                            uri={`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${debateTargetComment.speaker_id}/${debateTargetComment.file}`}
                            isVisible={activeIndex === 0}
                          />
                        </View>
                      ) : (
                        <Image
                          source={{
                            uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${debateTargetComment.speaker_id}/${debateTargetComment.file}`,
                          }}
                          style={styles.debateTargetMedia}
                          resizeMode="cover"
                        />
                      )
                    ) : null}
                  </View>
                ) : null}
                <ScrollView
                  ref={scrollRef}
                  horizontal
                  pagingEnabled
                  contentContainerStyle={Platform.OS === 'web' ? styles.webDebateCarouselContent : undefined}
                  showsHorizontalScrollIndicator={false}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  decelerationRate="fast"
                  snapToInterval={screenWidth}
                  snapToAlignment="center"
                  style={[
                    styles.horizontalScrollView,
                    { width: screenWidth },
                    Platform.OS === 'web' && styles.webDebateCarousel,
                  ]}
                >
                  {/* Render existing exchanges */}
                  {exchanges.map((item, index) => {
                    const isOpCard = item.side === 'root';
                    return (
                      <View key={item.id} style={[styles.cardWrapper, { width: screenWidth }, Platform.OS === 'web' && styles.webCardWrapper]}>
                        <View
                          style={[
                            styles.debateCard,
                            Platform.OS === 'web' && styles.webDebateCard,
                            isOpCard ? styles.opCardBorder : styles.challengerCardBorder,
                          ]}
                        >
                          {Platform.OS !== 'web' ? (
                            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                          ) : null}
                          <LinearGradient
                            colors={['rgba(255, 255, 255, 0.03)', 'rgba(0, 0, 0, 0.3)']}
                            style={StyleSheet.absoluteFill}
                            pointerEvents="none"
                          />

                          {/* Author info */}
                          <View style={styles.cardHeader}>
                            <View style={styles.cardAuthorRow}>
                              <Text style={[styles.cardAuthorName, Platform.OS === 'web' && styles.webCardAuthorName]}>{item.speakerName}</Text>
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
                          <Text style={[styles.cardBodyText, Platform.OS === 'web' && styles.webCardBodyText]}>{item.text}</Text>

                          {/* Optional Media */}
                          {item.file ? (
                            item.file.endsWith('.mp4') ? (
                              <View style={[styles.cardMediaContainer, Platform.OS === 'web' && styles.webCardMedia]}>
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
                                style={[styles.cardMediaImage, Platform.OS === 'web' && styles.webCardMedia]}
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
                    <View style={[styles.cardWrapper, { width: screenWidth }, Platform.OS === 'web' && styles.webCardWrapper]}>
                      <View style={[styles.debateCard, Platform.OS === 'web' && styles.webDebateCard, styles.inputCardBorder]}>
                        {Platform.OS !== 'web' ? (
                          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
                        ) : null}
                        <LinearGradient
                          colors={['rgba(34, 211, 238, 0.05)', 'rgba(0, 0, 0, 0.4)']}
                          style={StyleSheet.absoluteFill}
                          pointerEvents="none"
                        />

                        {/* Header for next turn */}
                        <View style={styles.cardHeader}>
                          <View style={styles.cardAuthorRow}>
                            <Text style={[styles.cardAuthorName, Platform.OS === 'web' && styles.webCardAuthorName]}>Your Counter-Opinion</Text>
                            <View style={styles.cardSideTagActive}>
                              <Text style={styles.cardSideTagActiveText}>NEXT ROUND</Text>
                            </View>
                          </View>
                        </View>

                        <View style={[styles.inputCardBody, Platform.OS === 'web' && styles.webInputCardBody]}>
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
                                <X size={13} color="#fff" />
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
                                <X size={13} color="#fff" />
                              </Pressable>
                            </View>
                          ) : null}

                          {/* Actions row inside input slide */}
                          <View style={styles.inputCardActions}>
                            <View style={styles.inputMediaButtons}>
                              <Pressable onPress={handlePickPhoto} style={styles.mediaActionBtn}>
                                <ImageIcon size={16} color="#94a3b8" />
                              </Pressable>
                              <Pressable onPress={handlePickVideo} style={styles.mediaActionBtn}>
                                <VideoIcon size={16} color="#94a3b8" />
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
                                  <Send size={13} color="#fff" />
                                </>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </ScrollView>

                {Platform.OS === 'web' && totalSlides > 1 ? (
                  <View pointerEvents="box-none" style={styles.webCarouselArrows}>
                    <Pressable
                      onPress={() => scrollToSlide(activeIndex - 1)}
                      disabled={activeIndex <= 0}
                      accessibilityRole="button"
                      accessibilityLabel="Previous debate card"
                      style={[styles.webCarouselArrow, styles.webCarouselArrowLeft, activeIndex <= 0 && styles.webCarouselArrowDisabled]}
                    >
                      <ChevronLeft size={18} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={() => scrollToSlide(activeIndex + 1)}
                      disabled={activeIndex >= totalSlides - 1}
                      accessibilityRole="button"
                      accessibilityLabel="Next debate card"
                      style={[styles.webCarouselArrow, styles.webCarouselArrowRight, activeIndex >= totalSlides - 1 && styles.webCarouselArrowDisabled]}
                    >
                      <ChevronRight size={18} color="#fff" />
                    </Pressable>
                  </View>
                ) : null}

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
                            isActive && styles.dotActive,
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
                    size={18}
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
                  <MessageCircle size={18} color="#b0b0b0" />
                  {commentsCount > 0 ? (
                    <Text style={styles.postActionText}>{commentsCount}</Text>
                  ) : null}
                </Pressable>
                <Pressable onPress={handleToggleRepost} style={styles.postAction}>
                  <Repeat size={18} color={isReposted ? '#22d3ee' : '#b0b0b0'} />
                  {repostCount > 0 ? (
                    <Text style={styles.postActionText}>{repostCount}</Text>
                  ) : null}
                </Pressable>
              </View>

              {/* Debate Separator Line extending edge-to-edge */}
              <View style={styles.fullWidthDivider} />

              {/* Comments Section */}
              <View style={styles.commentsContainer}>
                {!(comments ?? []).some((comment) => !comment.parent_comment_id) ? (
                  <Text style={styles.noCommentsText}>No comments yet.</Text>
                ) : (
                  (comments ?? []).filter((comment) => !comment.parent_comment_id).map((comment) => {
                    const threadComments = getThreadComments(comment.id);
                    const activeThreadCommentId = activeThreadCommentIds[comment.id];
                    const activeThreadIndex = Math.max(
                      0,
                      threadComments.findIndex((item) => item.id === activeThreadCommentId)
                    );
                    const webWindowStart = Math.max(0, activeThreadIndex - 1);
                    const webWindowEnd = Math.min(threadComments.length, activeThreadIndex + 2);

                    return (
                      <View key={comment.id} style={styles.commentThread}>
                        <View
                          style={styles.commentCarouselViewport}
                          onLayout={(event) => {
                            const width = event.nativeEvent.layout.width;
                            if (width > 0 && width !== threadCarouselWidth) setThreadCarouselWidth(width);
                          }}
                        >
                          <CommentThreadScroller
                            width={threadSlideWidth}
                            items={threadComments}
                            slideCount={threadComments.length}
                            request={threadScrollRequests[comment.id]}
                            debugThreadRootId={comment.id}
                            renderItem={({ item }) => renderThreadCommentCard(
                              item,
                              comment.id,
                              activeThreadCommentId
                                ? activeThreadCommentId === item.id
                                : item.id === comment.id
                            )}
                            onLayout={(event) => {
                              const activeIndex = Math.max(
                                0,
                                threadComments.findIndex((item) => item.id === activeThreadCommentId)
                              );
                              prefetchNextThreadImage(threadComments, activeIndex);
                              if (
                                threadComments.length === 1 &&
                                threadHasMore(comment.id) &&
                                !isThreadLoading(comment.id) &&
                                !threadErrors[comment.id]
                              ) {
                                void loadMoreThreadReplies(comment.id, true);
                              }
                            }}
                            onMomentumScrollEnd={(event) => {
                              const offset = event.nativeEvent.contentOffset.x;
                              const index = Math.round(offset / threadSlideWidth);
                              if (__DEV__) {
                                console.log('[thread-carousel-debug] momentum scroll end', {
                                  threadRootId: comment.id,
                                  offset,
                                  index,
                                  width: threadSlideWidth,
                                  threadCommentIds: threadComments.map((item) => item.id),
                                });
                              }
                              handleThreadCarouselPageChange(comment.id, threadComments, index);
                            }}
                          >
                            {Platform.OS === 'web' ? (
                              <>
                                {webWindowStart > 0 ? (
                                  <View style={{ width: webWindowStart * threadSlideWidth }} />
                                ) : null}
                                {threadComments.slice(webWindowStart, webWindowEnd).map((item) => (
                                  <Fragment key={item.id}>
                                    {renderThreadCommentCard(
                                      item,
                                      comment.id,
                                      activeThreadCommentId
                                        ? activeThreadCommentId === item.id
                                        : item.id === comment.id
                                    )}
                                  </Fragment>
                                ))}
                              </>
                            ) : null}
                          </CommentThreadScroller>
                          {Platform.OS === 'web' && threadComments.length > 1 ? (
                            <View pointerEvents="box-none" style={styles.webCarouselArrows}>
                              <Pressable
                                onPress={() => stepThreadSlide(comment.id, -1, threadComments.length)}
                                disabled={activeThreadIndex <= 0}
                                accessibilityRole="button"
                                accessibilityLabel="Previous comment"
                                style={[styles.webCarouselArrow, styles.webCarouselArrowLeft, activeThreadIndex <= 0 && styles.webCarouselArrowDisabled]}
                              >
                                <ChevronLeft size={16} color="#fff" />
                              </Pressable>
                              <Pressable
                                onPress={() => stepThreadSlide(comment.id, 1, threadComments.length)}
                                disabled={activeThreadIndex >= threadComments.length - 1}
                                accessibilityRole="button"
                                accessibilityLabel="Next comment"
                                style={[styles.webCarouselArrow, styles.webCarouselArrowRight, activeThreadIndex >= threadComments.length - 1 && styles.webCarouselArrowDisabled]}
                              >
                                <ChevronRight size={16} color="#fff" />
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.threadPagination}>
                          {Array.from({ length: threadComments.length }).map((_, index) => (
                            <View
                              key={index}
                              style={[
                                styles.threadDot,
                                index === activeThreadIndex && styles.threadDotActive,
                              ]}
                            />
                          ))}
                        </View>
                        {threadComments.map((threadComment) => {
                          const commentDebate = commentDebates[threadComment.id];
                          if (!commentDebate || collapsedCommentDebates[threadComment.id]) return null;
                          const debateComments: CommentItem[] = commentDebate.segments.map((segment) => ({
                            id: segment.id,
                            post_id: rootPost?.id ?? '',
                            speaker_id: segment.speaker_id,
                            text: segment.text,
                            file: segment.file,
                            parent_comment_id: null,
                            reply_to_comment_id: null,
                            is_debatable: false,
                            created_at: segment.created_at,
                            speaker: segment.speaker as User | undefined,
                            likes: [],
                            reposts: [],
                          }));
                          const lastDebateSegment = commentDebate.segments[commentDebate.segments.length - 1];
                          const nextDebateSpeakerId = !lastDebateSegment
                            ? commentDebate.challenger_id
                            : lastDebateSegment.side === 'challenger'
                              ? commentDebate.opponent_id
                              : commentDebate.challenger_id;
                          const canReplyToDebate = Boolean(
                            currentUser?.id &&
                            (currentUser.id === commentDebate.challenger_id ||
                              currentUser.id === commentDebate.opponent_id) &&
                            currentUser.id === nextDebateSpeakerId
                          );

                          return (
                            <CommentDebateSection
                              key={commentDebate.id}
                              targetComment={threadComment}
                              width={threadSlideWidth}
                              comments={debateComments}
                              renderComment={(debateComment, referenceComment, isActive) => renderThreadCommentCard(
                                debateComment,
                                comment.id,
                                isActive,
                                canReplyToDebate && debateComment.id === lastDebateSegment?.id
                                  ? () => {
                                      setReplyingTo(null);
                                      setReplyingToDebate({
                                        rootCommentId: threadComment.id,
                                        segmentId: debateComment.id,
                                      });
                                      setReplyMode('comment');
                                      requestAnimationFrame(() => newCommentInputRef.current?.focus());
                                    }
                                  : null,
                                referenceComment
                              )}
                            />
                          );
                        })}
                        <View style={styles.commentDivider} />
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>

            {/* Add a comment - pinned to the bottom, always visible while scrolling */}
            <View style={styles.newCommentBox}>
              <View style={styles.newCommentComposer}>
                {currentUser?.avatar ? (
                  <Image
                    source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${currentUser.id}/${currentUser.avatar}` }}
                    style={styles.newCommentAvatar}
                  />
                ) : (
                  <View style={styles.newCommentGrayAvatar}>
                    <Text style={styles.grayCircleText}>
                      {currentUser?.username?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.newCommentContent}>
                  {replyingTo || replyingToDebate ? (
                    <View style={styles.newCommentReplyingRow}>
                      <Text style={styles.newCommentReplyingText}>
                        {replyingToDebate
                          ? `Responding in debate with @${replyingToDebateSegment?.speaker?.username || 'user'}`
                          : `Replying to @${replyingToComment?.speaker?.username || 'user'}`}
                      </Text>
                      <Pressable
                        onPress={() => {
                          setReplyingTo(null);
                          setReplyingToDebate(null);
                          setReplyMode('comment');
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel reply"
                      >
                        <X size={14} color="#71767b" />
                      </Pressable>
                    </View>
                  ) : null}
                  {newCommentPhoto ? (
                    <Image source={{ uri: newCommentPhoto }} style={styles.newCommentPreview} />
                  ) : null}
                  <TextInput
                    ref={newCommentInputRef}
                    style={styles.newCommentInput}
                    placeholder={
                      replyingToDebate
                        ? 'Write your debate response...'
                        : replyingTo
                        ? replyMode === 'debate'
                          ? 'Write your opening argument...'
                          : 'Write a reply...'
                        : 'Write a comment...'
                    }
                    placeholderTextColor="#71767b"
                    multiline
                    value={newCommentText}
                    onChangeText={setNewCommentText}
                  />
                  <View style={styles.newCommentFooter}>
                    <Pressable onPress={pickNewCommentPhoto} accessibilityRole="button" accessibilityLabel="Add photo">
                      <ImageIcon size={16} color="#b0b0b0" />
                    </Pressable>
                    <Pressable onPress={pickNewCommentVideo} accessibilityRole="button" accessibilityLabel="Add video">
                      <VideoIcon size={16} color="#b0b0b0" />
                    </Pressable>
                    <Pressable
                      onPress={handleComposerSubmit}
                      disabled={isNewCommentDisabled}
                      style={[styles.newCommentSubmit, { opacity: isNewCommentDisabled ? 0.5 : 1 }]}
                    >
                      <Text style={styles.newCommentSubmitText}>
                        {isSubmittingComment
                          ? replyingToDebate
                            ? 'Responding...'
                            : replyMode === 'debate' ? 'Starting...' : 'Posting...'
                          : replyingToDebate
                            ? 'Respond'
                            : replyingTo
                            ? replyMode === 'debate' ? 'Start debate' : 'Reply'
                            : 'Post'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
            <Modal
              transparent
              animationType="fade"
              visible={showCommentTypeSelection}
              onRequestClose={() => setShowCommentTypeSelection(false)}
              statusBarTranslucent
            >
              <View style={styles.commentTypeModalBackdrop}>
                <View style={styles.commentTypeModal}>
                  <Text style={styles.commentTypeTitle}>
                    {pendingReplyTarget || replyingTo ? 'Reply type' : 'Comment type'}
                  </Text>
                  <Text style={styles.commentTypeDescription}>
                    {pendingReplyTarget || replyingTo
                      ? 'Post a reply or start a debate from this comment?'
                      : 'Post a comment or start a debate from this post?'}
                  </Text>
                  <Pressable
                    onPress={() => chooseCommentType(false)}
                    style={styles.commentTypeOption}
                    accessibilityRole="button"
                  >
                    <MessageCircle size={16} color="#22d3ee" />
                    <Text style={styles.commentTypeOptionText}>
                      {pendingReplyTarget || replyingTo ? 'Post reply' : 'Post comment'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => chooseCommentType(true)}
                    style={styles.commentTypeOption}
                    accessibilityRole="button"
                  >
                    <Swords size={16} color="#fbbf24" />
                    <Text style={styles.commentTypeOptionText}>Start debate</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowCommentTypeSelection(false)}
                    style={styles.commentTypeCancel}
                    accessibilityRole="button"
                  >
                    <Text style={styles.commentTypeCancelText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = createCompactStyleSheet({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  webColumn: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    marginTop: 64,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    position: 'relative',
  },
  debateTargetCard: {
    width: '90%',
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
  },
  debateTargetHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  debateTargetLabel: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  debateTargetAuthor: {
    color: '#d4d4d4',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  debateTargetText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  debateTargetMedia: {
    width: '100%',
    height: 180,
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  horizontalScrollView: {
    width: '100%',
  },
  webDebateCarouselContent: {
    alignItems: 'flex-start',
  },
  webDebateCarousel: {
    flexGrow: 0,
  },
  cardWrapper: {
    width: '100%',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webCardWrapper: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
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
  webDebateCard: {
    minHeight: 0,
    padding: 12,
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    flexGrow: 0,
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
  webCardBodyText: {
    color: '#fff',
    fontSize: 12.5,
    lineHeight: 1.36,
    marginBottom: 2,
  },
  webCardAuthorName: {
    fontSize: 13,
    fontWeight: '500',
  },
  webCommentReplyExcerpt: {
    fontSize: 12.5,
    lineHeight: 1.35,
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
  webCardMedia: {
    height: 110,
    marginBottom: 6,
  },
  webInputCardBody: {
    flex: 0,
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
  webCarouselArrows: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
  },
  webCarouselArrow: {
    position: 'absolute',
    top: '50%',
    width: 34,
    height: 34,
    marginTop: -17,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(24, 24, 24, 0.92)',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    zIndex: 2,
  },
  webCarouselArrowLeft: {
    left: 6,
  },
  webCarouselArrowRight: {
    right: 6,
  },
  webCarouselArrowDisabled: {
    opacity: 0.35,
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
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#454545',
  },
  dotActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.65)',
  },
  fullWidthDivider: {
    height: 1,
    backgroundColor: '#222222',
    marginTop: 12,
    width: '100%',
  },
  commentsContainer: {
    paddingTop: 13,
    paddingBottom: 24,
  },
  commentThread: {
    marginBottom: 8,
    position: 'relative',
  },
  commentDebateSection: {
    marginTop: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  debateDivider: {
    marginBottom: 12,
  },
  commentCarouselViewport: {
    width: '100%',
    position: 'relative',
  },
  commentSlideWrapper: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  commentThreadCard: {
    width: '90%',
    alignSelf: 'center',
    minHeight: 0,
    justifyContent: 'flex-start',
    padding: 9,
  },
  commentAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentTimestamp: {
    color: '#888888',
    fontSize: 11,
  },
  commentReplyAttribution: {
    color: '#22d3ee',
    fontSize: 11,
    fontWeight: '600',
  },
  commentReplyContext: {
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(34, 211, 238, 0.6)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingLeft: 8,
    paddingVertical: 5,
    paddingRight: 6,
    marginBottom: 7,
  },
  commentReplyExcerpt: {
    color: '#9ca3af',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  threadAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  threadGrayAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadGrayAvatarText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  threadCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  threadCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  debateReplyDisabled: {
    opacity: 0.4,
  },
  threadPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    minHeight: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  threadDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#454545',
  },
  threadDotActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.65)',
  },
  threadCardHeader: {
    marginBottom: 3,
  },
  threadCardBody: {
    marginBottom: 2,
  },
  threadMediaContainer: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 4,
  },
  threadMediaImage: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    marginBottom: 4,
  },
  commentMedia: {
    width: '100%',
    height: 42,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 0,
  },
  noCommentsText: {
    color: '#71767b',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
  },
  newCommentBox: {
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  commentTypeModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  commentTypeModal: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#181818',
  },
  commentTypeTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  commentTypeDescription: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 16,
  },
  commentTypeOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#222',
    marginTop: 8,
  },
  commentTypeOptionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  commentTypeCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  commentTypeCancelText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '600',
  },
  newCommentComposer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#181818',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#303030',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  newCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    marginTop: 3,
  },
  newCommentGrayAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 3,
  },
  newCommentContent: { flex: 1, minWidth: 0 },
  newCommentReplyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 22,
    marginBottom: 3,
  },
  newCommentReplyingText: {
    color: '#858b94',
    fontSize: 12,
    fontWeight: '500',
  },
  newCommentPreview: { width: 90, height: 90, borderRadius: 10, marginBottom: 8 },
  newCommentInput: {
    color: 'white',
    fontSize: 14,
    minHeight: 36,
    maxHeight: 100,
    paddingVertical: 7,
    textAlignVertical: 'top',
  },
  newCommentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  commentDivider: {
    height: 1,
    backgroundColor: '#222',
    marginTop: 8,
    width: '100%',
    alignSelf: 'center',
  },
  newCommentSubmit: {
    marginLeft: 'auto',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  newCommentSubmitText: { color: '#0f0f0f', fontWeight: '600', fontSize: 13 },
  postCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0f0f0f',
    borderRadius: 18,
    marginHorizontal: 10,
    marginTop: 10,
    padding: 10,
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
  postText: {
    color: '#fff',
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 5,
  },
  likeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeCount: {
    color: '#b0b0b0',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 1,
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
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 24,
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
});