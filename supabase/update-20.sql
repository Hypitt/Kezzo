-- =====================================================================
-- Kezzo update 20: more contest options
--   * a competitor can withdraw their entry while the contest is open (then enter another photo or video)
--   * admins see every entry (including removed ones), can restore them, and can delete a contest
-- Run this in the Supabase SQL Editor AFTER update-19. Safe to run more than once.
-- =====================================================================
create or replace function public.withdraw_contest_entry(p_contest uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.contests where id = p_contest and now() > ends_at) then raise exception 'ended'; end if;
  delete from public.contest_entries where contest_id = p_contest and user_id = auth.uid() and not disqualified;
end; $$;
revoke all on function public.withdraw_contest_entry(uuid) from public, anon;
grant execute on function public.withdraw_contest_entry(uuid) to authenticated;

create or replace function public.admin_contest_entries(p_contest uuid)
returns table (post_id uuid, title text, author_id uuid, author_name text, likes integer, commenters integer, score integer, disqualified boolean, entered_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  with c as (select * from public.contests where id = p_contest),
  s as (
    select e.post_id, p.title, p.author_id, a.display_name as author_name, e.disqualified, e.created_at as entered_at,
           (select count(*) from public.post_likes l, c where l.post_id = e.post_id and l.user_id <> p.author_id
              and l.created_at >= c.starts_at and l.created_at <= c.ends_at)::int as likes,
           (select count(distinct m.author_id) from public.post_comments m, c where m.post_id = e.post_id and m.author_id <> p.author_id
              and m.created_at >= c.starts_at and m.created_at <= c.ends_at)::int as commenters
      from public.contest_entries e
      join public.posts p on p.id = e.post_id
      join public.profiles a on a.id = p.author_id
     where e.contest_id = p_contest
  )
  select s.post_id, s.title, s.author_id, s.author_name, s.likes, s.commenters, s.likes + s.commenters, s.disqualified, s.entered_at
    from s order by s.disqualified, (s.likes + s.commenters) desc, s.entered_at;
end; $$;
revoke all on function public.admin_contest_entries(uuid) from public, anon;
grant execute on function public.admin_contest_entries(uuid) to authenticated;

create or replace function public.admin_delete_contest(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.contests where id = p_id;
end; $$;
revoke all on function public.admin_delete_contest(uuid) from public, anon;
grant execute on function public.admin_delete_contest(uuid) to authenticated;
