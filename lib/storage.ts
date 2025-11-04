// lib/storage.ts
import { supabase } from '@/lib/supabase';

export function publicFileUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl; // https://...supabase.co/storage/v1/object/public/<bucket>/<path>
}
