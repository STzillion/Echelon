import { supabase } from '@/lib/supabase';
import { User } from '@/providers/PostsProvider';
import { useQuery } from '@tanstack/react-query';

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

export const getComments = async (postId: string): Promise<CommentItem[]> => {
  const { data, error } = await supabase
    .from('Comment')
    .select('*, speaker:User!speaker_id(*), likes:Like(*), reposts:Repost(*)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as unknown as CommentItem[]) ?? [];
};

export const useComments = (postId?: string) => {
  const { data, isLoading, error, refetch } = useQuery<CommentItem[], Error>({
    queryKey: ['comments', postId],
    queryFn: () => getComments(postId as string),
    enabled: !!postId,
  });

  return { data, isLoading, error, refetch };
};
