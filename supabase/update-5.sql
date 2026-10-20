-- =====================================================================
-- Kezzo update 5: in-app notifications (messages, likes, new followers, live sessions)
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-4. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- One row per notification. Only the database creates them (triggers below); people can only read, mark as read and delete their own.
-- Message text is never copied here: a message notification only says who wrote and how many new messages there are.
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('message', 'like', 'follow', 'live', 'battle')),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  ref_id uuid,
  count int not null default 1,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Creates one notification, unless it would be pointless or unwelcome.
-- ---------------------------------------------------------------------
create or replace function public.notify(p_user uuid, p_kind text, p_actor uuid, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_actor is null or p_user = p_actor then return; end if;
  -- Nothing between people who blocked each other
  if exists (select 1 from public.blocks
              where (blocker_id = p_user and blocked_id = p_actor) or (blocker_id = p_actor and blocked_id = p_user)) then
    return;
  end if;

  if p_kind = 'message' then
    -- Several unread messages from the same person become one notification with a counter
    update public.notifications set count = count + 1, created_at = now()
     where user_id = p_user and kind = 'message' and actor_id = p_actor and read_at is null;
    if found then return; end if;
  elsif p_kind in ('like', 'live', 'battle') then
    if exists (select 1 from public.notifications where user_id = p_user and kind = p_kind and actor_id = p_actor and ref_id = p_ref) then return; end if;
  elsif p_kind = 'follow' then
    if exists (select 1 from public.notifications where user_id = p_user and kind = 'follow' and actor_id = p_actor) then return; end if;
  end if;

  insert into public.notifications (user_id, kind, actor_id, ref_id) values (p_user, p_kind, p_actor, p_ref);

  -- Housekeeping: now and then drop this person's notifications older than 60 days
  if random() < 0.05 then
    delete from public.notifications where user_id = p_user and created_at < now() - interval '60 days';
  end if;
end;
$$;
revoke all on function public.notify(uuid, text, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.recipient_id, 'message', new.sender_id, null);
  return new;
end; $$;
drop trigger if exists notify_message on public.direct_messages;
create trigger notify_message after insert on public.direct_messages for each row execute function public.trg_notify_message();

-- Reading a conversation clears its notification
create or replace function public.trg_notify_message_read() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.read_at is not null and old.read_at is null then
    update public.notifications set read_at = now()
     where user_id = new.recipient_id and kind = 'message' and actor_id = new.sender_id and read_at is null;
  end if;
  return new;
end; $$;
drop trigger if exists notify_message_read on public.direct_messages;
create trigger notify_message_read after update of read_at on public.direct_messages for each row execute function public.trg_notify_message_read();

create or replace function public.trg_notify_like() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify((select author_id from public.posts where id = new.post_id), 'like', new.user_id, new.post_id);
  return new;
end; $$;
drop trigger if exists notify_like on public.post_likes;
create trigger notify_like after insert on public.post_likes for each row execute function public.trg_notify_like();

create or replace function public.trg_notify_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.followee_id, 'follow', new.follower_id, null);
  return new;
end; $$;
drop trigger if exists notify_follow on public.follows;
create trigger notify_follow after insert on public.follows for each row execute function public.trg_notify_follow();

-- Someone you follow goes live (Go Live stream or battle): one notification per follower
create or replace function public.notify_followers(p_host uuid, p_kind text, p_ref uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, actor_id, ref_id)
  select f.follower_id, p_kind, p_host, p_ref
    from public.follows f
   where f.followee_id = p_host
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = f.follower_id and b.blocked_id = p_host)
                         or (b.blocker_id = p_host and b.blocked_id = f.follower_id));
$$;
revoke all on function public.notify_followers(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.trg_notify_live() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'live' then perform public.notify_followers(new.host_id, 'live', new.id); end if;
  return new;
end; $$;
drop trigger if exists notify_live on public.live_streams;
create trigger notify_live after insert on public.live_streams for each row execute function public.trg_notify_live();

create or replace function public.trg_notify_battle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'live' and old.status is distinct from 'live' then perform public.notify_followers(new.host_id, 'battle', new.id); end if;
  return new;
end; $$;
drop trigger if exists notify_battle on public.battles;
create trigger notify_battle after update of status on public.battles for each row execute function public.trg_notify_battle();

-- ---------------------------------------------------------------------
-- Mark notifications as read (all, or a list)
-- ---------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Live updates in the app
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
