-- =====================================================================
-- Kezzo update 2  (run AFTER schema.sql; safe to run more than once)
--
--   * Groups: roles (owner / admin / member), invite-only option, invite links,
--     add / remove members, file sharing in group chat
--   * Battles: free likes, 2-coin and 5-coin votes, up to 3 public judges with
--     scores and comments, public / judges weighting, final scores,
--     "host only" mode, mute control, round timer
--   * Media: bigger upload limits (the real cap is your Supabase plan)
--   * Status pictures
--
-- How to run: Supabase Dashboard > SQL Editor > New query > paste > Run.
-- =====================================================================

-- Small helper: drop an unnamed CHECK constraint whose definition matches a pattern.
create or replace function pg_temp.drop_check(tbl regclass, pattern text) returns void
language plpgsql as $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = tbl and contype = 'c' and pg_get_constraintdef(oid) like pattern
  loop
    execute format('alter table %s drop constraint %I', tbl, c.conname);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Profiles: status picture
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists status_image_url text
  check (status_image_url is null or char_length(status_image_url) <= 600);
grant update (status_image_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Posts: longer videos (up to 30 minutes)
-- ---------------------------------------------------------------------
select pg_temp.drop_check('public.posts', '%duration_seconds <= 90%');
alter table public.posts drop constraint if exists posts_video_duration_ck;
alter table public.posts add constraint posts_video_duration_ck
  check (kind <> 'video' or (duration_seconds is not null and duration_seconds <= 1800));

-- ---------------------------------------------------------------------
-- Groups: roles, join policy, invite links
-- ---------------------------------------------------------------------
alter table public.group_members add column if not exists role text not null default 'member';
select pg_temp.drop_check('public.group_members', '%role%');
alter table public.group_members add constraint group_members_role_ck check (role in ('owner', 'admin', 'member'));
update public.group_members gm set role = 'owner'
  from public.groups g where g.id = gm.group_id and g.owner_id = gm.user_id and gm.role <> 'owner';

alter table public.groups add column if not exists join_policy text not null default 'open';
select pg_temp.drop_check('public.groups', '%join_policy%');
alter table public.groups add constraint groups_join_policy_ck check (join_policy in ('open', 'invite'));
grant update (join_policy) on public.groups to authenticated;

create table if not exists public.group_invites (
  group_id uuid primary key references public.groups (id) on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
);
insert into public.group_invites (group_id) select id from public.groups on conflict do nothing;

create or replace function public.is_group_admin(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
     where group_id = p_group and user_id = auth.uid() and role in ('owner', 'admin'));
$$;

create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner');
  insert into public.group_invites (group_id) values (new.id);
  return new;
end $$;

-- Add a person to a group (owner / admin only).
create or replace function public.add_group_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_group_admin(p_group) then raise exception 'not_admin'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'not_found'; end if;
  if exists (select 1 from public.group_members where group_id = p_group and user_id = p_user) then
    raise exception 'already_member';
  end if;
  if exists (select 1 from public.blocks b
              where (b.blocker_id = p_user and b.blocked_id = auth.uid())
                 or (b.blocker_id = auth.uid() and b.blocked_id = p_user)) then
    raise exception 'user_blocked';
  end if;
  insert into public.group_members (group_id, user_id, role) values (p_group, p_user, 'member');
end $$;

-- Remove a person (owner can remove anyone but themselves; admins can remove plain members).
create or replace function public.remove_group_member(p_group uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare mine text; theirs text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select role into mine from public.group_members where group_id = p_group and user_id = auth.uid();
  select role into theirs from public.group_members where group_id = p_group and user_id = p_user;
  if mine is null or mine = 'member' then raise exception 'not_admin'; end if;
  if theirs is null then raise exception 'not_found'; end if;
  if theirs = 'owner' then raise exception 'cannot_remove_owner'; end if;
  if theirs = 'admin' and mine <> 'owner' then raise exception 'not_admin'; end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
end $$;

-- Only the owner appoints or removes admins.
create or replace function public.set_group_role(p_group uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_role not in ('admin', 'member') then raise exception 'invalid_role'; end if;
  if not exists (select 1 from public.groups where id = p_group and owner_id = auth.uid()) then
    raise exception 'not_admin';
  end if;
  update public.group_members set role = p_role
   where group_id = p_group and user_id = p_user and role <> 'owner';
  if not found then raise exception 'not_found'; end if;
end $$;

-- Join through an invite link (works for open and invite-only groups).
create or replace function public.join_group_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'not_authenticated';
  end if;
  select group_id into gid from public.group_invites where code = btrim(p_code);
  if gid is null then raise exception 'invalid_invite'; end if;
  insert into public.group_members (group_id, user_id, role) values (gid, auth.uid(), 'member')
    on conflict do nothing;
  return gid;
end $$;

-- Makes the old invite link stop working.
create or replace function public.reset_invite_code(p_group uuid)
returns text language plpgsql security definer set search_path = public as $$
declare fresh text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
begin
  if not public.is_group_admin(p_group) then raise exception 'not_admin'; end if;
  update public.group_invites set code = fresh where group_id = p_group;
  return fresh;
end $$;

-- ---------------------------------------------------------------------
-- Group chat: file sharing
-- ---------------------------------------------------------------------
alter table public.chat_messages add column if not exists file_path text;
alter table public.chat_messages add column if not exists file_name text;
alter table public.chat_messages add column if not exists file_type text;
alter table public.chat_messages add column if not exists file_size bigint;
select pg_temp.drop_check('public.chat_messages', '%char_length(body)%');
select pg_temp.drop_check('public.chat_messages', '%file_path%');
alter table public.chat_messages drop constraint if exists chat_body_ck;
alter table public.chat_messages add constraint chat_body_ck
  check (char_length(body) <= 500 and (char_length(body) >= 1 or file_path is not null));
alter table public.chat_messages drop constraint if exists chat_file_ck;
alter table public.chat_messages add constraint chat_file_ck
  check (file_path is null or (room_type = 'group' and file_name is not null
         and file_path like 'group/' || room_id::text || '/' || author_id::text || '/%'));

drop policy if exists chat_delete on public.chat_messages;
create policy chat_delete on public.chat_messages for delete to authenticated using (
  author_id = auth.uid() or (room_type = 'group' and public.is_group_admin(room_id)));

-- ---------------------------------------------------------------------
-- Battles: new settings
-- ---------------------------------------------------------------------
alter table public.battles add column if not exists host_competes boolean not null default true;
alter table public.battles add column if not exists public_weight int not null default 100;
alter table public.battles add column if not exists round_seconds int not null default 0;
alter table public.battles add column if not exists timer_ends_at timestamptz;
select pg_temp.drop_check('public.battles', '%public_weight%');
select pg_temp.drop_check('public.battles', '%round_seconds%');
alter table public.battles add constraint battles_public_weight_ck check (public_weight between 0 and 100);
alter table public.battles add constraint battles_round_seconds_ck check (round_seconds between 0 and 3600);

alter table public.battle_contenders add column if not exists muted boolean not null default false;

-- Coin votes are now 2 or 5 coins (older rows keep their original amounts).
select pg_temp.drop_check('public.battle_votes', '%amount%');
alter table public.battle_votes add constraint battle_votes_amount_ck check (amount in (1, 2, 5, 10));

create table if not exists public.battle_likes (
  battle_id uuid not null references public.battles (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  contender_id uuid not null references public.profiles (id) on delete cascade,
  round int not null,
  created_at timestamptz not null default now(),
  primary key (battle_id, voter_id, contender_id, round)
);

create table if not exists public.battle_judges (
  battle_id uuid not null references public.battles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);

create table if not exists public.judge_scores (
  battle_id uuid not null,
  judge_id uuid not null,
  contender_id uuid not null references public.profiles (id) on delete cascade,
  round int not null,
  score int not null check (score between 0 and 10),
  comment text not null default '' check (char_length(comment) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (battle_id, judge_id, contender_id, round),
  foreign key (battle_id, judge_id) references public.battle_judges (battle_id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------
-- Battle functions
-- ---------------------------------------------------------------------
drop function if exists public.create_battle(text, text, text, text, text, int, int, int);
create or replace function public.create_battle(
  p_title text, p_category text, p_custom_theme text, p_mode text,
  p_topic text, p_rounds int, p_max int, p_fee int,
  p_host_competes boolean default true, p_public_weight int default 100, p_round_seconds int default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bid uuid;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_authenticated';
  end if;
  if p_public_weight < 0 or p_public_weight > 100 then raise exception 'invalid_weight'; end if;
  if p_round_seconds <> 0 and (p_round_seconds < 15 or p_round_seconds > 3600) then raise exception 'invalid_timer'; end if;
  insert into public.battles (host_id, title, category, custom_theme, mode, topic, total_rounds, max_contenders,
                              entry_fee, host_competes, public_weight, round_seconds)
  values (uid, btrim(p_title), p_category, nullif(btrim(coalesce(p_custom_theme, '')), ''),
          p_mode, btrim(coalesce(p_topic, '')), p_rounds, p_max, p_fee,
          coalesce(p_host_competes, true), p_public_weight, p_round_seconds)
  returning id into bid;
  if coalesce(p_host_competes, true) then
    perform public.spend_voting(uid, p_fee, 'battle_entry', bid);
    update public.battles set prize_pool = p_fee where id = bid;
    insert into public.battle_contenders (battle_id, user_id) values (bid, uid);
  end if;
  return bid;
end $$;

create or replace function public.join_battle(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles; n int;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_authenticated';
  end if;
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.status = 'ended' then raise exception 'bad_status'; end if;
  if uid = b.host_id and not b.host_competes then raise exception 'host_only'; end if;
  if exists (select 1 from public.battle_judges where battle_id = p_battle and user_id = uid) then
    raise exception 'judge_cannot_compete';
  end if;
  if exists (select 1 from public.battle_contenders where battle_id = p_battle and user_id = uid) then
    raise exception 'already_joined';
  end if;
  select count(*) into n from public.battle_contenders where battle_id = p_battle;
  if n >= b.max_contenders then raise exception 'battle_full'; end if;
  perform public.spend_voting(uid, b.entry_fee, 'battle_entry', p_battle);
  update public.battles set prize_pool = prize_pool + b.entry_fee where id = p_battle;
  insert into public.battle_contenders (battle_id, user_id) values (p_battle, uid);
end $$;

create or replace function public.next_round(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status <> 'live' then raise exception 'bad_status'; end if;
  if b.current_round >= b.total_rounds then raise exception 'last_round'; end if;
  update public.battles
     set current_round = current_round + 1,
         timer_ends_at = case when round_seconds > 0 then now() + make_interval(secs => round_seconds) else null end
   where id = p_battle;
end $$;

-- Starting a battle also starts the round timer when the host chose one.
create or replace function public.start_battle(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles; n int;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status <> 'open' then raise exception 'bad_status'; end if;
  select count(*) into n from public.battle_contenders where battle_id = p_battle;
  if n < 2 then raise exception 'not_enough_contenders'; end if;
  update public.battles
     set status = 'live', started_at = now(),
         timer_ends_at = case when round_seconds > 0 then now() + make_interval(secs => round_seconds) else null end
   where id = p_battle;
end $$;

-- 2-coin or 5-coin vote for one competitor.
create or replace function public.cast_vote(p_battle uuid, p_contender uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_authenticated';
  end if;
  if p_amount not in (2, 5) then raise exception 'invalid_vote'; end if;
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.status <> 'live' then raise exception 'not_live'; end if;
  if p_contender = uid then raise exception 'cannot_vote_self'; end if;
  if exists (select 1 from public.battle_judges where battle_id = p_battle and user_id = uid) then
    raise exception 'judge_cannot_vote';
  end if;
  if not exists (select 1 from public.battle_contenders where battle_id = p_battle and user_id = p_contender) then
    raise exception 'invalid_vote';
  end if;
  perform public.spend_voting(uid, p_amount, 'vote', p_battle);
  update public.battles set prize_pool = prize_pool + p_amount where id = p_battle;
  update public.battle_contenders set score = score + p_amount where battle_id = p_battle and user_id = p_contender;
  insert into public.battle_votes (battle_id, voter_id, contender_id, amount) values (p_battle, uid, p_contender, p_amount);
end $$;

-- Free like: one per viewer, per competitor, per round. Worth 1 point, costs nothing.
create or replace function public.like_contender(p_battle uuid, p_contender uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_authenticated';
  end if;
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.status <> 'live' then raise exception 'not_live'; end if;
  if p_contender = uid then raise exception 'cannot_vote_self'; end if;
  if exists (select 1 from public.battle_judges where battle_id = p_battle and user_id = uid) then
    raise exception 'judge_cannot_vote';
  end if;
  if not exists (select 1 from public.battle_contenders where battle_id = p_battle and user_id = p_contender) then
    raise exception 'invalid_vote';
  end if;
  insert into public.battle_likes (battle_id, voter_id, contender_id, round)
    values (p_battle, uid, p_contender, b.current_round)
    on conflict do nothing;
  if not found then raise exception 'already_liked'; end if;
  update public.battle_contenders set score = score + 1 where battle_id = p_battle and user_id = p_contender;
end $$;

-- Host picks up to 3 public judges.
create or replace function public.add_judge(p_battle uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles; n int;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status = 'ended' then raise exception 'bad_status'; end if;
  if p_user = b.host_id then raise exception 'host_cannot_judge'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'not_found'; end if;
  if exists (select 1 from public.battle_contenders where battle_id = p_battle and user_id = p_user) then
    raise exception 'judge_is_contender';
  end if;
  if exists (select 1 from public.battle_judges where battle_id = p_battle and user_id = p_user) then
    raise exception 'already_judge';
  end if;
  select count(*) into n from public.battle_judges where battle_id = p_battle;
  if n >= 3 then raise exception 'max_judges'; end if;
  insert into public.battle_judges (battle_id, user_id) values (p_battle, p_user);
end $$;

create or replace function public.remove_judge(p_battle uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status = 'ended' then raise exception 'bad_status'; end if;
  delete from public.battle_judges where battle_id = p_battle and user_id = p_user;
end $$;

-- A judge scores one competitor 0 to 10 for the current round, with an optional public comment.
create or replace function public.judge_score(p_battle uuid, p_contender uuid, p_score int, p_comment text default '')
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_score < 0 or p_score > 10 then raise exception 'invalid_score'; end if;
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.status <> 'live' then raise exception 'not_live'; end if;
  if not exists (select 1 from public.battle_judges where battle_id = p_battle and user_id = uid) then
    raise exception 'not_judge';
  end if;
  if not exists (select 1 from public.battle_contenders where battle_id = p_battle and user_id = p_contender) then
    raise exception 'invalid_vote';
  end if;
  insert into public.judge_scores (battle_id, judge_id, contender_id, round, score, comment)
    values (p_battle, uid, p_contender, b.current_round, p_score, left(btrim(coalesce(p_comment, '')), 280))
    on conflict (battle_id, judge_id, contender_id, round)
    do update set score = excluded.score, comment = excluded.comment, updated_at = now();
end $$;

-- Host sets how much the public counts (the rest is the judges). Only before the battle starts.
create or replace function public.set_battle_weight(p_battle uuid, p_public int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status <> 'open' then raise exception 'weights_locked'; end if;
  if p_public < 0 or p_public > 100 then raise exception 'invalid_weight'; end if;
  update public.battles set public_weight = p_public where id = p_battle;
end $$;

-- Competition timer (host only). Pass 0 to stop it.
create or replace function public.set_battle_timer(p_battle uuid, p_seconds int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status = 'ended' then raise exception 'bad_status'; end if;
  if p_seconds <> 0 and (p_seconds < 10 or p_seconds > 3600) then raise exception 'invalid_timer'; end if;
  update public.battles
     set timer_ends_at = case when p_seconds = 0 then null else now() + make_interval(secs => p_seconds) end
   where id = p_battle;
end $$;

create or replace function public.server_time()
returns timestamptz language sql stable as $$ select now() $$;

-- Public score, judges' score and final score for every competitor.
--   public share = competitor points / all points            (likes + coin votes)
--   judge share  = competitor average score / sum of averages (each judge averaged over rounds)
--   final        = public_weight% of public share + the rest from judge share
-- If nobody has judged yet (or nobody has voted yet) the other side counts fully.
create or replace function public.battle_standings(p_battle uuid)
returns table (user_id uuid, public_points int, public_pct numeric, judge_avg numeric, judge_pct numeric, final_pct numeric)
language sql stable as $$
  with c as (
    select bc.user_id, bc.score as pts from public.battle_contenders bc where bc.battle_id = p_battle
  ),
  tot as (select coalesce(sum(pts), 0)::numeric as t from c),
  per_judge as (
    select js.contender_id, js.judge_id, avg(js.score)::numeric as s
      from public.judge_scores js where js.battle_id = p_battle group by js.contender_id, js.judge_id
  ),
  j as (select contender_id, avg(s) as javg from per_judge group by contender_id),
  jt as (select coalesce(sum(javg), 0)::numeric as t from j),
  w as (select public_weight from public.battles where id = p_battle),
  x as (
    select c.user_id, c.pts,
           case when tot.t > 0 then c.pts * 100.0 / tot.t else 0 end as ppct,
           coalesce(j.javg, 0) as javg,
           case when jt.t > 0 then coalesce(j.javg, 0) * 100.0 / jt.t else 0 end as jpct
      from c cross join tot cross join jt left join j on j.contender_id = c.user_id
  )
  select x.user_id, x.pts, round(x.ppct, 2), round(x.javg, 2), round(x.jpct, 2),
         round(case
           when (select t from tot) = 0 and (select t from jt) = 0 then 0
           when (select t from jt) = 0 then x.ppct
           when (select t from tot) = 0 then x.jpct
           else ((select public_weight from w) * x.ppct + (100 - (select public_weight from w)) * x.jpct) / 100.0
         end, 2)
    from x;
$$;

-- Ends a live battle and pays out exactly once (status guard + row lock).
-- 20% of the pool goes to the host; 80% is shared by competitors in proportion to their FINAL score
-- (equally if nobody scored). Rounding dust goes to the host. Winner = unique top final score.
create or replace function public.end_battle(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b public.battles;
  total numeric; n int; remaining int; host_cut int; paid int := 0; share int;
  top numeric; ties int; winner uuid;
  c record;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status <> 'live' then raise exception 'bad_status'; end if;

  host_cut := floor(b.prize_pool * 0.2);
  remaining := b.prize_pool - host_cut;
  select coalesce(sum(s.final_pct), 0), count(*) into total, n from public.battle_standings(p_battle) s;

  for c in select s.user_id, s.final_pct from public.battle_standings(p_battle) s loop
    if total > 0 then
      share := floor(remaining::numeric * c.final_pct / total);
    else
      share := floor(remaining::numeric / n);
    end if;
    perform public.credit_reward(c.user_id, share, 'battle_prize', p_battle);
    paid := paid + share;
  end loop;
  perform public.credit_reward(b.host_id, host_cut + (remaining - paid), 'host_cut', p_battle);

  select max(s.final_pct) into top from public.battle_standings(p_battle) s;
  select count(*) into ties from public.battle_standings(p_battle) s where s.final_pct = top;
  if top > 0 and ties = 1 then
    select s.user_id into winner from public.battle_standings(p_battle) s where s.final_pct = top;
  end if;
  update public.battles set status = 'ended', ended_at = now(), winner_id = winner, timer_ends_at = null where id = p_battle;
end $$;

-- ---------------------------------------------------------------------
-- Permissions for the new / changed functions and tables
-- ---------------------------------------------------------------------
revoke all on function public.is_group_admin(uuid) from public, anon;
revoke all on function public.add_group_member(uuid, uuid) from public, anon;
revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
revoke all on function public.set_group_role(uuid, uuid, text) from public, anon;
revoke all on function public.join_group_by_code(text) from public, anon;
revoke all on function public.reset_invite_code(uuid) from public, anon;
revoke all on function public.create_battle(text, text, text, text, text, int, int, int, boolean, int, int) from public, anon;
revoke all on function public.like_contender(uuid, uuid) from public, anon;
revoke all on function public.add_judge(uuid, uuid) from public, anon;
revoke all on function public.remove_judge(uuid, uuid) from public, anon;
revoke all on function public.judge_score(uuid, uuid, int, text) from public, anon;
revoke all on function public.set_battle_weight(uuid, int) from public, anon;
revoke all on function public.set_battle_timer(uuid, int) from public, anon;

grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.set_group_role(uuid, uuid, text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.reset_invite_code(uuid) to authenticated;
grant execute on function public.create_battle(text, text, text, text, text, int, int, int, boolean, int, int) to authenticated;
grant execute on function public.like_contender(uuid, uuid) to authenticated;
grant execute on function public.add_judge(uuid, uuid) to authenticated;
grant execute on function public.remove_judge(uuid, uuid) to authenticated;
grant execute on function public.judge_score(uuid, uuid, int, text) to authenticated;
grant execute on function public.set_battle_weight(uuid, int) to authenticated;
grant execute on function public.set_battle_timer(uuid, int) to authenticated;
grant execute on function public.server_time() to anon, authenticated;
grant execute on function public.battle_standings(uuid) to anon, authenticated;

-- The API role needs table access for the new tables; Row Level Security still decides who sees what.
grant select, insert, update, delete on public.battle_likes, public.battle_judges, public.judge_scores, public.group_invites
  to authenticated, service_role;
grant select on public.battle_likes, public.battle_judges, public.judge_scores to anon;
-- ...but clients can only READ battle data. Every change goes through the functions above.
revoke insert, update, delete on public.battle_likes, public.battle_judges, public.judge_scores from anon, authenticated;
revoke insert, update, delete on public.group_invites from anon, authenticated;
revoke select on public.group_invites from anon;

-- ---------------------------------------------------------------------
-- Row Level Security for the new tables and changed rules
-- ---------------------------------------------------------------------
alter table public.battle_likes enable row level security;
alter table public.battle_judges enable row level security;
alter table public.judge_scores enable row level security;
alter table public.group_invites enable row level security;

drop policy if exists likes_battle_select on public.battle_likes;
create policy likes_battle_select on public.battle_likes for select using (true);
drop policy if exists judges_select on public.battle_judges;
create policy judges_select on public.battle_judges for select using (true);
drop policy if exists judge_scores_select on public.judge_scores;
create policy judge_scores_select on public.judge_scores for select using (true);
drop policy if exists invites_select on public.group_invites;
create policy invites_select on public.group_invites for select to authenticated using (public.is_group_admin(group_id));

-- Joining a group directly is only possible while it is open; invite-only groups use a link or an admin.
drop policy if exists members_insert on public.group_members;
create policy members_insert on public.group_members for insert to authenticated with check (
  user_id = auth.uid() and role = 'member'
  and exists (select 1 from public.groups g where g.id = group_id and g.join_policy = 'open'));

-- ---------------------------------------------------------------------
-- Storage: bigger uploads and a private bucket for group files
--   The size limits below are the most the APP allows. The real ceiling is your
--   Supabase plan: Free = 50 MB per file, Pro = raise it in
--   Storage > Settings > "Upload file size limit" (up to 500 GB).
-- ---------------------------------------------------------------------
update storage.buckets set file_size_limit = 5368709120 where id in ('media-public', 'media-paid');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('chat-files', 'chat-files', false, 1073741824, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/zip', 'text/plain', 'text/csv',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg',
    'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Files live at  group/<groupId>/<userId>/<file>
drop policy if exists "kezzo_chatfiles_insert" on storage.objects;
create policy "kezzo_chatfiles_insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = 'group'
  and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.is_group_member(((storage.foldername(name))[2])::uuid));

drop policy if exists "kezzo_chatfiles_select" on storage.objects;
create policy "kezzo_chatfiles_select" on storage.objects for select to authenticated using (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = 'group'
  and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_group_member(((storage.foldername(name))[2])::uuid));

drop policy if exists "kezzo_chatfiles_delete" on storage.objects;
create policy "kezzo_chatfiles_delete" on storage.objects for delete to authenticated using (
  bucket_id = 'chat-files'
  and (storage.foldername(name))[1] = 'group'
  and (storage.foldername(name))[3] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['battle_judges', 'judge_scores', 'battle_likes', 'group_members'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
