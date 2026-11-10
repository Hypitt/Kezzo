-- =====================================================================
-- Kezzo update 39: many contests at once, contests created by members, and contest owners who moderate
--   * Any signed-in member can create a contest (limit: 3 unfinished contests each, at most 90 days long).
--     Kezzo admins create official contests and can hide any contest.
--   * Several contests can run at the same time. A post can only be entered once per contest.
--   * contest_list() tells each person which contests they ENTERED and which they VOTED in (liked or commented on an entry).
--   * Owners (and admins) can edit, end or delete their contest, remove an entry, and stop a person from entering.
-- Run in the Supabase SQL Editor AFTER update-19, 20 and 21. Safe to run more than once.
-- =====================================================================
alter table public.contests add column if not exists owner_id uuid references public.profiles (id) on delete set null;
alter table public.contests add column if not exists official boolean not null default false;
alter table public.contests add column if not exists hidden boolean not null default false;
-- The contests that already exist were made by Kezzo admins.
update public.contests set official = true where owner_id is null and not official;
create index if not exists contests_owner_idx on public.contests (owner_id);

create table if not exists public.contest_bans (
  contest_id uuid not null references public.contests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contest_id, user_id)
);
alter table public.contest_bans enable row level security;
revoke all on public.contest_bans from anon, authenticated;

-- Contests are now read through the functions below (they hide the ones an admin hid).
revoke select on public.contests from anon, authenticated;

create or replace function public.can_manage_contest(p_contest uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_admin() or exists (select 1 from public.contests c where c.id = p_contest and c.owner_id = auth.uid()));
$$;
revoke all on function public.can_manage_contest(uuid) from public, anon;
grant execute on function public.can_manage_contest(uuid) to authenticated;

-- Every contest the person may see, with their own "entered" and "voted" marks. One contest when p_id is given.
drop function if exists public.contest_list(uuid);
create or replace function public.contest_list(p_id uuid default null)
returns table (
  id uuid, title text, theme text, prize text, rules text, starts_at timestamptz, ends_at timestamptz,
  owner_id uuid, owner_name text, official boolean, hidden boolean, entries integer,
  entered boolean, voted boolean, can_manage boolean, phase text
) language sql stable security definer set search_path = public as $$
  select c.id, c.title, c.theme, c.prize, c.rules, c.starts_at, c.ends_at, c.owner_id, o.display_name, c.official, c.hidden,
         (select count(*) from public.contest_entries e where e.contest_id = c.id and not e.disqualified)::int,
         exists (select 1 from public.contest_entries e where e.contest_id = c.id and e.user_id = auth.uid() and not e.disqualified),
         exists (select 1 from public.contest_entries e join public.posts p on p.id = e.post_id
                  where e.contest_id = c.id and not e.disqualified and p.author_id <> auth.uid()
                    and (exists (select 1 from public.post_likes l where l.post_id = e.post_id and l.user_id = auth.uid()
                                   and l.created_at >= c.starts_at and l.created_at <= c.ends_at)
                      or exists (select 1 from public.post_comments m where m.post_id = e.post_id and m.author_id = auth.uid()
                                   and m.created_at >= c.starts_at and m.created_at <= c.ends_at))),
         public.can_manage_contest(c.id),
         case when now() < c.starts_at then 'soon' when now() > c.ends_at then 'ended' else 'open' end
    from public.contests c
    left join public.profiles o on o.id = c.owner_id
   where (p_id is null or c.id = p_id)
     and (not c.hidden or c.owner_id = auth.uid() or public.is_admin())
   order by case when now() between c.starts_at and c.ends_at then 0 when now() < c.starts_at then 1 else 2 end,
            case when now() <= c.ends_at then c.ends_at end asc nulls last, c.ends_at desc
   limit 200;
$$;
revoke all on function public.contest_list(uuid) from public;
grant execute on function public.contest_list(uuid) to anon, authenticated;

