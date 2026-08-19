
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import React, { useState } from 'react';
import { Post } from './PostsProvider';

export function useUploadFile() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (
    id: string,
    uri: string,
    type: string,
    name: string
  ): Promise<string | null> => {
    try {
      setIsUploading(true);

      const res = await fetch(uri);
      const arrayBuffer = await res.arrayBuffer();

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const authUid = authUser?.id;

      const path = `${id}/${name}`;
      console.log('=== UPLOAD DEBUG ===');
      console.log('Uploading to path:', path);
      console.log('ID passed:', id);
      console.log('Auth UID from Supabase:', authUid);
      console.log('IDs match?', id === authUid);
      console.log('Bucket: files');
      console.log('Content type:', type);
      console.log('====================');

      const { error } = await supabase.storage
        .from('files')
        .upload(`${id}/${name}`, arrayBuffer, {
          contentType: type,
          upsert: true,
        });

      if (error) throw error;
      return name;
    } catch (err) {
      console.error('Upload failed:', err);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadFile, isUploading };
}

export const PostContext = React.createContext({
  addpost: (post: Post) => {},
  useUploadFile: (id: string, uri: string, type: string | null, name: string) => () => Promise.resolve<string | null>(null),
  
});
