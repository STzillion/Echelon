import { usePosts } from '@/hooks/use-posts';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthProvider';

export type Post = {
  id: string;
  user_id: string;
  parent_id?: string | null;
  text: string;
  file: string;
  created_at: string;
  tag_name?: string | null;
  debate_side?: string | null;
  repost_user_id?: string | null;
  isDebate?: boolean | null;
  user?: User;
  repost_user?: {
    id: string;
    username: string;
    avatar?: string;
  };
  Post?: Post[]; //for replies
  likes?: { user_id: string }[]; // added to support like state
};
export type User = {
  id: string;
  username: string;
  avatar?: string;
};

export type Tag = {
  name: string;
};

export type Debate = {
  id: string;
  root_post_id: string;
  challenger_id: string;
  opponent_id: string;
  status: 'active' | 'completed';
  created_at: string;

};

interface PostsContextType {
  posts: Post[] | undefined;
  isLoading: boolean;
  error: any;
  refetch: () => void;
  addPost: (post: Post) => void;
  updatePost: (id: string, updates: Partial<Post>) => Promise<void>;
}

 export const PostsContext = createContext<PostsContextType | undefined>(undefined);

export const PostsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = usePosts();
  const queryClient = useQueryClient();
 // const {uploadFile} = useUploadFile();

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

  const updatePost = async (id: string, updates: Partial<Post>) => {
    // Update Supabase
    const { error } = await supabase
      .from('Post')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Update post error:', error);
      return;
    }

    // Update Query cache
    queryClient.setQueryData(['posts'], (old: Post[] | undefined) => {
      if (!old) return old;

      return old.map((post) =>
        post.id === id ? { ...post, ...updates } : post
      );
    });
  };


  return (
    <PostsContext.Provider value={{ posts: data as Post[] | undefined, isLoading, error, refetch, addPost, updatePost }}>
      {children}
    </PostsContext.Provider>
  );
};



export const usedPosts = () => {
  const context = useContext(PostsContext);
  if (!context) throw new Error('usePosts must be used within a PostsProvider');
  return context;
};
