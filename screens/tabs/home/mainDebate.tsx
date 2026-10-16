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
import { Fragment, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  ViewToken,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

function toExchangeItem(segment: any, debate: any, post: any): ExchangeItem {
  const speaker =
    segment.speaker_id === debate?.challenger_id
      ? debate.challenger
      : segment.speaker_id === debate?.opponent_id
        ? debate.opponent
        : segment.speaker_id === post?.user_id
          ? post.user
          : null;

  return {
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
  };
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

type ThreadScrollRequest = {
  token: number;
  offset?: number;
};

const COMMENT_VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 10 };
const MAX_VISIBLE_CAROUSEL_DOTS = 7;
const CAROUSEL_DOT_SLOT_SIZE = 14;

function getVisibleCarouselDotIndices(totalCount: number, windowAnchorIndex: number) {
  const visibleCount = Math.min(totalCount, MAX_VISIBLE_CAROUSEL_DOTS);
  const maxStartIndex = Math.max(0, totalCount - visibleCount);
  const startIndex = Math.max(0, Math.min(windowAnchorIndex - Math.floor(visibleCount / 2), maxStartIndex));
  return Array.from({ length: visibleCount }, (_, index) => startIndex + index);
}

function CarouselPagination({
  totalCount,
  activeIndex,
  progressValue,
  progressWidth,
  windowAnchorIndex,
  onDotPress,
  accessibilityLabel,
}: {
  totalCount: number;
  activeIndex: number;
  progressValue?: Animated.Value;
  progressWidth?: number;
  windowAnchorIndex?: number;
  onDotPress?: (index: number) => void;
  accessibilityLabel?: string;
}) {
  const [localProgressValue] = useState(() => new Animated.Value(activeIndex));
  const progress = progressValue
    ? Animated.divide(progressValue, progressWidth ?? 1)
    : localProgressValue;

  const indices = getVisibleCarouselDotIndices(totalCount, windowAnchorIndex ?? activeIndex);
  const centerPosition = Math.floor(indices.length / 2);
  const startIndex = indices[0] ?? 0;
  const translateX = Animated.multiply(
    Animated.add(progress, -(startIndex + centerPosition)),
    -CAROUSEL_DOT_SLOT_SIZE
  );

  return (
    <View
      style={[
        styles.dotsIndicatorViewport,
        { width: indices.length * CAROUSEL_DOT_SLOT_SIZE },
      ]}
    >
      <Animated.View
        style={[
          styles.dotsIndicatorContainer,
          { transform: [{ translateX }] },
        ]}
      >
        {indices.map((index) => {
          const dotScale = progress.interpolate({
            inputRange: [index - 2, index - 1, index, index + 1, index + 2],
            outputRange: [0.25, 0.625, 1, 0.625, 0.25],
            extrapolate: 'clamp',
          });
          const dotColor = progress.interpolate({
            inputRange: [index - 0.65, index, index + 0.65],
            outputRange: ['#454545', 'rgba(34, 211, 238, 0.65)', '#454545'],
            extrapolate: 'clamp',
          });
          const dot = (
            <Animated.View
              style={[
                styles.dot,
                {
                  backgroundColor: dotColor,
                  transform: [{ scale: dotScale }],
                },
              ]}
            />
          );

          return onDotPress ? (
            <Pressable
              key={index}
              onPress={() => onDotPress(index)}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel ? `${accessibilityLabel} ${index + 1}` : undefined}
            >
              <View style={styles.dotsIndicatorSlot}>{dot}</View>
            </Pressable>
          ) : (
            <View key={index} style={styles.dotsIndicatorSlot}>{dot}</View>
          );
        })}
      </Animated.View>
    </View>
  );
}

