-- =====================================================================
-- Kezzo update 11: notifications that disappear once viewed, automatic clean-up of old ones,
-- and "following" notifications (new posts, events and polls from people you follow)
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-10. Safe to run more than once.
-- =====================================================================

-- New kinds of notification
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in ('message', 'like', 'follow', 'live', 'battle', 'post', 'event', 'poll'));

-- ---------------------------------------------------------------------
-- Viewed = gone: "mark as read" now deletes the notification
-- ---------------------------------------------------------------------
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  delete from public.notifications where user_id = auth.uid() and (p_ids is null or id = any (p_ids));
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Reading a conversation removes its notification
create or replace function public.trg_notify_message_read() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.read_at is not null and old.read_at is null then
    delete from public.notifications where user_id = new.recipient_id and kind = 'message' and actor_id = new.sender_id;
  end if;
  return new;
end; $$;

-- ---------------------------------------------------------------------
-- Old notifications are deleted after 30 days (viewed ones are already gone)
-- ---------------------------------------------------------------------
create or replace function public.prune_notifications()
returns void language sql security definer set search_path = public as $$
  delete from public.notifications where user_id = auth.uid() and (read_at is not null or created_at < now() - interval '30 days');
$$;
revoke all on function public.prune_notifications() from public, anon;
grant execute on function public.prune_notifications() to authenticated;

create or replace function public.purge_old_notifications()
returns void language sql security definer set search_path = public as $$
  delete from public.notifications where read_at is not null or created_at < now() - interval '30 days';
$$;
revoke all on function public.purge_old_notifications() from public, anon, authenticated;

-- Housekeeping inside notify(): now and then clear everyone's old notifications (30 days instead of 60)
create or replace function public.notify(p_user uuid, p_kind text, p_actor uuid, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_actor is null or p_user = p_actor then return; end if;
  if exists (select 1 from public.blocks
              where (blocker_id = p_user and blocked_id = p_actor) or (blocker_id = p_actor and blocked_id = p_user)) then
    return;
  end if;

  if p_kind = 'message' then
    update public.notifications set count = count + 1, created_at = now()
     where user_id = p_user and kind = 'message' and actor_id = p_actor;
    if found then return; end if;
  elsif p_kind in ('like', 'live', 'battle') then
    if exists (select 1 from public.notifications where user_id = p_user and kind = p_kind and actor_id = p_actor and ref_id = p_ref) then return; end if;
  elsif p_kind = 'follow' then
    if exists (select 1 from public.notifications where user_id = p_user and kind = 'follow' and actor_id = p_actor) then return; end if;
  end if;

  insert into public.notifications (user_id, kind, actor_id, ref_id) values (p_user, p_kind, p_actor, p_ref);

  if random() < 0.02 then perform public.purge_old_notifications(); end if;
end;
$$;
revoke all on function public.notify(uuid, text, uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Following is worth it: followers hear about new posts, events and polls.
-- Several new items from the same person in a row become one notification with a counter.
-- ---------------------------------------------------------------------
create or replace function public.notify_followers_grouped(p_host uuid, p_kind text, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with fans as (
    select f.follower_id as uid from public.follows f
     where f.followee_id = p_host
       and not exists (select 1 from public.blocks b
                        where (b.blocker_id = f.follower_id and b.blocked_id = p_host)
                           or (b.blocker_id = p_host and b.blocked_id = f.follower_id))
  )
  update public.notifications n set count = n.count + 1, created_at = now(), ref_id = p_ref
    from fans where n.user_id = fans.uid and n.kind = p_kind and n.actor_id = p_host;
  insert into public.notifications (user_id, kind, actor_id, ref_id)
  select f.follower_id, p_kind, p_host, p_ref from public.follows f
   where f.followee_id = p_host
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = f.follower_id and b.blocked_id = p_host)
                         or (b.blocker_id = p_host and b.blocked_id = f.follower_id))
     and not exists (select 1 from public.notifications n where n.user_id = f.follower_id and n.kind = p_kind and n.actor_id = p_host);
end;
$$;
revoke all on function public.notify_followers_grouped(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.trg_notify_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_followers_grouped(new.author_id, 'post', new.id);
  return new;
end; $$;
drop trigger if exists notify_post on public.posts;
create trigger notify_post after insert on public.posts for each row execute function public.trg_notify_post();

create or replace function public.trg_notify_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_followers_grouped(new.host_id, 'event', new.id);
  return new;
end; $$;
drop trigger if exists notify_event on public.events;
create trigger notify_event after insert on public.events for each row execute function public.trg_notify_event();

create or replace function public.trg_notify_poll() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.live_id is null then perform public.notify_followers_grouped(new.author_id, 'poll', new.id); end if;
  return new;
end; $$;
drop trigger if exists notify_poll on public.polls;
create trigger notify_poll after insert on public.polls for each row execute function public.trg_notify_poll();

-- One-off clean-up of what is already there
select public.purge_old_notifications();
