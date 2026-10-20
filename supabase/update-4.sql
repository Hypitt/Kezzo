-- =====================================================================
-- Kezzo update 4: security fixes
-- Run this in the Supabase SQL Editor AFTER schema.sql, update-2.sql and update-3.sql.
-- Safe to run more than once.
--
--   * Room bans: a person the host removes from a battle or a live stream cannot
--     rejoin as a competitor or guest, cannot chat there, and gets no microphone/camera.
--   * Hosts can delete any chat message in their battle or live stream.
--   * Dates are always set by the database (no more future-dated posts at the top of feeds).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Room bans
-- ---------------------------------------------------------------------
create table if not exists public.room_bans (
  room_type text not null check (room_type in ('battle', 'live')),
  room_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  banned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (room_type, room_id, user_id)
);

create or replace function public.is_room_host(p_type text, p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_type
    when 'battle' then exists (select 1 from public.battles where id = p_room and host_id = auth.uid())
    when 'live' then exists (select 1 from public.live_streams where id = p_room and host_id = auth.uid())
    else false end;
$$;

create or replace function public.is_room_banned(p_type text, p_room uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_bans where room_type = p_type and room_id = p_room and user_id = p_user);
$$;

revoke all on function public.is_room_host(text, uuid) from public, anon;
revoke all on function public.is_room_banned(text, uuid, uuid) from public, anon;
grant execute on function public.is_room_host(text, uuid) to authenticated;
grant execute on function public.is_room_banned(text, uuid, uuid) to authenticated, service_role;

alter table public.room_bans enable row level security;
grant select, insert, update, delete on public.room_bans to service_role;
grant select on public.room_bans to authenticated;
revoke insert, update, delete on public.room_bans from anon, authenticated;
revoke select on public.room_bans from anon;
-- Bans are written only by the server (/api/livekit-kick). You see your own bans; hosts see their room's bans.
drop policy if exists room_bans_select on public.room_bans;
create policy room_bans_select on public.room_bans for select to authenticated
  using (user_id = auth.uid() or public.is_room_host(room_type, room_id));

-- Banned people cannot join a battle as a competitor.
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
  if public.is_room_banned('battle', p_battle, uid) then raise exception 'room_banned'; end if;
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

-- The host cannot pick a banned person as a judge.
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
  if public.is_room_banned('battle', p_battle, p_user) then raise exception 'room_banned'; end if;
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

-- Banned people cannot ask to join a live stream's stage.
create or replace function public.request_live_join(p_stream uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.live_streams;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into s from public.live_streams where id = p_stream;
  if not found then raise exception 'not_found'; end if;
  if s.status <> 'live' then raise exception 'bad_status'; end if;
  if s.kind <> 'group' then raise exception 'not_group_live'; end if;
  if s.host_id = uid then raise exception 'is_host'; end if;
  if public.is_room_banned('live', p_stream, uid) then raise exception 'room_banned'; end if;
  insert into public.live_guests (stream_id, user_id, status) values (p_stream, uid, 'requested')
  on conflict (stream_id, user_id) do nothing;
end $$;

-- ---------------------------------------------------------------------
-- Chat: banned people cannot write; hosts can delete any message in their room
-- ---------------------------------------------------------------------
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert to authenticated with check (
  author_id = auth.uid()
  and ((room_type = 'battle'
        and exists (select 1 from public.battles b where b.id = room_id and b.status <> 'ended')
        and not public.is_room_banned('battle', room_id, auth.uid()))
       or (room_type = 'live'
        and exists (select 1 from public.live_streams l where l.id = room_id and l.status = 'live')
        and not public.is_room_banned('live', room_id, auth.uid()))
       or (room_type = 'group' and public.is_group_member(room_id))));

drop policy if exists chat_delete on public.chat_messages;
create policy chat_delete on public.chat_messages for delete to authenticated using (
  author_id = auth.uid()
  or (room_type = 'group' and public.is_group_admin(room_id))
  or (room_type in ('battle', 'live') and public.is_room_host(room_type, room_id)));

-- ---------------------------------------------------------------------
-- Dates are set by the database, never by the browser
-- ---------------------------------------------------------------------
create or replace function public.force_created_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.created_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts', 'post_comments', 'chat_messages', 'direct_messages', 'reports', 'battle_votes', 'live_streams'] loop
    execute format('drop trigger if exists force_created_at on public.%I', t);
    execute format('create trigger force_created_at before insert on public.%I for each row execute function public.force_created_at()', t);
  end loop;
end $$;

-- New profiles: the database records when the terms were accepted.
create or replace function public.force_profile_dates()
returns trigger language plpgsql set search_path = public as $$
begin
  new.created_at := now();
  new.terms_accepted_at := now();
  return new;
end $$;
drop trigger if exists force_profile_dates on public.profiles;
create trigger force_profile_dates before insert on public.profiles
  for each row execute function public.force_profile_dates();

-- New groups: the member count always starts at 0 (the owner is then counted automatically).
create or replace function public.force_group_defaults()
returns trigger language plpgsql set search_path = public as $$
begin
  new.created_at := now();
  new.member_count := 0;
  return new;
end $$;
drop trigger if exists force_group_defaults on public.groups;
create trigger force_group_defaults before insert on public.groups
  for each row execute function public.force_group_defaults();

revoke all on function public.force_created_at() from public, anon, authenticated;
revoke all on function public.force_profile_dates() from public, anon, authenticated;
revoke all on function public.force_group_defaults() from public, anon, authenticated;

-- Fix posts that were already dated in the future.
update public.posts set created_at = now() where created_at > now() + interval '5 minutes';
