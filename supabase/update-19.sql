-- =====================================================================
-- Kezzo update 19: contests (submit a photo or video, the audience likes and comments, highest score wins)
--   * contests: one row per contest, created by an admin from the Contest page
--   * contest_entries: one entry per person per contest
--   * Score = people who liked the entry + people who commented on it, counted only during the contest and never
--     counting the entry's own author. Ties go to the earlier entry. Visitor (not signed in) likes do not count.
-- Run this in the Supabase SQL Editor AFTER update-4 (admins) and the earlier updates. Safe to run more than once.
-- =====================================================================
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 80),
  theme text not null default '' check (char_length(theme) <= 200),
  prize text not null default '' check (char_length(prize) <= 120),
  rules text not null default '' check (char_length(rules) <= 3000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.contest_entries (
  contest_id uuid not null references public.contests (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  disqualified boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (contest_id, post_id),
  unique (contest_id, user_id)
);
alter table public.contests enable row level security;
alter table public.contest_entries enable row level security;
revoke all on public.contests, public.contest_entries from anon, authenticated;
grant select on public.contests, public.contest_entries to anon, authenticated;
drop policy if exists contests_select on public.contests;
create policy contests_select on public.contests for select using (true);
drop policy if exists contest_entries_select on public.contest_entries;
create policy contest_entries_select on public.contest_entries for select using (true);

-- The newest contest (anyone can see it, signed in or not)
create or replace function public.contest_current()
returns setof public.contests language sql stable security definer set search_path = public as $$
  select * from public.contests order by starts_at desc limit 1;
$$;
revoke all on function public.contest_current() from public;
grant execute on function public.contest_current() to anon, authenticated;

-- The ranking. Visible to everyone.
create or replace function public.contest_board(p_contest uuid)
returns table (
  rank integer, post_id uuid, kind text, title text, media_path text, author_id uuid, author_name text,
  author_avatar text, likes integer, commenters integer, score integer, entered_at timestamptz
) language sql stable security definer set search_path = public as $$
  with c as (select * from public.contests where id = p_contest),
  s as (
    select e.post_id, e.created_at as entered_at, p.kind, p.title, p.media_path, p.author_id,
           a.display_name as author_name, a.avatar_url as author_avatar,
           (select count(*) from public.post_likes l, c
             where l.post_id = e.post_id and l.user_id <> p.author_id
               and l.created_at >= c.starts_at and l.created_at <= c.ends_at)::int as likes,
           (select count(distinct m.author_id) from public.post_comments m, c
             where m.post_id = e.post_id and m.author_id <> p.author_id
               and m.created_at >= c.starts_at and m.created_at <= c.ends_at)::int as commenters
      from public.contest_entries e
      join public.posts p on p.id = e.post_id
      join public.profiles a on a.id = p.author_id
     where e.contest_id = p_contest and not e.disqualified
  )
  select (row_number() over (order by (s.likes + s.commenters) desc, s.entered_at asc))::int,
         s.post_id, s.kind, s.title, s.media_path, s.author_id, s.author_name, s.author_avatar,
         s.likes, s.commenters, s.likes + s.commenters, s.entered_at
    from s
   order by 1;
$$;
revoke all on function public.contest_board(uuid) from public;
grant execute on function public.contest_board(uuid) to anon, authenticated;

-- A member enters one of their own free, public photos or videos while the contest is open
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
                  and p.kind in ('photo', 'video') and p.media_bucket = 'media-public' and p.download_price = 0) then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from public.contest_entries where contest_id = p_contest and user_id = me) then
    raise exception 'already_entered';
  end if;
  insert into public.contest_entries (contest_id, post_id, user_id) values (p_contest, p_post, me);
end; $$;
revoke all on function public.enter_contest(uuid, uuid) from public, anon;
grant execute on function public.enter_contest(uuid, uuid) to authenticated;

-- Admin only: create or change a contest
create or replace function public.admin_save_contest(
  p_id uuid, p_title text, p_theme text, p_prize text, p_rules text, p_starts timestamptz, p_ends timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_id is null then
    insert into public.contests (title, theme, prize, rules, starts_at, ends_at)
    values (p_title, coalesce(p_theme, ''), coalesce(p_prize, ''), coalesce(p_rules, ''), p_starts, p_ends) returning id into rid;
  else
    update public.contests set title = p_title, theme = coalesce(p_theme, ''), prize = coalesce(p_prize, ''),
           rules = coalesce(p_rules, ''), starts_at = p_starts, ends_at = p_ends where id = p_id returning id into rid;
  end if;
  return rid;
end; $$;
revoke all on function public.admin_save_contest(uuid, text, text, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_save_contest(uuid, text, text, text, text, timestamptz, timestamptz) to authenticated;

-- Admin only: remove (or restore) a cheating or off-topic entry
create or replace function public.admin_disqualify_entry(p_contest uuid, p_post uuid, p_flag boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.contest_entries set disqualified = coalesce(p_flag, true) where contest_id = p_contest and post_id = p_post;
end; $$;
revoke all on function public.admin_disqualify_entry(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_disqualify_entry(uuid, uuid, boolean) to authenticated;
