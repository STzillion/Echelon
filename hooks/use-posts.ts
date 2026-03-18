import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useIsFetching } from '@tanstack/react-query';
import { Post } from '@/providers/PostsProvider';
 import { useIsMutating, useMutationState } from '@tanstack/react-query';
  import { useMutation } from '@tanstack/react-query';
  import { mutationOptions } from '@tanstack/react-query';

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
  const { data, isLoading, error, refetch } = useQuery<Post[], Error>({
    queryKey: ['posts'],
    queryFn: () => getPosts(),
  });

  return { data, isLoading, error, refetch };
};
