import { supabase } from '@/lib/supabase';
import { Post } from '@/providers/PostsProvider';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const getPosts = async (): Promise<Post[]> => {
  const { data, error } = await supabase
    .from('Post')
    //
    .select(
      '*, user:User!user_id(*),' + 'repost_user:User!repost_user_id(*),  likes:Like(*)'
    )
    // .is('parent_id', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as unknown as Post[]) ?? [];
};



export const usePosts = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery<Post[], Error>({
    queryKey: ['posts'],
    queryFn: () => getPosts(),
    select: (posts) => {
      const previousPosts = queryClient.getQueryData<Post[]>(['posts']);
      if (!previousPosts?.length) return posts;

      const previousMap = new Map(previousPosts.map((post) => [post.id, post]));

      return posts.map((post) => {
        const previousPost = previousMap.get(post.id);
        if (previousPost?.isDebate != null) {
          return { ...post, isDebate: previousPost.isDebate };
        }
        return post;
      });
    },
  });

  return { data, isLoading, error, refetch };
};
