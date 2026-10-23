-- =====================================================================
-- Kezzo update 21: contest entries must be NEW uploads (made after the contest started)
-- Run this in the Supabase SQL Editor AFTER update-19 and update-20. Safe to run more than once.
-- =====================================================================
create or replace function public.enter_contest(p_contest uuid, p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.contests;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select * into c from public.contests where id = p_contest;
  if not found then raise exception 'not_found'; end if;
  if now() < c.starts_at then raise exception 'not_started'; end if;
  if now() > c.ends_at then raise exception 'ended'; end if;
  if not exists (select 1 from public.posts p where p.id = p_post and p.author_id = me
                  and p.kind in ('photo', 'video') and p.media_bucket = 'media-public' and p.download_price = 0
                  and p.created_at >= c.starts_at) then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from public.contest_entries where contest_id = p_contest and user_id = me) then
    raise exception 'already_entered';
  end if;
  insert into public.contest_entries (contest_id, post_id, user_id) values (p_contest, p_post, me);
end; $$;
revoke all on function public.enter_contest(uuid, uuid) from public, anon;
grant execute on function public.enter_contest(uuid, uuid) to authenticated;