-- The one contest shown on the landing page and Home: an open one first (official ones first), else the next, else the last.
create or replace function public.contest_current()
returns setof public.contests language sql stable security definer set search_path = public as $$
  select * from public.contests c where not c.hidden
   order by case when now() between c.starts_at and c.ends_at then 0 when now() < c.starts_at then 1 else 2 end,
            c.official desc, case when now() <= c.ends_at then c.ends_at end asc nulls last, c.ends_at desc
   limit 1;
$$;
revoke all on function public.contest_current() from public;
grant execute on function public.contest_current() to anon, authenticated;

-- Rank and score of every entry of every recent contest, so a post can show its badge.
create or replace function public.contest_entry_ranks()
returns table (post_id uuid, contest_id uuid, contest_title text, rank integer, score integer, winner boolean)
language sql stable security definer set search_path = public as $$
  with s as (
    select c.id as cid, c.title as ctitle, c.ends_at, e.post_id as pid, e.created_at as entered_at,
           (select count(*) from public.post_likes l where l.post_id = e.post_id and l.user_id <> p.author_id
              and l.created_at >= c.starts_at and l.created_at <= c.ends_at)::int
         + (select count(distinct m.author_id) from public.post_comments m where m.post_id = e.post_id and m.author_id <> p.author_id
              and m.created_at >= c.starts_at and m.created_at <= c.ends_at)::int as pts
      from public.contests c
      join public.contest_entries e on e.contest_id = c.id and not e.disqualified
      join public.posts p on p.id = e.post_id
     where not c.hidden and c.ends_at > now() - interval '30 days'
  ), r as (
    select s.*, (row_number() over (partition by s.cid order by s.pts desc, s.entered_at asc))::int as rk from s
  )
  select r.pid, r.cid, r.ctitle, r.rk, r.pts, (now() > r.ends_at and r.rk = 1) from r;
$$;
revoke all on function public.contest_entry_ranks() from public;
grant execute on function public.contest_entry_ranks() to anon, authenticated;

