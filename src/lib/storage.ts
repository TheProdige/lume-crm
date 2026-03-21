import { supabase } from './supabase';

export const STORAGE_BUCKETS = {
  COMPANY_LOGOS: 'company-logos',
  JOB_PHOTOS: 'job-photos',
  ATTACHMENTS: 'attachments',
} as const;

/**
 * Upload a file to Supabase Storage.
 * Returns the public URL and storage path on success.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ url: string; path: string }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) throw error;

  const url = getPublicUrl(bucket, data.path);
  return { url, path: data.path };
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

/**
 * Get the public URL for a file in Supabase Storage.
 */
export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
