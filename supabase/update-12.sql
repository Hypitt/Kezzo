-- =====================================================================
-- Kezzo update 12: at most 10 notifications per person; group messages become in-app notifications
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-11. Safe to run more than once.
-- =====================================================================

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in ('message', 'like', 'follow', 'live', 'battle', 'post', 'event', 'poll', 'group'));

-- ---------------------------------------------------------------------
-- Never more than 10 on screen: when a new one arrives, the oldest beyond the 10 newest are deleted
-- ---------------------------------------------------------------------
create or replace function public.trg_notifications_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifications
   where id in (select id from public.notifications where user_id = new.user_id order by created_at desc, id offset 10);
  return null;
end; $$;
drop trigger if exists notifications_cap on public.notifications;
create trigger notifications_cap after insert on public.notifications for each row execute function public.trg_notifications_cap();

-- Bring everyone down to 10 now
delete from public.notifications
 where id in (select id from (select id, row_number() over (partition by user_id order by created_at desc, id) as rn from public.notifications) x where rn > 10);

-- ---------------------------------------------------------------------
-- Group chat messages: one in-app notification per group (with a counter), instead of an e-mail
-- Skipped for very large groups (over 200 members) so a busy chat cannot flood the database.
-- ---------------------------------------------------------------------
create or replace function public.trg_notify_group_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.room_type <> 'group' then return new; end if;
  if (select count(*) from public.group_members where group_id = new.room_id) > 200 then return new; end if;

  with fans as (
    select m.user_id as uid from public.group_members m
     where m.group_id = new.room_id and m.user_id <> new.author_id
       and not exists (select 1 from public.blocks b
                        where (b.blocker_id = m.user_id and b.blocked_id = new.author_id)
                           or (b.blocker_id = new.author_id and b.blocked_id = m.user_id))
  )
  update public.notifications n set count = n.count + 1, created_at = now(), actor_id = new.author_id
    from fans where n.user_id = fans.uid and n.kind = 'group' and n.ref_id = new.room_id;

  insert into public.notifications (user_id, kind, actor_id, ref_id)
  select m.user_id, 'group', new.author_id, new.room_id from public.group_members m
   where m.group_id = new.room_id and m.user_id <> new.author_id
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = m.user_id and b.blocked_id = new.author_id)
                         or (b.blocker_id = new.author_id and b.blocked_id = m.user_id))
     and not exists (select 1 from public.notifications n where n.user_id = m.user_id and n.kind = 'group' and n.ref_id = new.room_id);
  return new;
end; $$;
drop trigger if exists notify_group_message on public.chat_messages;
create trigger notify_group_message after insert on public.chat_messages for each row execute function public.trg_notify_group_message();

-- Opening a group / live / battle page clears its notification
create or replace function public.clear_notifications_for(p_kind text, p_ref uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.notifications where user_id = auth.uid() and kind = p_kind and ref_id = p_ref;
$$;
revoke all on function public.clear_notifications_for(text, uuid) from public, anon;
grant execute on function public.clear_notifications_for(text, uuid) to authenticated;
