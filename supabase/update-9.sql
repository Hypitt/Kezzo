-- =====================================================================
-- Kezzo update 9: photo posts with up to 10 photos (swipe through them)
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-8. Safe to run more than once.
--
-- A photo post keeps its first photo in media_path (so everything that already works keeps working) and its other
-- photos, up to 9 more, in media_extra, in order. Paid photo posts: one unlock gives access to every photo of the post.
-- =====================================================================
alter table public.posts add column if not exists media_extra text[] not null default '{}';

create or replace function public.trg_post_media_extra() returns trigger
language plpgsql set search_path = public as $$
declare p text;
begin
  if cardinality(new.media_extra) = 0 then return new; end if;
  if new.kind <> 'photo' then raise exception 'invalid_media'; end if;
  if cardinality(new.media_extra) > 9 then raise exception 'too_many_photos'; end if;
  if (select count(distinct x) from unnest(new.media_extra) as x) <> cardinality(new.media_extra) then raise exception 'invalid_media'; end if;
  foreach p in array new.media_extra loop
    if p is null or p not like new.author_id::text || '/%' or p = new.media_path then raise exception 'invalid_media'; end if;
  end loop;
  return new;
end; $$;
drop trigger if exists post_media_extra on public.posts;
create trigger post_media_extra before insert or update of media_extra, kind, media_path on public.posts for each row execute function public.trg_post_media_extra();

-- Buyers can read every photo of a post they unlocked (not only the first one)
drop policy if exists "kezzo_storage_select_unlocked" on storage.objects;
create policy "kezzo_storage_select_unlocked" on storage.objects for select to authenticated
  using (bucket_id = 'media-paid'
         and exists (
           select 1 from public.post_unlocks u
             join public.posts p on p.id = u.post_id
            where u.user_id = auth.uid()
              and p.media_bucket = 'media-paid'
              and (p.media_path = storage.objects.name or storage.objects.name = any (p.media_extra))));
