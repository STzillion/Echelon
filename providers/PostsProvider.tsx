import React, { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import {getPosts} from '@/hooks/use-posts'

export type Post = {
  id: string;
  user_id: string;
  text: string;
  file: string;
  created_at: string;
  user?: {
    id: string;
    username: string;
    avatar?: string;
  };
};

interface PostsContextType {
  posts: Post[] | undefined;
  isLoading: boolean;
  error: any;
  refetch: () => void;
  addPost: (post: Post) => void;
}

const PostsContext = createContext<PostsContextType | undefined>(undefined);

export const PostsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = require('@/hooks/use-posts').usePosts();
  const queryClient = useQueryClient();

  // Optimistically update posts list in Query cache
  const addPost = (post: Post) => {
    queryClient.setQueryData(['posts'], (old: Post[] | undefined) => {
      if (old) {
        return [post, ...old];
      } else {
        return [post];
      }
    });
  };

  return (
    <PostsContext.Provider value={{ posts: data, isLoading, error, refetch, addPost }}>
      {children}
    </PostsContext.Provider>
  );
};

export const usedPosts = () => {
  const context = useContext(PostsContext);
  if (!context) throw new Error('usePosts must be used within a PostsProvider');
  return context;
};
