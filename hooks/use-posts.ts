import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useIsFetching } from '@tanstack/react-query';
 import { useIsMutating, useMutationState } from '@tanstack/react-query';
  import { useMutation } from '@tanstack/react-query';
  import { mutationOptions } from '@tanstack/react-query';

 export const getPosts = async () => {
   const {data, error} = await supabase
   .from('Post')
   .select('*, user:User(id, username, avatar)')
   .order('created_at', {ascending: false});
   if(!error) return data;
}


export const usePosts = () => {
   const {data, isLoading, error, refetch} = useQuery({
    queryKey: ['posts'],
    queryFn: () => getPosts(),
   });


   return {data, isLoading, error, refetch};
 

   
}