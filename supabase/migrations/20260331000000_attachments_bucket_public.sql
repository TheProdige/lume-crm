-- ============================================================
-- Make the attachments bucket public so uploaded images/files
-- are accessible via public URL (needed for note board images).
-- The bucket currently has RLS policies restricting write to
-- authenticated users, which remains unchanged.
-- ============================================================

UPDATE storage.buckets
SET public = true
WHERE id = 'attachments';
