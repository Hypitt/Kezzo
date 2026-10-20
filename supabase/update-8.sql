-- =====================================================================
-- Kezzo update 8: featured groups and live counters on the public landing page
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-7. Safe to run more than once.
--
-- Group owners and admins can choose to show an open group on the public landing page. Visitors only see the group's
-- name, tagline, category and member count; to join, they must sign up or log in. Visitors also see how many battles
-- and livestreams are live right now (a number only, never who or what).
-- =====================================================================
alter table public.groups add column if not exists featured boolean not null default false;

-- An invite-only group can never be featured (visitors could not join it anyway)
create or replace function public.trg_group_unfeature() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.join_policy <> 'open' then new.featured := false; end if;
  return new;
end; $$;
drop trigger if exists group_unfeature on public.groups;
create trigger group_unfeature before insert or update of join_policy on public.groups for each row execute function public.trg_group_unfeature();

-- Only the group's owner / admins (or a Kezzo admin, to take a group down) can change this
create or replace function public.set_group_featured(p_group uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not (public.is_group_admin(p_group) or public.is_admin()) then raise exception 'not_admin'; end if;
  if p_on and not exists (select 1 from public.groups where id = p_group and join_policy = 'open') then
    raise exception 'invite_only_group';
  end if;
  update public.groups set featured = p_on where id = p_group;
end; $$;
revoke all on function public.set_group_featured(uuid, boolean) from public, anon;
grant execute on function public.set_group_featured(uuid, boolean) to authenticated;

-- What the public landing page may read (callable without an account, limited to these few fields)
create or replace function public.landing_groups()
returns table (id uuid, name text, tagline text, category text, member_count int)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.tagline, g.category, g.member_count
    from public.groups g
   where g.featured and g.join_policy = 'open'
   order by g.member_count desc, g.created_at desc
   limit 6;
$$;
revoke all on function public.landing_groups() from public;
grant execute on function public.landing_groups() to anon, authenticated;

create or replace function public.landing_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'live_battles', (select count(*) from public.battles where status = 'live'),
    'live_streams', (select count(*) from public.live_streams where status = 'live'));
$$;
revoke all on function public.landing_stats() from public;
grant execute on function public.landing_stats() to anon, authenticated;
