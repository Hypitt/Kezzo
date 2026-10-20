-- =====================================================================
-- Kezzo update 5: bigger uploads, like Instagram
-- Run this in the Supabase SQL Editor AFTER update-4.sql. Safe to run more than once.
--
--   * Videos: up to 60 minutes and 4 GB per file (Instagram feed videos: 60 minutes, 4 GB).
--   * Profile pictures: up to 10 MB (the app also shrinks them before upload, so any phone photo works).
--   * More phone formats accepted (m4v and 3gp videos, m4a/aac audio).
--
-- IMPORTANT: Supabase itself caps every file at 50 MB on the Free plan, and that cannot be raised.
-- For files bigger than 50 MB you need the Pro plan, then set
--   Storage > Settings > "Global file size limit" to 4 GB.
-- The bucket limits below can never go above that global limit.
-- =====================================================================

-- Profile pictures: 10 MB, still images only.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'avatars';

-- Post media (free and paid): 4 GB per file.
update storage.buckets
   set file_size_limit = 4294967296,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg',
         'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp']
 where id in ('media-public', 'media-paid');

-- Files shared in group chats: 4 GB as well.
update storage.buckets
   set file_size_limit = 4294967296,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/zip', 'text/plain', 'text/csv',
         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/webm', 'audio/ogg',
         'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp']
 where id = 'chat-files';

-- Videos can be up to 60 minutes long (was 30).
alter table public.posts drop constraint if exists posts_video_duration_ck;
alter table public.posts add constraint posts_video_duration_ck
  check (kind <> 'video' or (duration_seconds is not null and duration_seconds <= 3600));
