-- =====================================================================
-- Kezzo update 23: Opportunities (scholarships, jobs, training, events) that members share and find near them
--   * opportunities: a post with a kind, place (country + city, or online), optional deadline, link and contact
--   * anyone signed in can post (at most 5 per day); the author can edit or delete; admins can hide a post
--   * reports can now point at an opportunity
-- Run this in the Supabase SQL Editor AFTER the earlier updates. Safe to run more than once.
-- =====================================================================
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('scholarship', 'job', 'training', 'event', 'other')),
  title text not null check (char_length(title) between 3 and 120),
  org text not null default '' check (char_length(org) <= 100),
  body text not null default '' check (char_length(body) <= 3000),
  country text not null default '' check (char_length(country) <= 60),
  city text not null default '' check (char_length(city) <= 80),
  online boolean not null default false,
  deadline date,
  link text check (link is null or (char_length(link) <= 300 and link ~* '^https?://')),
  contact text check (contact is null or char_length(contact) <= 120),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (online or country <> '')
);
create index if not exists opportunities_created_idx on public.opportunities (created_at desc);
create index if not exists opportunities_country_idx on public.opportunities (lower(country), lower(city));
create index if not exists opportunities_author_idx on public.opportunities (author_id, created_at desc);
alter table public.opportunities enable row level security;

revoke all on public.opportunities from anon, authenticated;
grant select on public.opportunities to authenticated;
grant insert (author_id, kind, title, org, body, country, city, online, deadline, link, contact) on public.opportunities to authenticated;
grant update (kind, title, org, body, country, city, online, deadline, link, contact) on public.opportunities to authenticated;
grant delete on public.opportunities to authenticated;

drop policy if exists opportunities_select on public.opportunities;
create policy opportunities_select on public.opportunities for select to authenticated using (not hidden or author_id = auth.uid());
drop policy if exists opportunities_insert on public.opportunities;
create policy opportunities_insert on public.opportunities for insert to authenticated with check (author_id = auth.uid());
drop policy if exists opportunities_update on public.opportunities;
create policy opportunities_update on public.opportunities for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists opportunities_delete on public.opportunities;
create policy opportunities_delete on public.opportunities for delete to authenticated using (author_id = auth.uid());

-- At most 5 new opportunities per person per day
create or replace function public.opportunities_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.opportunities where author_id = new.author_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate_limited';
  end if;
  return new;
end; $$;
drop trigger if exists opportunities_limit_trg on public.opportunities;
create trigger opportunities_limit_trg before insert on public.opportunities for each row execute function public.opportunities_limit();

-- Admins hide (or show again) a post
create or replace function public.admin_hide_opportunity(p_id uuid, p_hide boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.opportunities set hidden = coalesce(p_hide, true) where id = p_id;
end; $$;
revoke all on function public.admin_hide_opportunity(uuid, boolean) from public, anon;
grant execute on function public.admin_hide_opportunity(uuid, boolean) to authenticated;

-- Admins also see hidden posts, to be able to show them again
create or replace function public.admin_opportunities_hidden()
returns setof public.opportunities language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select * from public.opportunities where hidden order by created_at desc limit 100;
end; $$;
revoke all on function public.admin_opportunities_hidden() from public, anon;
grant execute on function public.admin_opportunities_hidden() to authenticated;

-- Reports can point at an opportunity
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'profile', 'battle', 'group', 'message', 'opportunity'));
