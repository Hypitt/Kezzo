-- =====================================================================
-- Kezzo update 41: contest winners
--   * The owner chooses how many winners (1 to 10) and an optional prize for each place.
--   * When a contest ends, its winners are shown first: on the contest page, at the top of the contests list
--     and on the public page.
--   * The owner (and admins) can open a winners report and download it.
-- Run in the Supabase SQL Editor AFTER update-40. Safe to run more than once.
-- =====================================================================
alter table public.contests add column if not exists winner_count integer not null default 1;
alter table public.contests add column if not exists place_prizes text[] not null default '{}';
alter table public.contests drop constraint if exists contests_winner_count_ok;
alter table public.contests add constraint contests_winner_count_ok check (winner_count between 1 and 10);
alter table public.contests drop constraint if exists contests_place_prizes_ok;
alter table public.contests add constraint contests_place_prizes_ok check (cardinality(place_prizes) <= 10);

-- save_contest now also takes the number of winners and the prize of each place
drop function if exists public.save_contest(uuid, text, text, text, text, timestamptz, timestamptz);
create or replace function public.save_contest(
  p_id uuid, p_title text, p_theme text, p_prize text, p_rules text, p_starts timestamptz, p_ends timestamptz,
  p_winner_count integer default 1, p_place_prizes text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rid uuid; adm boolean; wc integer; pp text[];
begin
  if me is null then raise exception 'not_signed_in'; end if;
  adm := public.is_admin();
  if p_ends <= p_starts then raise exception 'bad_dates'; end if;
  if not adm and p_ends > p_starts + interval '90 days' then raise exception 'too_long'; end if;
  wc := least(greatest(coalesce(p_winner_count, 1), 1), 10);
  -- one entry per place, trimmed and kept short; places past the last winner are dropped
  select coalesce(array_agg(left(trim(x), 80) order by ord), '{}') into pp
    from unnest(coalesce(p_place_prizes, '{}')) with ordinality as t(x, ord) where ord <= wc;
  if p_id is null then
    if not adm and (select count(*) from public.contests where owner_id = me and ends_at > now()) >= 3 then raise exception 'too_many'; end if;
    insert into public.contests (title, theme, prize, rules, starts_at, ends_at, owner_id, official, winner_count, place_prizes)
    values (trim(p_title), coalesce(p_theme, ''), coalesce(p_prize, ''), coalesce(p_rules, ''), p_starts, p_ends, me, adm, wc, pp)
    returning id into rid;
  else
    if not public.can_manage_contest(p_id) then raise exception 'forbidden'; end if;
    update public.contests set title = trim(p_title), theme = coalesce(p_theme, ''), prize = coalesce(p_prize, ''),
           rules = coalesce(p_rules, ''), starts_at = p_starts, ends_at = p_ends, winner_count = wc, place_prizes = pp
     where id = p_id returning id into rid;
  end if;
  return rid;
end; $$;
revoke all on function public.save_contest(uuid, text, text, text, text, timestamptz, timestamptz, integer, text[]) from public, anon;
grant execute on function public.save_contest(uuid, text, text, text, text, timestamptz, timestamptz, integer, text[]) to authenticated;

-- (the older admin wrapper keeps its shape and uses one winner)
create or replace function public.admin_save_contest(
  p_id uuid, p_title text, p_theme text, p_prize text, p_rules text, p_starts timestamptz, p_ends timestamptz
) returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return public.save_contest(p_id, p_title, p_theme, p_prize, p_rules, p_starts, p_ends, 1, '{}');
end; $$;

-- The contest list now also says how many winners and the prizes
drop function if exists public.contest_list(uuid);
create or replace function public.contest_list(p_id uuid default null)
returns table (
  id uuid, title text, theme text, prize text, rules text, starts_at timestamptz, ends_at timestamptz,
  owner_id uuid, owner_name text, official boolean, hidden boolean, entries integer,
  entered boolean, voted boolean, can_manage boolean, phase text, winner_count integer, place_prizes text[]
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
         case when now() < c.starts_at then 'soon' when now() > c.ends_at then 'ended' else 'open' end,
         c.winner_count, c.place_prizes
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

-- Badges: every winning place counts as a winner once the contest has ended
create or replace function public.contest_entry_ranks()
returns table (post_id uuid, contest_id uuid, contest_title text, rank integer, score integer, winner boolean)
language sql stable security definer set search_path = public as $$
  with s as (
    select c.id as cid, c.title as ctitle, c.ends_at, c.winner_count as wc, e.post_id as pid, e.created_at as entered_at,
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
  select r.pid, r.cid, r.ctitle, r.rk, r.pts, (now() > r.ends_at and r.rk <= r.wc) from r;
$$;
revoke all on function public.contest_entry_ranks() from public;
grant execute on function public.contest_entry_ranks() to anon, authenticated;

-- The winners of finished contests: one contest, or (without an id) every contest that ended in the last 30 days, newest first.
create or replace function public.contest_winners(p_contest uuid default null)
returns table (contest_id uuid, contest_title text, ends_at timestamptz, place integer, prize text, post_id uuid, kind text,
               media_path text, title text, author_id uuid, author_name text, author_avatar text, score integer)
language sql stable security definer set search_path = public as $$
  with c as (
    select * from public.contests k
     where not k.hidden and now() > k.ends_at
       and ((p_contest is null and k.ends_at > now() - interval '30 days') or k.id = p_contest)
  ), s as (
    select c.id as cid, c.title as ctitle, c.ends_at as cend, c.winner_count as wc, c.place_prizes as pp,
           e.post_id as pid, e.created_at as entered_at, p.kind::text as pkind, p.media_path as pmedia, p.title as ptitle,
           p.author_id as aid, a.display_name as aname, a.avatar_url as aavatar,
           (select count(*) from public.post_likes l where l.post_id = e.post_id and l.user_id <> p.author_id
              and l.created_at >= c.starts_at and l.created_at <= c.ends_at)::int
         + (select count(distinct m.author_id) from public.post_comments m where m.post_id = e.post_id and m.author_id <> p.author_id
              and m.created_at >= c.starts_at and m.created_at <= c.ends_at)::int as pts
      from c
      join public.contest_entries e on e.contest_id = c.id and not e.disqualified
      join public.posts p on p.id = e.post_id
      join public.profiles a on a.id = p.author_id
  ), r as (
    select s.*, (row_number() over (partition by s.cid order by s.pts desc, s.entered_at asc))::int as rk from s
  )
  select r.cid, r.ctitle, r.cend, r.rk, coalesce(r.pp[r.rk], ''), r.pid, r.pkind, r.pmedia, r.ptitle, r.aid, r.aname, r.aavatar, r.pts
    from r where r.rk <= r.wc order by r.cend desc, r.cid, r.rk;
$$;
revoke all on function public.contest_winners(uuid) from public;
grant execute on function public.contest_winners(uuid) to anon, authenticated;

-- The owner's report: totals and the winners (the current top places while the contest is still running)
create or replace function public.contest_report(p_contest uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c public.contests; result jsonb;
begin
  if not public.can_manage_contest(p_contest) then raise exception 'forbidden'; end if;
  select * into c from public.contests where id = p_contest;
  with s as (
    select e.post_id as pid, e.created_at as entered_at, p.title as ptitle, p.author_id as aid, a.display_name as aname, a.handle as ahandle,
           (select count(*) from public.post_likes l where l.post_id = e.post_id and l.user_id <> p.author_id
              and l.created_at >= c.starts_at and l.created_at <= c.ends_at)::int as likes,
           (select count(distinct m.author_id) from public.post_comments m where m.post_id = e.post_id and m.author_id <> p.author_id
              and m.created_at >= c.starts_at and m.created_at <= c.ends_at)::int as commenters
      from public.contest_entries e
      join public.posts p on p.id = e.post_id
      join public.profiles a on a.id = p.author_id
     where e.contest_id = p_contest and not e.disqualified
  ), r as (
    select s.*, s.likes + s.commenters as pts, (row_number() over (order by s.likes + s.commenters desc, s.entered_at asc))::int as rk from s
  ), voters as (
    select count(distinct v.uid)::int as n from (
      select l.user_id as uid from public.post_likes l join public.contest_entries e on e.post_id = l.post_id and e.contest_id = p_contest and not e.disqualified
        join public.posts p on p.id = e.post_id
       where l.user_id <> p.author_id and l.created_at >= c.starts_at and l.created_at <= c.ends_at
      union
      select m.author_id from public.post_comments m join public.contest_entries e on e.post_id = m.post_id and e.contest_id = p_contest and not e.disqualified
        join public.posts p on p.id = e.post_id
       where m.author_id <> p.author_id and m.created_at >= c.starts_at and m.created_at <= c.ends_at
    ) v
  )
  select jsonb_build_object(
    'title', c.title,
    'phase', case when now() < c.starts_at then 'soon' when now() > c.ends_at then 'ended' else 'open' end,
    'starts_at', c.starts_at, 'ends_at', c.ends_at, 'winner_count', c.winner_count,
    'totals', jsonb_build_object('entries', (select count(*) from r), 'likes', coalesce((select sum(likes) from r), 0),
                                 'commenters', coalesce((select sum(commenters) from r), 0), 'voters', (select n from voters)),
    'winners', coalesce((select jsonb_agg(jsonb_build_object(
        'place', r.rk, 'prize', coalesce(c.place_prizes[r.rk], ''), 'post_id', r.pid, 'post_title', r.ptitle,
        'author_id', r.aid, 'author_name', r.aname, 'handle', r.ahandle, 'score', r.pts, 'likes', r.likes,
        'commenters', r.commenters, 'entered_at', r.entered_at) order by r.rk) from r where r.rk <= c.winner_count), '[]'::jsonb))
    into result;
  return result;
end; $$;
revoke all on function public.contest_report(uuid) from public, anon;
grant execute on function public.contest_report(uuid) to authenticated;
