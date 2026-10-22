-- =====================================================================
-- Kezzo update 13: ringing calls (incoming-call screen) for direct messages and groups
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-12. Safe to run more than once.
-- =====================================================================

create table if not exists public.call_invites (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('dm', 'group')),
  group_id uuid references public.groups (id) on delete cascade,
  video boolean not null default true,
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  check (caller_id <> recipient_id),
  check ((kind = 'group') = (group_id is not null))
);
create index if not exists call_invites_recipient_idx on public.call_invites (recipient_id, created_at desc);
create index if not exists call_invites_caller_idx on public.call_invites (caller_id, created_at desc);

alter table public.call_invites enable row level security;

-- People can only read invites they sent or received. Everything else goes through the functions below.
drop policy if exists "call_invites_select" on public.call_invites;
create policy "call_invites_select" on public.call_invites for select to authenticated
  using (caller_id = auth.uid() or recipient_id = auth.uid());
revoke insert, update, delete on public.call_invites from anon, authenticated;
grant select on public.call_invites to authenticated;

-- Realtime: the receiving phone/computer hears about the invite right away
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'call_invites') then
    alter publication supabase_realtime add table public.call_invites;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Start a call: rings one person (direct message) or every other member of a group
--   p_kind 'dm'    -> p_target is the other person's id
--   p_kind 'group' -> p_target is the group id (caller must be a member)
-- Returns how many people are being rung. A caller can ring the same target at most once every 8 seconds.
-- ---------------------------------------------------------------------
create or replace function public.start_call(p_kind text, p_target uuid, p_video boolean default true)
returns integer language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n integer := 0;
begin
  if me is null then raise exception 'Sign in required'; end if;
  if p_kind not in ('dm', 'group') then raise exception 'Invalid call'; end if;

  -- cleanup: forget invites older than a day
  delete from public.call_invites where created_at < now() - interval '1 day';

  if p_kind = 'dm' then
    if not (public.can_dm(me, p_target) or public.can_dm(p_target, me)) then raise exception 'Calls are not allowed with this user'; end if;
    if exists (select 1 from public.call_invites where caller_id = me and recipient_id = p_target and kind = 'dm' and created_at > now() - interval '8 seconds') then
      return 0;
    end if;
    update public.call_invites set status = 'cancelled'
     where caller_id = me and recipient_id = p_target and kind = 'dm' and status = 'ringing';
    insert into public.call_invites (caller_id, recipient_id, kind, video) values (me, p_target, 'dm', p_video);
    return 1;
  end if;

  if not exists (select 1 from public.group_members where group_id = p_target and user_id = me) then raise exception 'Join this group first'; end if;
  if exists (select 1 from public.call_invites where caller_id = me and group_id = p_target and created_at > now() - interval '8 seconds') then
    return 0;
  end if;
  update public.call_invites set status = 'cancelled' where caller_id = me and group_id = p_target and status = 'ringing';
  -- Very large groups are not rung (it would be noisy); members still see the Join the call button.
  if (select count(*) from public.group_members where group_id = p_target) > 50 then return 0; end if;
  insert into public.call_invites (caller_id, recipient_id, kind, group_id, video)
  select me, m.user_id, 'group', p_target, p_video from public.group_members m
   where m.group_id = p_target and m.user_id <> me
     and not exists (select 1 from public.blocks b
                      where (b.blocker_id = m.user_id and b.blocked_id = me) or (b.blocker_id = me and b.blocked_id = m.user_id));
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.start_call(text, uuid, boolean) from public, anon;
grant execute on function public.start_call(text, uuid, boolean) to authenticated;

-- The person being called answers or declines
create or replace function public.respond_call(p_id uuid, p_accept boolean)
returns void language sql security definer set search_path = public as $$
  update public.call_invites set status = case when p_accept then 'accepted' else 'declined' end
   where id = p_id and recipient_id = auth.uid() and status = 'ringing';
$$;
revoke all on function public.respond_call(uuid, boolean) from public, anon;
grant execute on function public.respond_call(uuid, boolean) to authenticated;

-- The caller hangs up before anyone answers (stops the ringing everywhere)
create or replace function public.cancel_call(p_kind text, p_target uuid)
returns void language sql security definer set search_path = public as $$
  update public.call_invites set status = 'cancelled'
   where caller_id = auth.uid() and status = 'ringing'
     and ((p_kind = 'dm' and kind = 'dm' and recipient_id = p_target) or (p_kind = 'group' and group_id = p_target));
$$;
revoke all on function public.cancel_call(text, uuid) from public, anon;
grant execute on function public.cancel_call(text, uuid) to authenticated;
