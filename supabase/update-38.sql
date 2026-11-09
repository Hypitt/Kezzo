-- Update 38: voice messages in direct messages and in post comments.
-- (Group chat already accepts audio files, so it needs nothing new.)
-- Safe to run more than once.

-- 1. Comments: an optional voice recording (stored in the public media bucket, under the author's own folder)
alter table public.post_comments add column if not exists audio_path text;
alter table public.post_comments add column if not exists audio_seconds int;

do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.post_comments'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%char_length(body)%' loop
    execute format('alter table public.post_comments drop constraint %I', c);
  end loop;
end $$;

alter table public.post_comments drop constraint if exists post_comments_text_or_voice;
alter table public.post_comments add constraint post_comments_text_or_voice
  check (char_length(body) <= 500 and (char_length(body) >= 1 or audio_path is not null));
alter table public.post_comments drop constraint if exists post_comments_voice_ok;
alter table public.post_comments add constraint post_comments_voice_ok
  check (audio_path is null or (char_length(audio_path) <= 200 and audio_path like author_id::text || '/%'
         and (audio_seconds is null or audio_seconds between 0 and 600)));

-- 2. Direct messages: an optional voice recording (stored privately; only the two people can open it)
alter table public.direct_messages add column if not exists audio_path text;
alter table public.direct_messages add column if not exists audio_seconds int;

do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.direct_messages'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%char_length(body)%' loop
    execute format('alter table public.direct_messages drop constraint %I', c);
  end loop;
end $$;

alter table public.direct_messages drop constraint if exists direct_messages_text_or_voice;
alter table public.direct_messages add constraint direct_messages_text_or_voice
  check (char_length(body) <= 1000 and (char_length(body) >= 1 or audio_path is not null));
alter table public.direct_messages drop constraint if exists direct_messages_voice_ok;
alter table public.direct_messages add constraint direct_messages_voice_ok
  check (audio_path is null or (char_length(audio_path) <= 200
         and audio_path like 'dm/' || sender_id::text || '/' || recipient_id::text || '/%'
         and (audio_seconds is null or audio_seconds between 0 and 600)));

-- 3. Private storage for direct-message recordings:  dm/<sender id>/<recipient id>/<file>
drop policy if exists "kezzo_dmfiles_insert" on storage.objects;
create policy "kezzo_dmfiles_insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = 'dm'
  and (storage.foldername(name))[2] = auth.uid()::text
  and (storage.foldername(name))[3] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_dm(auth.uid(), ((storage.foldername(name))[3])::uuid));

drop policy if exists "kezzo_dmfiles_select" on storage.objects;
create policy "kezzo_dmfiles_select" on storage.objects for select to authenticated using (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = 'dm'
  and (auth.uid()::text = (storage.foldername(name))[2] or auth.uid()::text = (storage.foldername(name))[3]));

drop policy if exists "kezzo_dmfiles_delete" on storage.objects;
create policy "kezzo_dmfiles_delete" on storage.objects for delete to authenticated using (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = 'dm'
  and (storage.foldername(name))[2] = auth.uid()::text);
