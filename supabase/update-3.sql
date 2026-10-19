-- =====================================================================
-- Kezzo update 3: Go Live (solo and group livestreams), battle highlight clip
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2.sql. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Go Live: livestreams that are not battles
-- ---------------------------------------------------------------------
create table if not exists public.live_streams (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  kind text not null check (kind in ('solo', 'group')),
  mode text not null check (mode in ('video', 'audio')),
  max_guests int not null default 0 check (max_guests between 0 and 8),
  status text not null default 'live' check (status in ('live', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists live_streams_status_idx on public.live_streams (status, created_at desc);
create index if not exists live_streams_host_idx on public.live_streams (host_id, status);

create table if not exists public.live_guests (
  stream_id uuid not null references public.live_streams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'approved')),
  created_at timestamptz not null default now(),
  primary key (stream_id, user_id)
);

alter table public.live_streams enable row level security;
alter table public.live_guests enable row level security;
drop policy if exists live_streams_read on public.live_streams;
create policy live_streams_read on public.live_streams for select to anon, authenticated using (true);
drop policy if exists live_guests_read on public.live_guests;
create policy live_guests_read on public.live_guests for select to anon, authenticated using (true);
grant select on public.live_streams, public.live_guests to anon, authenticated;
-- No insert/update/delete policies: every change goes through the functions below.

create or replace function public.start_live(p_title text, p_kind text, p_mode text, p_max_guests int)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sid uuid; guests int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = uid) then raise exception 'no_profile'; end if;
  if p_kind not in ('solo', 'group') or p_mode not in ('video', 'audio') then raise exception 'invalid_live'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 100 then raise exception 'invalid_live'; end if;
  guests := case when p_kind = 'solo' then 0 else greatest(1, least(coalesce(p_max_guests, 4), 8)) end;
  -- One live stream per host at a time.
  update public.live_streams set status = 'ended', ended_at = now() where host_id = uid and status = 'live';
  insert into public.live_streams (host_id, title, kind, mode, max_guests)
  values (uid, btrim(p_title), p_kind, p_mode, guests) returning id into sid;
  return sid;
end $$;

create or replace function public.end_live(p_stream uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.live_streams;
begin
  select * into s from public.live_streams where id = p_stream for update;
  if not found then raise exception 'not_found'; end if;
  if s.host_id is distinct from auth.uid() then raise exception 'not_host'; end if;
  if s.status = 'ended' then return; end if;
  update public.live_streams set status = 'ended', ended_at = now() where id = p_stream;
  delete from public.live_guests where stream_id = p_stream;
end $$;

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
  insert into public.live_guests (stream_id, user_id, status) values (p_stream, uid, 'requested')
  on conflict (stream_id, user_id) do nothing;
end $$;

create or replace function public.respond_live_guest(p_stream uuid, p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s public.live_streams; taken int;
begin
  select * into s from public.live_streams where id = p_stream for update;
  if not found then raise exception 'not_found'; end if;
  if s.host_id is distinct from auth.uid() then raise exception 'not_host'; end if;
  if s.status <> 'live' then raise exception 'bad_status'; end if;
  if p_approve then
    select count(*) into taken from public.live_guests where stream_id = p_stream and status = 'approved' and user_id <> p_user;
    if taken >= s.max_guests then raise exception 'stage_full'; end if;
    update public.live_guests set status = 'approved' where stream_id = p_stream and user_id = p_user;
    if not found then raise exception 'not_found'; end if;
  else
    delete from public.live_guests where stream_id = p_stream and user_id = p_user;
  end if;
end $$;

create or replace function public.leave_live_stage(p_stream uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.live_guests where stream_id = p_stream and user_id = auth.uid();
$$;

revoke all on function public.start_live(text, text, text, int) from public, anon;
revoke all on function public.end_live(uuid) from public, anon;
revoke all on function public.request_live_join(uuid) from public, anon;
revoke all on function public.respond_live_guest(uuid, uuid, boolean) from public, anon;
revoke all on function public.leave_live_stage(uuid) from public, anon;
grant execute on function public.start_live(text, text, text, int) to authenticated;
grant execute on function public.end_live(uuid) to authenticated;
grant execute on function public.request_live_join(uuid) to authenticated;
grant execute on function public.respond_live_guest(uuid, uuid, boolean) to authenticated;
grant execute on function public.leave_live_stage(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Chat for livestreams
-- ---------------------------------------------------------------------
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.chat_messages'::regclass and contype = 'c'
            and pg_get_constraintdef(oid) like '%ARRAY[''battle''%'
  loop execute format('alter table public.chat_messages drop constraint %I', c.conname); end loop;
end $$;
alter table public.chat_messages drop constraint if exists chat_room_type_ck;
alter table public.chat_messages add constraint chat_room_type_ck check (room_type in ('battle', 'group', 'live'));

drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages for select to authenticated
  using (room_type in ('battle', 'live') or (room_type = 'group' and public.is_group_member(room_id)));
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert to authenticated with check (
  author_id = auth.uid()
  and ((room_type = 'battle' and exists (select 1 from public.battles b where b.id = room_id and b.status <> 'ended'))
       or (room_type = 'live' and exists (select 1 from public.live_streams l where l.id = room_id and l.status = 'live'))
       or (room_type = 'group' and public.is_group_member(room_id))));

-- ---------------------------------------------------------------------
-- Battle highlight clip (up to 90 seconds), posted by the host after the battle
-- ---------------------------------------------------------------------
alter table public.battles add column if not exists highlight_post_id uuid references public.posts (id) on delete set null;

create or replace function public.set_battle_highlight(p_battle uuid, p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b public.battles; p public.posts;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from auth.uid() then raise exception 'not_host'; end if;
  if b.status <> 'ended' then raise exception 'bad_status'; end if;
  if p_post is not null then
    select * into p from public.posts where id = p_post;
    if not found or p.author_id <> b.host_id or p.kind <> 'video' or p.media_bucket is distinct from 'media-public' then
      raise exception 'invalid_highlight';
    end if;
    if p.duration_seconds is null or p.duration_seconds > 90 then raise exception 'highlight_too_long'; end if;
  end if;
  update public.battles set highlight_post_id = p_post where id = p_battle;
end $$;
revoke all on function public.set_battle_highlight(uuid, uuid) from public, anon;
grant execute on function public.set_battle_highlight(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['live_streams', 'live_guests'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