-- Entering: the contest must not be hidden, and the person must not be stopped from entering it.
create or replace function public.enter_contest(p_contest uuid, p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.contests;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select * into c from public.contests where id = p_contest and not hidden;
  if not found then raise exception 'not_found'; end if;
  if now() < c.starts_at then raise exception 'not_started'; end if;
  if now() > c.ends_at then raise exception 'ended'; end if;
  if exists (select 1 from public.contest_bans where contest_id = p_contest and user_id = me) then raise exception 'banned'; end if;
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

-- Create (p_id null) or change a contest. Members: 3 unfinished contests at most, 90 days at most.
create or replace function public.save_contest(
  p_id uuid, p_title text, p_theme text, p_prize text, p_rules text, p_starts timestamptz, p_ends timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rid uuid; adm boolean;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  adm := public.is_admin();
  if p_ends <= p_starts then raise exception 'bad_dates'; end if;
  if not adm and p_ends > p_starts + interval '90 days' then raise exception 'too_long'; end if;
  if p_id is null then
    if not adm and (select count(*) from public.contests where owner_id = me and ends_at > now()) >= 3 then raise exception 'too_many'; end if;
    insert into public.contests (title, theme, prize, rules, starts_at, ends_at, owner_id, official)
    values (trim(p_title), coalesce(p_theme, ''), coalesce(p_prize, ''), coalesce(p_rules, ''), p_starts, p_ends, me, adm) returning id into rid;
  else
    if not public.can_manage_contest(p_id) then raise exception 'forbidden'; end if;
    update public.contests set title = trim(p_title), theme = coalesce(p_theme, ''), prize = coalesce(p_prize, ''),
           rules = coalesce(p_rules, ''), starts_at = p_starts, ends_at = p_ends where id = p_id returning id into rid;
  end if;
  return rid;
end; $$;
revoke all on function public.save_contest(uuid, text, text, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.save_contest(uuid, text, text, text, text, timestamptz, timestamptz) to authenticated;

create or replace function public.delete_contest(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_contest(p_id) then raise exception 'forbidden'; end if;
  delete from public.contests where id = p_id;
end; $$;
revoke all on function public.delete_contest(uuid) from public, anon;
grant execute on function public.delete_contest(uuid) to authenticated;

create or replace function public.moderate_contest_entry(p_contest uuid, p_post uuid, p_flag boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_contest(p_contest) then raise exception 'forbidden'; end if;
  update public.contest_entries set disqualified = coalesce(p_flag, true) where contest_id = p_contest and post_id = p_post;
end; $$;
revoke all on function public.moderate_contest_entry(uuid, uuid, boolean) from public, anon;
grant execute on function public.moderate_contest_entry(uuid, uuid, boolean) to authenticated;

-- Stop (or allow again) a person from entering this contest. Stopping also removes their current entry.
create or replace function public.contest_ban_user(p_contest uuid, p_user uuid, p_flag boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_contest(p_contest) then raise exception 'forbidden'; end if;
  if coalesce(p_flag, true) then
    insert into public.contest_bans (contest_id, user_id) values (p_contest, p_user) on conflict do nothing;
    update public.contest_entries set disqualified = true where contest_id = p_contest and user_id = p_user;
  else
    delete from public.contest_bans where contest_id = p_contest and user_id = p_user;
  end if;
end; $$;
revoke all on function public.contest_ban_user(uuid, uuid, boolean) from public, anon;
grant execute on function public.contest_ban_user(uuid, uuid, boolean) to authenticated;

-- All entries (including removed ones) for the owner or an admin
create or replace function public.manage_contest_entries(p_contest uuid)
returns table (post_id uuid, title text, author_id uuid, author_name text, likes integer, commenters integer, score integer,
               disqualified boolean, banned boolean, entered_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_contest(p_contest) then raise exception 'forbidden'; end if;
  return query
  with c as (select * from public.contests where id = p_contest),
  s as (
    select e.post_id, p.title, p.author_id, a.display_name as author_name, e.disqualified, e.created_at as entered_at,
           exists (select 1 from public.contest_bans b where b.contest_id = p_contest and b.user_id = p.author_id) as banned,
           (select count(*) from public.post_likes l, c where l.post_id = e.post_id and l.user_id <> p.author_id
              and l.created_at >= c.starts_at and l.created_at <= c.ends_at)::int as likes,
           (select count(distinct m.author_id) from public.post_comments m, c where m.post_id = e.post_id and m.author_id <> p.author_id
              and m.created_at >= c.starts_at and m.created_at <= c.ends_at)::int as commenters
      from public.contest_entries e
      join public.posts p on p.id = e.post_id
      join public.profiles a on a.id = p.author_id
     where e.contest_id = p_contest
  )
  select s.post_id, s.title, s.author_id, s.author_name, s.likes, s.commenters, s.likes + s.commenters, s.disqualified, s.banned, s.entered_at
    from s order by s.disqualified, (s.likes + s.commenters) desc, s.entered_at;
end; $$;
revoke all on function public.manage_contest_entries(uuid) from public, anon;
grant execute on function public.manage_contest_entries(uuid) to authenticated;

-- Kezzo admins: hide a contest from everyone (or show it again)
create or replace function public.admin_hide_contest(p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.contests set hidden = coalesce(p_hidden, true) where id = p_id;
end; $$;
revoke all on function public.admin_hide_contest(uuid, boolean) from public, anon;
grant execute on function public.admin_hide_contest(uuid, boolean) to authenticated;

-- The older admin functions keep working and follow the same rules.
create or replace function public.admin_save_contest(
  p_id uuid, p_title text, p_theme text, p_prize text, p_rules text, p_starts timestamptz, p_ends timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return public.save_contest(p_id, p_title, p_theme, p_prize, p_rules, p_starts, p_ends);
end; $$;
revoke all on function public.admin_save_contest(uuid, text, text, text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_save_contest(uuid, text, text, text, text, timestamptz, timestamptz) to authenticated;