function CommentThreadScroller({
  width,
  slideCount,
  request,
  initialOffset,
  dotScrollOffset,
  onLayout,
  onScroll,
  children,
}: {
  width: number;
  slideCount: number;
  request?: ThreadScrollRequest;
  initialOffset: number;
  dotScrollOffset: Animated.Value;
  onLayout: (event: LayoutChangeEvent) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  children: ReactNode;
}) {
  const [translateX] = useState(() => new Animated.Value(0));
  const nativeScrollRef = useRef<ScrollView>(null);
  const activeIndexRef = useRef(width > 0 ? Math.round(initialOffset / width) : 0);

  useEffect(() => {
    if (request?.offset === undefined || !width) return;
    const nextIndex = Math.max(0, Math.min(Math.round(request.offset / width), slideCount - 1));
    activeIndexRef.current = nextIndex;
    if (Platform.OS !== 'web') {
      nativeScrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      return;
    }
    Animated.timing(translateX, {
      toValue: -nextIndex * width,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [request?.token, request?.offset, slideCount, translateX, width]);

  useEffect(() => {
    if (Platform.OS === 'web' || !width) return;
    nativeScrollRef.current?.scrollTo({
      x: activeIndexRef.current * width,
      animated: false,
    });
  }, [width]);

  const handleNativeScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    activeIndexRef.current = width > 0
      ? Math.round(event.nativeEvent.contentOffset.x / width)
      : 0;
    onScroll(event);
  };

  const handleNativeMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    const nearestIndex = Math.max(0, Math.min(Math.round(offsetX / width), slideCount - 1));
    const targetOffset = nearestIndex * width;
    activeIndexRef.current = nearestIndex;
    onScroll(event);
    if (Math.abs(offsetX - targetOffset) > 1) {
      nativeScrollRef.current?.scrollTo({ x: targetOffset, animated: true });
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.threadCarouselViewport} onLayout={onLayout}>
        <View style={{ width, overflow: 'hidden' }}>
          <Animated.View style={{ flexDirection: 'row', flexGrow: 0, flexShrink: 0, transform: [{ translateX }] }}>
            {children}
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.threadCarouselViewport}>
      <ScrollView
        ref={nativeScrollRef}
        horizontal
        style={{ width: '100%', flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ alignItems: 'flex-start' }}
        contentInsetAdjustmentBehavior="never"
        contentInset={{ left: 0, right: 0 }}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={width}
        snapToAlignment="center"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onLayout={onLayout}
        onScroll={handleNativeScroll}
        onMomentumScrollEnd={handleNativeMomentumScrollEnd}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export default function MainDebateScreen() {
  const { postId, debateId } = useLocalSearchParams<{ postId?: string; debateId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const currentUser = user as any;
  const currentUserId = currentUser?.id;
  const { uploadFile } = useUploadFile();
  const { width: windowWidth } = useWindowDimensions();
  const screenWidth = Platform.OS === 'web' ? Math.min(windowWidth, 500) : windowWidth;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rootPost, setRootPost] = useState<Post | null>(null);
  const [debate, setDebate] = useState<any | null>(null);
  const [exchanges, setExchanges] = useState<ExchangeItem[]>([]);
  const [latestExchange, setLatestExchange] = useState<ExchangeItem | null>(null);
  const [hasMoreSegments, setHasMoreSegments] = useState(false);
  const [isLoadingMoreSegments, setIsLoadingMoreSegments] = useState(false);
  const [segmentLoadError, setSegmentLoadError] = useState<string | null>(null);
  const [latestSegmentLoadError, setLatestSegmentLoadError] = useState(false);
  const segmentCursor = useRef<{ round_number: number; id: string } | null>(null);
  const segmentLoading = useRef(false);
  const segmentTotalCount = useRef(0);
  const loadedSegmentIds = useRef<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [debateDotWindowAnchor, setDebateDotWindowAnchor] = useState(0);
  const [debateDotProgress] = useState(() => new Animated.Value(0));
  const [hideExchangesBanner, setHideExchangesBanner] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [isReposted, setIsReposted] = useState(false);
  const {
    data: comments,
    topLevelComments,
    threadErrors,
    commentCount: loadedCommentCount,
    isLoading: isLoadingComments,
    isLoadingMoreTopLevel,
    hasMoreTopLevel,
    threadHasMore,
    loadMoreTopLevel,
    loadMoreThreadReplies,
    addComment,
    updateComment,
    error: commentsError,
    refetch: refetchComments,
  } = useComments(rootPost?.id);

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
  const mainScrollRef = useRef<FlatList<CommentItem>>(null);

  const loadDebateData = useCallback(async (showLoader = true) => {
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

      let debateSegments: any[] = [];
      let latestSegment: any = null;
      segmentCursor.current = null;
      segmentTotalCount.current = 0;
      loadedSegmentIds.current = new Set();
      setHasMoreSegments(false);
      setSegmentLoadError(null);
      setLatestSegmentLoadError(false);
      if (debateData?.id) {
        const [{ data: segmentData, error: segmentError, count }, { data: latestData, error: latestError }] = await Promise.all([
          supabase
            .from('DebateSegment')
            .select('*', { count: 'exact' })
            .eq('debate_id', debateData.id)
            .order('round_number', { ascending: true })
            .order('id', { ascending: true })
            .limit(8),
          supabase
            .from('DebateSegment')
            .select('*')
            .eq('debate_id', debateData.id)
            .order('round_number', { ascending: false })
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (segmentError) {
          console.warn('Error loading debate segments:', segmentError.message);
          setSegmentLoadError(segmentError.message);
        } else {
          debateSegments = segmentData || [];
          segmentTotalCount.current = count ?? 0;
          loadedSegmentIds.current = new Set(debateSegments.map((segment) => segment.id));
          const lastLoaded = debateSegments[debateSegments.length - 1];
          segmentCursor.current = lastLoaded
            ? { round_number: lastLoaded.round_number, id: lastLoaded.id }
            : null;
          setHasMoreSegments(loadedSegmentIds.current.size < segmentTotalCount.current);
        }

        if (latestError) {
          console.warn('Error loading latest debate segment:', latestError.message);
          setSegmentLoadError(latestError.message);
          setLatestSegmentLoadError(true);
        } else {
          latestSegment = latestData;
          setLatestSegmentLoadError(false);
        }
      }

      // 3. Fetch any additional replies / threaded posts in this debate
      const currentRootId = postData?.id || debateData?.root_post_id;
      let threadPosts: any[] = [];
      if (currentRootId) {
        if (segmentTotalCount.current === 0) {
          const { data: repliesData, error: repliesError } = await supabase
            .from('Post')
            .select('*, user:User!user_id(*)')
            .eq('parent_id', currentRootId)
            .is('repost_user_id', null)
            .order('created_at', { ascending: true });

          if (repliesError) console.warn('Error loading legacy debate replies:', repliesError.message);
          threadPosts = (repliesData || []).filter((p) => !p.repost_user_id);
        }

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

        if (currentUserId) {
          setIsReposted(repostUserIds.has(currentUserId));
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

      if (segmentTotalCount.current > 0) {
        debateSegments.forEach((segment) => items.push(toExchangeItem(segment, debateData, postData)));
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
      setLatestExchange(latestSegment ? toExchangeItem(latestSegment, debateData, postData) : items[items.length - 1] ?? null);

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
  }, [postId, debateId, currentUserId]);

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setActiveIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
    try {
      await loadDebateData(false);
      await refetchComments();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadDebateData());
  }, [loadDebateData]);

  const opUser: User = rootPost?.user || {
    id: rootPost?.user_id || '',
    username: 'Original Poster',
  };

  const challengerUser: User = debate?.challenger || {
    id: debate?.challenger_id || '',
    username: 'Challenger',
  };

  const lastExchange = latestExchange ?? (exchanges.length > 0 ? exchanges[exchanges.length - 1] : null);
  const isLastSpeakerChallenger = lastExchange ? lastExchange.side === 'challenger' : true;

  // Next speaker is OP if last was challenger; otherwise next is Challenger
  const nextSpeakerId = isLastSpeakerChallenger ? opUser.id : challengerUser.id;
  const isCurrentUserDebater = Boolean(
    currentUser?.id && (currentUser.id === opUser.id || currentUser.id === challengerUser.id)
  );
  const isCurrentUserTurn = Boolean(
    currentUser?.id && isCurrentUserDebater && currentUser.id === nextSpeakerId
  );

  // Total slides = all exchanges + (1 final slide if it is currently the logged-in user's turn)
  const canComposeCounter = isCurrentUserTurn && !hasMoreSegments && !segmentLoadError && !latestSegmentLoadError && !refreshing;
  const totalSlides = exchanges.length + (canComposeCounter ? 1 : 0);

  const scrollToSlide = (index: number) => {
    if (index < 0 || index >= totalSlides) return;
    scrollRef.current?.scrollTo({
      x: index * screenWidth,
      animated: true,
    });
    setActiveIndex(index);
    Haptics.selectionAsync();
  };

  const loadMoreSegments = async () => {
    if (!debate?.id || segmentLoading.current || loadedSegmentIds.current.size >= segmentTotalCount.current) return;

    segmentLoading.current = true;
    setIsLoadingMoreSegments(true);
    setSegmentLoadError(null);
    try {
      let query = supabase
        .from('DebateSegment')
        .select('*')
        .eq('debate_id', debate.id)
        .order('round_number', { ascending: true })
        .order('id', { ascending: true })
        .limit(8);

      if (segmentCursor.current) {
        query = query.or(
          `round_number.gt.${segmentCursor.current.round_number},and(round_number.eq.${segmentCursor.current.round_number},id.gt.${segmentCursor.current.id})`
        );
      }

      const { data, error: segmentError } = await query;
      if (segmentError) throw segmentError;

      const page = data ?? [];
      if (!page.length) {
        segmentTotalCount.current = loadedSegmentIds.current.size;
        setHasMoreSegments(false);
        return;
      }

      const lastSegment = page[page.length - 1];
      segmentCursor.current = { round_number: lastSegment.round_number, id: lastSegment.id };
      const newSegments = page.filter((segment) => !loadedSegmentIds.current.has(segment.id));
      newSegments.forEach((segment) => loadedSegmentIds.current.add(segment.id));
      setExchanges((current) => {
        const merged = [...current, ...newSegments.map((segment) => toExchangeItem(segment, debate, rootPost))];
        const root = merged.find((item) => item.id === rootPost?.id);
        const segments = merged.filter((item) => item.id !== rootPost?.id);
        segments.sort((a, b) => a.roundNumber - b.roundNumber || a.id.localeCompare(b.id));
        return root ? [root, ...segments] : segments;
      });
      setHasMoreSegments(loadedSegmentIds.current.size < segmentTotalCount.current);
    } catch (cause) {
      console.error('Error loading more debate segments:', cause);
      setSegmentLoadError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      segmentLoading.current = false;
      setIsLoadingMoreSegments(false);
    }
  };

  const stepThreadSlide = (threadRootId: string, direction: -1 | 1, slideCount: number) => {
    const currentIndex = activeThreadSlides[threadRootId] ?? 0;
    const nextIndex = Math.max(0, Math.min(currentIndex + direction, slideCount - 1));
    if (nextIndex === currentIndex) return;
    requestThreadScroll(threadRootId, nextIndex * threadSlideWidth);
    const threadComments = getThreadComments(threadRootId);
    if (nextIndex >= Math.max(1, threadComments.length - 2) && threadHasMore(threadRootId)) {
      void loadMoreThreadReplies(threadRootId);
    }
    const activeComment = threadComments[nextIndex];
    if (activeComment && activeComment.id !== threadRootId) {
      void loadMoreThreadReplies(activeComment.id, true);
    }
    if (nextIndex >= Math.max(1, threadComments.length - 2)) {
      const lastComment = threadComments[threadComments.length - 1];
      if (lastComment?.parent_comment_id && lastComment.parent_comment_id !== threadRootId) {
        void loadMoreThreadReplies(lastComment.parent_comment_id);
      }
    }
    Haptics.selectionAsync();
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    debateDotProgress.setValue(offsetX);
    const progress = offsetX / screenWidth;
    const windowAnchor = Math.floor(progress);
    setDebateDotWindowAnchor((current) => current === windowAnchor ? current : windowAnchor);
    const index = Math.round(offsetX / screenWidth);
    if (index !== activeIndex && index >= 0 && index < totalSlides) {
      setActiveIndex(index);
    }
    if (hasMoreSegments && index >= exchanges.length - 3) {
      void loadMoreSegments();
    }
  };

  const onDebateMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(
      0,
      Math.min(Math.round(event.nativeEvent.contentOffset.x / screenWidth), totalSlides - 1)
    );
    setActiveIndex(index);
    onScroll(event);
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

      const { data: insertedSegment, error: segmentError } = await supabase.from('DebateSegment').insert({
        id: Crypto.randomUUID(),
        debate_id: debateDbId,
        post_id: rootId,
        speaker_id: currentUser.id,
        text: replyText.trim(),
        file: mediaFilename,
        side: currentSide,
        round_number: (latestExchange?.roundNumber ?? 1) + 1,
      }).select('*').single();

      if (segmentError) {
        console.error('Error creating debate segment:', segmentError);
        Alert.alert('Error', 'The response was posted, but its debate segment could not be saved.');
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReplyText('');
      setReplyPhoto('');
      setReplyVideo('');

      if (insertedSegment) {
        const newExchange = toExchangeItem(insertedSegment, debate, rootPost);
        loadedSegmentIds.current.add(insertedSegment.id);
        segmentTotalCount.current += 1;
        setLatestExchange(newExchange);
        setExchanges((current) => {
          const merged = [...current.filter((item) => item.id !== newExchange.id), newExchange];
          const root = merged.find((item) => item.id === rootPost?.id);
          const segments = merged.filter((item) => item.id !== rootPost?.id);
          segments.sort((a, b) => a.roundNumber - b.roundNumber || a.id.localeCompare(b.id));
          return root ? [root, ...segments] : segments;
        });
        setHasMoreSegments(loadedSegmentIds.current.size < segmentTotalCount.current);
      }
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
    else {
      updateComment(comment.id, (current) => ({
        ...current,
        likes: [...(current.likes ?? []), { user_id: currentUser.id }],
      }));
    }
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
    else {
      updateComment(comment.id, (current) => ({
        ...current,
        likes: (current.likes ?? []).filter((like) => like.user_id !== currentUser.id),
      }));
    }
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
      updateComment(comment.id, (current) => ({
        ...current,
        reposts: [...(current.reposts ?? []), { user_id: currentUser.id }],
      }));
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
      updateComment(comment.id, (current) => ({
        ...current,
        reposts: (current.reposts ?? []).filter((repost) => repost.user_id !== currentUser.id),
      }));
    }
  };

  const handleCommentDebatePress = () => {
    Alert.alert('Debate this comment', 'Starting a debate from a comment is coming soon.');
  };

  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentPhoto, setNewCommentPhoto] = useState('');
  const [newCommentVideo, setNewCommentVideo] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [threadReplyDrafts, setThreadReplyDrafts] = useState<Record<string, { text: string; photo: string; video: string }>>({});
  const [threadReplyTargets, setThreadReplyTargets] = useState<Record<string, string>>({});
  const [submittingThreadId, setSubmittingThreadId] = useState<string | null>(null);
  const [activeThreadSlides, setActiveThreadSlides] = useState<Record<string, number>>({});
  const [threadDotWindowAnchors, setThreadDotWindowAnchors] = useState<Record<string, number>>({});
  const threadDotProgressValues = useRef<Record<string, Animated.Value>>({});
  const [threadScrollRequests, setThreadScrollRequests] = useState<Record<string, ThreadScrollRequest>>({});
  const [threadMaxCardHeights, setThreadMaxCardHeights] = useState<Record<string, number>>({});
  const [maxDebateSegmentHeight, setMaxDebateSegmentHeight] = useState(0);
  const [threadCarouselWidth, setThreadCarouselWidth] = useState(screenWidth);
  const threadSlideWidth = threadCarouselWidth;
  const commentById = useMemo(() => new Map(comments.map((comment) => [comment.id, comment])), [comments]);
  const commentsByParent = useMemo(() => {
    const children = new Map<string, CommentItem[]>();
    comments.forEach((comment) => {
      if (!comment.parent_comment_id) return;
      const siblings = children.get(comment.parent_comment_id) ?? [];
      siblings.push(comment);
      children.set(comment.parent_comment_id, siblings);
    });
    return children;
  }, [comments]);
  const commentViewabilityCallback = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    viewableItems.forEach(({ item }) => {
      if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') {
        void loadMoreThreadReplies(item.id);
      }
    });
  }, [loadMoreThreadReplies]);

  const requestThreadScroll = (threadRootId: string, offset: number) => {
    const targetIndex = Math.max(0, Math.min(Math.round(offset / threadSlideWidth), getThreadComments(threadRootId).length));
    if (Platform.OS === 'web') {
      threadDotProgressValues.current[threadRootId]?.setValue(offset);
      setThreadDotWindowAnchors((anchors) => ({ ...anchors, [threadRootId]: targetIndex }));
    }
    setThreadScrollRequests((requests) => ({
      ...requests,
      [threadRootId]: { offset, token: (requests[threadRootId]?.token ?? 0) + 1 },
    }));
    setActiveThreadSlides((slides) => ({ ...slides, [threadRootId]: targetIndex }));
  };

  const updateThreadReply = (commentId: string, updates: Partial<{ text: string; photo: string; video: string }>) => {
    setThreadReplyDrafts((drafts) => {
      const draft = drafts[commentId] ?? { text: '', photo: '', video: '' };
      return { ...drafts, [commentId]: { ...draft, ...updates } };
    });
  };

  const selectThreadReplyTarget = (threadRootId: string, targetCommentId: string) => {
    setThreadReplyTargets((targets) => ({ ...targets, [threadRootId]: targetCommentId }));
    requestThreadScroll(threadRootId, getThreadComments(threadRootId).length * threadSlideWidth);
  };

  const getThreadComments = (threadRootId: string) => {
    const root = commentById.get(threadRootId);
    if (!root) return [];

    const descendants: CommentItem[] = [];
    const parents = [threadRootId];
    for (let index = 0; index < parents.length; index += 1) {
      for (const child of commentsByParent.get(parents[index]) ?? []) {
        descendants.push(child);
        parents.push(child.id);
      }
    }

    descendants.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
    return [root, ...descendants];
  };

  const pickThreadReplyMedia = async (commentId: string, mediaType: 'image' | 'video') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaType === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: mediaType === 'image',
      quality: 0.8,
    });
    const uri = result.canceled ? null : result.assets?.[0]?.uri;
    if (!uri) return;
    updateThreadReply(commentId, mediaType === 'image' ? { photo: uri, video: '' } : { video: uri, photo: '' });
  };

  const submitThreadReply = async (parentComment: CommentItem, isDebatable: boolean) => {
    const draft = threadReplyDrafts[parentComment.id] ?? { text: '', photo: '', video: '' };
    const replyTargetId = threadReplyTargets[parentComment.id] ?? parentComment.id;
    if (!rootPost?.id || !currentUser?.id) {
      Alert.alert('Sign in required', 'Please log in to reply.');
      return;
    }
    if (!draft.text.trim() && !draft.photo && !draft.video) return;

    try {
      setSubmittingThreadId(parentComment.id);
      let mediaFilename: string | null = null;
      if (draft.photo) {
        mediaFilename = await uploadFile(currentUser.id, draft.photo, 'image/jpeg', `${Date.now()}-comment-reply.jpg`);
      } else if (draft.video) {
        mediaFilename = await uploadFile(currentUser.id, draft.video, 'video/mp4', `${Date.now()}-comment-reply.mp4`);
      }

      const { data, error } = await supabase.from('Comment').insert({
        id: Crypto.randomUUID(),
        post_id: rootPost.id,
        parent_comment_id: parentComment.id,
        reply_to_comment_id: replyTargetId,
        speaker_id: currentUser.id,
        text: draft.text.trim(),
        file: mediaFilename,
        is_debatable: isDebatable,
      }).select('*, speaker:User!speaker_id(id,username,avatar), likes:Like(user_id), reposts:Repost(user_id)').single();
      if (error) {
        console.error('Error posting comment reply:', error);
        Alert.alert('Error', 'Could not post your reply.');
        return;
      }
      updateThreadReply(parentComment.id, { text: '', photo: '', video: '' });
      setThreadReplyTargets((targets) => ({ ...targets, [parentComment.id]: parentComment.id }));
      addComment(data as unknown as CommentItem);
    } finally {
      setSubmittingThreadId(null);
    }
  };

  const selectThreadReplyType = (parentComment: CommentItem) => {
    const draft = threadReplyDrafts[parentComment.id] ?? { text: '', photo: '', video: '' };
    if ((!draft.text.trim() && !draft.photo && !draft.video) || submittingThreadId === parentComment.id) return;
    Alert.alert('Reply type', 'Do you want to reply or start a debate?', [
      { text: 'Reply', onPress: () => submitThreadReply(parentComment, false) },
      { text: 'Debate', onPress: () => submitThreadReply(parentComment, true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const recordThreadCardHeight = (threadRootId: string, height: number) => {
    setThreadMaxCardHeights((heights) => {
      if (height <= (heights[threadRootId] ?? 0) + 1) return heights;
      return { ...heights, [threadRootId]: height };
    });
  };

  const recordDebateSegmentHeight = (height: number) => {
    setMaxDebateSegmentHeight((currentHeight) =>
      height > currentHeight + 1 ? height : currentHeight
    );
  };

  const renderThreadCommentCard = (
    comment: CommentItem,
    threadRootId: string,
    isVisible: boolean,
    maxCardHeight: number
  ) => {
    const isCommentLiked = comment.likes?.some((like) => like.user_id === currentUser?.id);
    const isCommentReposted = comment.reposts?.some((repost: any) => repost.user_id === currentUser?.id);
    const replyTargetId = comment.reply_to_comment_id ?? comment.parent_comment_id;
    const replyTarget = replyTargetId ? commentById.get(replyTargetId) : null;
    const avatarUrl = comment.speaker?.avatar
      ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${comment.speaker.id}/${comment.speaker.avatar}`
      : null;

    return (
      <View
        style={[
          styles.commentSlideWrapper,
          { width: threadSlideWidth, minHeight: maxCardHeight, flexGrow: 0, flexShrink: 0 },
        ]}
      >
        <View
          style={[styles.debateCard, styles.commentThreadCard]}
          onLayout={(event) => recordThreadCardHeight(threadRootId, event.nativeEvent.layout.height)}
        >
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

          {replyTarget ? (
            <Pressable
              style={styles.commentReplyContext}
              onPress={() => {
                const targetIndex = getThreadComments(threadRootId).findIndex((item) => item.id === replyTarget.id);
                if (targetIndex < 0) return;
                requestThreadScroll(threadRootId, targetIndex * threadSlideWidth);
                Haptics.selectionAsync();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Go to comment by ${replyTarget.speaker?.username || 'user'}`}
            >
              <Text style={styles.commentReplyAttribution}>
                Replying to @{replyTarget.speaker?.username || 'user'}
              </Text>
              <Text
                style={[styles.commentReplyExcerpt, Platform.OS === 'web' && styles.webCommentReplyExcerpt]}
                numberOfLines={2}
              >
                {replyTarget.text || (replyTarget.file?.endsWith('.mp4') ? 'Video' : replyTarget.file ? 'Photo' : 'Comment')}
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
          {comment.file ? (
            comment.file.endsWith('.mp4') ? (
              <View style={styles.threadMediaContainer}>
                <PostVideo
                  uri={`${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${comment.speaker_id}/${comment.file}`}
                  isVisible={isVisible}
                />
              </View>
            ) : (
              <Image
                source={{ uri: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${comment.speaker_id}/${comment.file}` }}
                style={styles.threadMediaImage}
                resizeMode="contain"
              />
            )
          ) : null}

          <View style={styles.threadCardFooter}>
            <View style={styles.threadCardActions}>
              <Pressable
                onPress={() => (isCommentLiked ? removeCommentLike(comment) : addCommentLike(comment))}
                style={styles.postAction}
              >
                <Heart size={16} color={isCommentLiked ? '#ef4444' : '#b0b0b0'} fill={isCommentLiked ? '#ef4444' : 'transparent'} />
                {(comment.likes?.length ?? 0) > 0 ? <Text style={styles.postActionText}>{comment.likes!.length}</Text> : null}
              </Pressable>
              <Pressable
                onPress={() => (isCommentReposted ? removeCommentRepost(comment) : addCommentRepost(comment))}
                style={styles.postAction}
              >
                <Repeat size={16} color={isCommentReposted ? '#22d3ee' : '#b0b0b0'} />
                {(comment.reposts?.length ?? 0) > 0 ? <Text style={styles.postActionText}>{comment.reposts!.length}</Text> : null}
              </Pressable>
              <Pressable
                onPress={() => selectThreadReplyTarget(threadRootId, comment.id)}
                style={styles.postAction}
              >
                <MessageCircle size={16} color="#b0b0b0" />
                <Text style={styles.postActionText}>Reply</Text>
              </Pressable>
              {comment.is_debatable ? (
                <Pressable onPress={handleCommentDebatePress} style={styles.postAction}>
                  <Swords size={16} color="#b0b0b0" />
                </Pressable>
              ) : null}
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

  const submitNewComment = async (isDebatable: boolean) => {
    if (!rootPost?.id || !currentUser?.id) {
      Alert.alert('Sign in required', 'Please log in to comment.');
      return;
    }
    if (!newCommentText.trim() && !newCommentPhoto && !newCommentVideo) return;

    try {
      setIsSubmittingComment(true);
      let mediaFilename: string | null = null;

      if (newCommentPhoto) {
        mediaFilename = await uploadFile(currentUser.id, newCommentPhoto, 'image/jpeg', `${Date.now()}-comment.jpg`);
      } else if (newCommentVideo) {
        mediaFilename = await uploadFile(currentUser.id, newCommentVideo, 'video/mp4', `${Date.now()}-comment.mp4`);
      }

      const { data, error } = await supabase.from('Comment').insert({
        id: Crypto.randomUUID(),
        post_id: rootPost.id,
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
      addComment(data as unknown as CommentItem);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const isNewCommentDisabled =
    (!newCommentText.trim() && !newCommentPhoto && !newCommentVideo) || isSubmittingComment;

  const handleNewCommentTypeSelection = () => {
    if (isNewCommentDisabled) return;
    Alert.alert(
      'Comment type',
      'Do you want this comment to be a reply, or should it be open for debate?',
      [
        { text: 'Reply', onPress: () => submitNewComment(false) },
        { text: 'Debate', onPress: () => submitNewComment(true) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

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
  const renderCommentThread = ({ item: comment }: { item: CommentItem }) => {
    const threadComments = getThreadComments(comment.id);
    const threadRepliesForRoot = threadComments.filter((item) => item.id !== comment.id);
    const replyDraft = threadReplyDrafts[comment.id] ?? { text: '', photo: '', video: '' };
    const replyTarget = commentById.get(threadReplyTargets[comment.id] ?? comment.id) ?? comment;
    const activeSlide = activeThreadSlides[comment.id] ?? 0;
    let dotScrollOffset = threadDotProgressValues.current[comment.id];
    if (!dotScrollOffset) {
      dotScrollOffset = new Animated.Value(activeSlide * threadSlideWidth);
      threadDotProgressValues.current[comment.id] = dotScrollOffset;
    }
    const maxCardHeight = threadMaxCardHeights[comment.id] ?? 0;
    const failedThreadId = threadComments.find((item) => threadErrors[item.id])?.id;

    return (
      <View style={styles.commentThread}>
        <CommentThreadScroller
          width={threadSlideWidth}
          slideCount={threadComments.length + 1}
          request={threadScrollRequests[comment.id]}
          initialOffset={activeSlide * threadSlideWidth}
          dotScrollOffset={dotScrollOffset}
          onLayout={(event) => {
            const width = event.nativeEvent.layout.width;
            if (width > 0 && width !== threadCarouselWidth) setThreadCarouselWidth(width);
          }}
          onScroll={(event) => {
            const offsetX = event.nativeEvent.contentOffset.x;
            dotScrollOffset?.setValue(offsetX);
            const progress = offsetX / threadSlideWidth;
            const windowAnchor = Math.floor(progress);
            setThreadDotWindowAnchors((anchors) =>
              anchors[comment.id] === windowAnchor
                ? anchors
                : { ...anchors, [comment.id]: windowAnchor }
            );
            const index = Math.round(offsetX / threadSlideWidth);
            setActiveThreadSlides((slides) =>
              slides[comment.id] === index ? slides : { ...slides, [comment.id]: index }
            );
            if (index >= Math.max(1, threadComments.length - 2) && threadHasMore(comment.id)) {
              void loadMoreThreadReplies(comment.id);
            }
            const activeComment = threadComments[index];
            if (activeComment && activeComment.id !== comment.id) {
              void loadMoreThreadReplies(activeComment.id, true);
            }
            if (index >= Math.max(1, threadComments.length - 2)) {
              const lastComment = threadComments[threadComments.length - 1];
              if (lastComment?.parent_comment_id && lastComment.parent_comment_id !== comment.id) {
                void loadMoreThreadReplies(lastComment.parent_comment_id);
              }
            }
          }}
        >
          {threadComments.map((item, index) => (
            Math.abs(index - activeSlide) <= 1
              ? <Fragment key={item.id}>
                  {renderThreadCommentCard(item, comment.id, index === activeSlide, maxCardHeight)}
                </Fragment>
              : (
                <View
                  key={item.id}
                  style={{ width: threadSlideWidth, minHeight: maxCardHeight }}
                />
              )
          ))}
          <View
            style={[
              styles.commentSlideWrapper,
              { width: threadSlideWidth, minHeight: maxCardHeight, flexGrow: 0, flexShrink: 0 },
            ]}
          >
            <View
              style={[styles.debateCard, styles.commentReplyCard]}
              onLayout={(event) => recordThreadCardHeight(comment.id, event.nativeEvent.layout.height)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardAuthorRow}>
                  <Text style={[styles.cardAuthorName, Platform.OS === 'web' && styles.webCardAuthorName]}>
                    Reply to @{replyTarget.speaker?.username || 'user'}
                  </Text>
                  <View style={styles.cardSideTagActive}>
                    <Text style={styles.cardSideTagActiveText}>OPEN THREAD</Text>
                  </View>
                </View>
              </View>
              {replyDraft.photo ? (
                <Image source={{ uri: replyDraft.photo }} style={styles.replyMediaPreview} />
              ) : null}
              {replyDraft.video ? (
                <View style={styles.cardMediaContainer}>
                  <PostVideo uri={replyDraft.video} isVisible />
                </View>
              ) : null}
              <TextInput
                style={styles.threadReplyInput}
                placeholder={`Write a reply to @${replyTarget.speaker?.username || 'this user'}...`}
                placeholderTextColor="#64748b"
                multiline
                value={replyDraft.text}
                onChangeText={(text) => updateThreadReply(comment.id, { text })}
              />
              <View style={styles.newCommentFooter}>
                <Pressable onPress={() => pickThreadReplyMedia(comment.id, 'image')}>
                  <ImageIcon size={18} color="#94a3b8" />
                </Pressable>
                <Pressable onPress={() => pickThreadReplyMedia(comment.id, 'video')}>
                  <VideoIcon size={18} color="#94a3b8" />
                </Pressable>
                <Pressable
                  onPress={() => selectThreadReplyType(comment)}
                  disabled={submittingThreadId === comment.id || (!replyDraft.text.trim() && !replyDraft.photo && !replyDraft.video)}
                  style={[
                    styles.newCommentSubmit,
                    { opacity: submittingThreadId === comment.id || (!replyDraft.text.trim() && !replyDraft.photo && !replyDraft.video) ? 0.5 : 1 },
                  ]}
                >
                  <Text style={styles.newCommentSubmitText}>
                    {submittingThreadId === comment.id ? 'Posting...' : 'Post Reply'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </CommentThreadScroller>
        {failedThreadId ? (
          <Pressable
            style={styles.threadPagination}
            onPress={() => void loadMoreThreadReplies(failedThreadId)}
          >
            <Text style={styles.postActionText}>Couldn&apos;t load replies. Tap to retry.</Text>
          </Pressable>
        ) : null}
        {Platform.OS === 'web' && threadComments.length + 1 > 1 ? (
          <View pointerEvents="box-none" style={styles.webCarouselArrows}>
            <Pressable
              onPress={() => stepThreadSlide(comment.id, -1, threadComments.length + 1)}
              disabled={activeSlide <= 0}
              accessibilityRole="button"
              accessibilityLabel="Previous comment"
              style={[styles.webCarouselArrow, styles.webCarouselArrowLeft, activeSlide <= 0 && styles.webCarouselArrowDisabled]}
            >
              <ChevronLeft size={18} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => stepThreadSlide(comment.id, 1, threadComments.length + 1)}
              disabled={activeSlide >= threadComments.length}
              accessibilityRole="button"
              accessibilityLabel="Next comment"
              style={[styles.webCarouselArrow, styles.webCarouselArrowRight, activeSlide >= threadComments.length && styles.webCarouselArrowDisabled]}
            >
              <ChevronRight size={18} color="#fff" />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.threadPagination}>
          <CarouselPagination
            totalCount={threadRepliesForRoot.length + 2}
            activeIndex={activeSlide}
            progressValue={dotScrollOffset}
            progressWidth={threadSlideWidth}
            windowAnchorIndex={threadDotWindowAnchors[comment.id] ?? 0}
          />
        </View>
        <View style={styles.commentDivider} />
      </View>
    );
  };

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
            <>
            <FlatList
              ref={mainScrollRef}
              data={topLevelComments}
              renderItem={renderCommentThread}
              keyExtractor={(comment) => comment.id}
              onEndReached={() => void loadMoreTopLevel()}
              onEndReachedThreshold={0.5}
              onViewableItemsChanged={commentViewabilityCallback}
              viewabilityConfig={COMMENT_VIEWABILITY_CONFIG}
              contentContainerStyle={styles.mainScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={() => Keyboard.dismiss()}
              refreshControl={(
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#22d3ee"
                  colors={['#22d3ee']}
                />
              )}
              ListHeaderComponent={
                <View>
              {/* Carousel Section (Horizontal swipeable opinion cards) */}
              <View style={styles.carouselContainer}>
                <ScrollView
                  ref={scrollRef}
                  horizontal
                  pagingEnabled
                  contentContainerStyle={Platform.OS === 'web' ? styles.webDebateCarouselContent : undefined}
                  showsHorizontalScrollIndicator={false}
                  onScroll={onScroll}
                  onMomentumScrollEnd={onDebateMomentumScrollEnd}
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
                      <View
                        key={item.id}
                        style={[
                          styles.cardWrapper,
                          { width: screenWidth, minHeight: maxDebateSegmentHeight },
                          Platform.OS === 'web' && styles.webCardWrapper,
                        ]}
                      >
                        {Math.abs(index - activeIndex) <= 1 ? <View
                          style={[
                            styles.debateCard,
                            Platform.OS === 'web' && styles.webDebateCard,
                            isOpCard ? styles.opCardBorder : styles.challengerCardBorder,
                          ]}
                          onLayout={(event) => recordDebateSegmentHeight(event.nativeEvent.layout.height)}
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
                        </View> : <View style={{ width: screenWidth, minHeight: maxDebateSegmentHeight }} />}
                      </View>
                    );
                  })}

                  {/* FINAL SLIDE: Render ONLY if it is currently the logged-in user's debate and turn */}
                  {canComposeCounter ? (
                    <View
                      style={[
                        styles.cardWrapper,
                        { width: screenWidth, minHeight: maxDebateSegmentHeight },
                        Platform.OS === 'web' && styles.webCardWrapper,
                      ]}
                    >
                      <View
                        style={[styles.debateCard, Platform.OS === 'web' && styles.webDebateCard, styles.inputCardBorder]}
                        onLayout={(event) => recordDebateSegmentHeight(event.nativeEvent.layout.height)}
                      >
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
                                <X size={14} color="#fff" />
                              </Pressable>
                            </View>
                          ) : null}

                          {/* Attached Video Preview */}
                          {replyVideo ? (
                            <View style={styles.composerMediaPreview}>
                              <PostVideo uri={replyVideo} isVisible={activeIndex === exchanges.length} />
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

                {Platform.OS === 'web' && totalSlides > 1 ? (
                  <View pointerEvents="box-none" style={styles.webCarouselArrows}>
                    <Pressable
                      onPress={() => scrollToSlide(activeIndex - 1)}
                      disabled={activeIndex <= 0}
                      accessibilityRole="button"
                      accessibilityLabel="Previous debate card"
                      style={[styles.webCarouselArrow, styles.webCarouselArrowLeft, activeIndex <= 0 && styles.webCarouselArrowDisabled]}
                    >
                      <ChevronLeft size={20} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={() => scrollToSlide(activeIndex + 1)}
                      disabled={activeIndex >= totalSlides - 1}
                      accessibilityRole="button"
                      accessibilityLabel="Next debate card"
                      style={[styles.webCarouselArrow, styles.webCarouselArrowRight, activeIndex >= totalSlides - 1 && styles.webCarouselArrowDisabled]}
                    >
                      <ChevronRight size={20} color="#fff" />
                    </Pressable>
                  </View>
                ) : null}

                {/* Pagination Dots (Synced with active slide) */}
                <View style={styles.paginationRow}>
                  <CarouselPagination
                    totalCount={totalSlides}
                    activeIndex={activeIndex}
                    progressValue={debateDotProgress}
                    progressWidth={screenWidth}
                    windowAnchorIndex={debateDotWindowAnchor}
                    onDotPress={scrollToSlide}
                    accessibilityLabel="Go to debate segment"
                  />
                </View>
                {isLoadingMoreSegments ? (
                  <ActivityIndicator style={styles.segmentLoadingIndicator} color="#22d3ee" />
                ) : null}
                {segmentLoadError || latestSegmentLoadError ? (
                  <Pressable
                    style={styles.segmentLoadingIndicator}
                    onPress={() => {
                      setActiveIndex(0);
                      scrollRef.current?.scrollTo({ x: 0, animated: false });
                      void loadDebateData(false);
                    }}
                  >
                    <Text style={styles.postActionText}>Couldn&apos;t load debate cards. Tap to retry.</Text>
                  </Pressable>
                ) : null}
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
                  {loadedCommentCount > 0 ? (
                    <Text style={styles.postActionText}>{loadedCommentCount}</Text>
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

              </View>
              }
              ListEmptyComponent={
                isLoadingComments
                  ? <ActivityIndicator style={styles.commentsContainer} color="#22d3ee" />
                  : commentsError
                    ? (
                      <View style={styles.commentsContainer}>
                        <Text style={styles.noCommentsText}>Couldn&apos;t load comments.</Text>
                        <Pressable onPress={() => void refetchComments()}>
                          <Text style={styles.postActionText}>Tap to retry</Text>
                        </Pressable>
                      </View>
                    )
                  : <Text style={[styles.noCommentsText, styles.commentsContainer]}>No comments yet.</Text>
              }
              ListFooterComponent={
                isLoadingMoreTopLevel
                  ? <ActivityIndicator style={styles.commentsContainer} color="#22d3ee" />
                  : commentsError && hasMoreTopLevel
                    ? (
                      <Pressable
                        style={styles.commentsContainer}
                        onPress={() => void loadMoreTopLevel()}
                      >
                        <Text style={styles.postActionText}>Couldn&apos;t load more comments. Tap to retry.</Text>
                      </Pressable>
                    )
                  : hasMoreTopLevel
                    ? <View style={styles.commentsContainer} />
                    : null
              }
            />

            {/* Add a comment - pinned to the bottom, always visible while scrolling */}
            <View style={styles.newCommentBox}>
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
              <View style={{ flex: 1 }}>
                {newCommentPhoto ? (
                  <Image source={{ uri: newCommentPhoto }} style={styles.newCommentPreview} />
                ) : null}
                <TextInput
                  style={styles.newCommentInput}
                  placeholder="Write a comment..."
                  placeholderTextColor="#71767b"
                  multiline
                  value={newCommentText}
                  onChangeText={setNewCommentText}
                />
                <View style={styles.newCommentFooter}>
                  <Pressable onPress={pickNewCommentPhoto}>
                    <ImageIcon size={18} color="#b0b0b0" />
                  </Pressable>
                  <Pressable onPress={pickNewCommentVideo}>
                    <VideoIcon size={18} color="#b0b0b0" />
                  </Pressable>
                  <Pressable
                    onPress={handleNewCommentTypeSelection}
                    disabled={isNewCommentDisabled}
                    style={[styles.newCommentSubmit, { opacity: isNewCommentDisabled ? 0.5 : 1 }]}
                  >
                    <Text style={styles.newCommentSubmitText}>
                      {isSubmittingComment ? 'Posting...' : 'Post'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
            </>
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
  webColumn: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
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
    justifyContent: 'center',
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
  segmentLoadingIndicator: {
    marginVertical: 8,
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
  },
  dotsIndicatorViewport: {
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  dotsIndicatorSlot: {
    width: CAROUSEL_DOT_SLOT_SIZE,
    height: CAROUSEL_DOT_SLOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#454545',
    alignSelf: 'center',
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
  commentSlideWrapper: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  threadCarouselViewport: {
    width: '100%',
    alignItems: 'center',
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
  commentReplyCard: {
    width: '90%',
    alignSelf: 'center',
    minHeight: 0,
    justifyContent: 'flex-start',
    padding: 9,
    borderColor: 'rgba(34, 211, 238, 0.28)',
  },
  threadReplyInput: {
    color: '#ffffff',
    fontSize: 14,
    minHeight: 30,
    maxHeight: 110,
    textAlignVertical: 'top',
  },
  replyMediaPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
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
  noCommentsText: {
    color: '#71767b',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
  },
  newCommentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#262626',
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  newCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    marginTop: 2,
  },
  newCommentGrayAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  newCommentPreview: { width: 90, height: 90, borderRadius: 10, marginBottom: 8 },
  newCommentInput: { color: 'white', fontSize: 14, minHeight: 36, maxHeight: 100 },
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