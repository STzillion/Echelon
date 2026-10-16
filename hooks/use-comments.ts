import { supabase } from '@/lib/supabase';
import { User } from '@/providers/PostsProvider';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type CommentItem = {
  id: string;
  post_id: string;
  speaker_id: string;
  text: string | null;
  file: string | null;
  repost_id?: string | null;
  parent_comment_id?: string | null;
  reply_to_comment_id?: string | null;
  is_debatable: boolean;
  created_at: string;
  speaker?: User;
  likes?: { user_id: string }[];
  reposts?: { user_id: string }[];
};

type CommentCursor = {
  created_at: string;
  id: string;
};

const COMMENT_PAGE_SIZE = 12;

const fetchCommentPage = async (
  postId: string,
  parentCommentId: string | null,
  cursor: CommentCursor | null
): Promise<{ comments: CommentItem[]; nextCursor: CommentCursor | null; hasMore: boolean }> => {
  let query = supabase
    .from('Comment')
    .select('*, speaker:User!speaker_id(id,username,avatar), likes:Like(user_id), reposts:Repost(user_id)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(COMMENT_PAGE_SIZE + 1);

  query = parentCommentId
    ? query.eq('parent_comment_id', parentCommentId)
    : query.is('parent_comment_id', null);

  if (cursor) {
    query = query.or(
      `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as CommentItem[];
  const hasMore = rows.length > COMMENT_PAGE_SIZE;
  const comments = hasMore ? rows.slice(0, COMMENT_PAGE_SIZE) : rows;
  const lastComment = comments[comments.length - 1];

  return {
    comments,
    nextCursor: lastComment ? { created_at: lastComment.created_at, id: lastComment.id } : cursor,
    hasMore,
  };
};

export const useComments = (postId?: string) => {
  const [topLevelComments, setTopLevelComments] = useState<CommentItem[]>([]);
  const [threadReplies, setThreadReplies] = useState<Record<string, CommentItem[]>>({});
  const [commentCount, setCommentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMoreTopLevel, setIsLoadingMoreTopLevel] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState<Record<string, boolean>>({});
  const [threadErrors, setThreadErrors] = useState<Record<string, Error | null>>({});
  const [hasMoreTopLevel, setHasMoreTopLevel] = useState(true);
  const [threadHasMore, setThreadHasMore] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Error | null>(null);

  const topCursor = useRef<CommentCursor | null>(null);
  const topHasMore = useRef(true);
  const topLoading = useRef(new Set<string>());
  const threadCursors = useRef<Record<string, CommentCursor | null>>({});
  const threadHasMoreRef = useRef<Record<string, boolean>>({});
  const threadLoading = useRef<Set<string>>(new Set());
  const currentPostId = useRef(postId);

  const loadTopLevel = useCallback(async (reset = false, preserveThreadPages = false) => {
    if (!postId || topLoading.current.has(postId)) return;
    if (!reset && !topHasMore.current) return;

    topLoading.current.add(postId);
    if (reset) {
      topCursor.current = null;
      topHasMore.current = true;
      if (!preserveThreadPages) {
        threadCursors.current = {};
        threadHasMoreRef.current = {};
        threadLoading.current.clear();
        setThreadErrors({});
        setThreadReplies({});
        setThreadHasMore({});
      }
      setTopLevelComments([]);
      setHasMoreTopLevel(true);
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMoreTopLevel(true);
    }
    setError(null);

    try {
      const [page, countResult] = await Promise.all([
        fetchCommentPage(postId, null, reset ? null : topCursor.current),
        reset
          ? supabase.from('Comment').select('id', { count: 'exact', head: true }).eq('post_id', postId)
          : Promise.resolve(null),
      ]);

      if (currentPostId.current !== postId) return;
      if (countResult?.error) throw countResult.error;

      topCursor.current = page.nextCursor;
      topHasMore.current = page.hasMore;
      setHasMoreTopLevel(page.hasMore);
      setTopLevelComments((current) => {
        const base = reset ? [] : current;
        const knownIds = new Set(base.map((comment) => comment.id));
        return [...base, ...page.comments.filter((comment) => !knownIds.has(comment.id))];
      });
      if (countResult) setCommentCount(countResult.count ?? 0);
    } catch (cause) {
      const loadError = cause instanceof Error ? cause : new Error(String(cause));
      setError(loadError);
      console.error('Error loading comments:', loadError);
    } finally {
      topLoading.current.delete(postId);
      if (currentPostId.current === postId) {
        setIsLoading(false);
        setIsLoadingMoreTopLevel(false);
      }
    }
  }, [postId]);

  const loadMoreThreadReplies = useCallback(async (threadRootId: string, onlyIfUnloaded = false) => {
    if (!postId || threadLoading.current.has(threadRootId)) return;
    if (threadHasMoreRef.current[threadRootId] === false) return;
    if (onlyIfUnloaded && Object.prototype.hasOwnProperty.call(threadCursors.current, threadRootId)) return;

    threadLoading.current.add(threadRootId);
    setLoadingThreads((current) => ({ ...current, [threadRootId]: true }));
    setThreadErrors((current) => ({ ...current, [threadRootId]: null }));
    try {
      const page = await fetchCommentPage(postId, threadRootId, threadCursors.current[threadRootId] ?? null);
      if (currentPostId.current !== postId) return;

      threadCursors.current[threadRootId] = page.nextCursor;
      threadHasMoreRef.current[threadRootId] = page.hasMore;
      setThreadHasMore((current) => ({ ...current, [threadRootId]: page.hasMore }));
      setThreadReplies((current) => {
        const existing = current[threadRootId] ?? [];
        const knownIds = new Set(existing.map((comment) => comment.id));
        return {
          ...current,
          [threadRootId]: [...existing, ...page.comments.filter((comment) => !knownIds.has(comment.id))],
        };
      });
    } catch (cause) {
      const loadError = cause instanceof Error ? cause : new Error(String(cause));
      setThreadErrors((current) => ({ ...current, [threadRootId]: loadError }));
      console.error(`Error loading replies for comment ${threadRootId}:`, loadError);
    } finally {
      threadLoading.current.delete(threadRootId);
      setLoadingThreads((current) => ({ ...current, [threadRootId]: false }));
    }
  }, [postId]);

  useEffect(() => {
    currentPostId.current = postId;
    void Promise.resolve().then(() => {
      if (postId) return loadTopLevel(true);
      setTopLevelComments([]);
      setThreadReplies({});
      setCommentCount(0);
      setHasMoreTopLevel(false);
      setThreadErrors({});
    });
  }, [postId, loadTopLevel]);

  const updateComment = useCallback((commentId: string, update: (comment: CommentItem) => CommentItem) => {
    setTopLevelComments((current) =>
      current.map((comment) => comment.id === commentId ? update(comment) : comment)
    );
    setThreadReplies((current) => Object.fromEntries(
      Object.entries(current).map(([threadId, comments]) => [
        threadId,
        comments.map((comment) => comment.id === commentId ? update(comment) : comment),
      ])
    ));
  }, []);

  const addComment = useCallback((comment: CommentItem) => {
    if (comment.parent_comment_id) {
      const threadRootId = comment.parent_comment_id;
      setThreadReplies((current) => {
        const replies = current[threadRootId] ?? [];
        if (replies.some((item) => item.id === comment.id)) return current;
        return {
          ...current,
          [threadRootId]: [...replies, comment].sort((a, b) =>
            a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
          ),
        };
      });
    } else {
      setTopLevelComments((current) => {
        if (current.some((item) => item.id === comment.id)) return current;
        return [...current, comment].sort((a, b) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
        );
      });
    }
    setCommentCount((count) => count + 1);
  }, []);

  const data = useMemo(
    () => [...topLevelComments, ...Object.values(threadReplies).flat()],
    [topLevelComments, threadReplies]
  );

  const refetch = useCallback(() => loadTopLevel(true, true), [loadTopLevel]);

  return {
    data,
    topLevelComments,
    threadReplies,
    threadErrors,
    commentCount,
    isLoading,
    isLoadingMoreTopLevel,
    hasMoreTopLevel,
    isThreadLoading: (threadRootId: string) => Boolean(loadingThreads[threadRootId]),
    threadHasMore: (threadRootId: string) => threadHasMore[threadRootId] !== false,
    loadMoreTopLevel: () => loadTopLevel(false),
    loadMoreThreadReplies,
    addComment,
    updateComment,
    error,
    refetch,
  };
};
