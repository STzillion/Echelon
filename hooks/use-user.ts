import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useIsFetching } from '@tanstack/react-query';
import { Post, User } from '@/providers/PostsProvider';
 import { useIsMutating, useMutationState } from '@tanstack/react-query';
  import { useMutation } from '@tanstack/react-query';
  import { mutationOptions } from '@tanstack/react-query';

export const getUser = async (userId: string) => {
  if(!userId) return null;
  const { data, error } = await supabase.from('User').select().eq('id', userId);
  console.log(data);

  if (!error) return data[0];
};



export const useUser = (userId: string) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
  });

  return { data, isLoading, error, refetch };
};
