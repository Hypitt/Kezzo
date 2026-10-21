-- =====================================================================
-- Kezzo update 10: promote events, and online polls (also usable beside a live stream)
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-9. Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Events: any signed-in person can publish one; everyone signed in can see and join ("I'm going")
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz check (ends_at is null or ends_at > starts_at),
  location text not null default '' check (char_length(location) <= 200),
  link text check (link is null or (char_length(link) <= 300 and link ~* '^https://')),
  cover_path text check (cover_path is null or char_length(cover_path) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists events_start_idx on public.events (starts_at);
create index if not exists events_host_idx on public.events (host_id);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
revoke all on public.events, public.event_rsvps from anon;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, delete on public.event_rsvps to authenticated;

drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated using (true);
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated with check (host_id = auth.uid());
drop policy if exists events_update on public.events;
create policy events_update on public.events for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists events_delete on public.events;
create policy events_delete on public.events for delete to authenticated using (host_id = auth.uid());

drop policy if exists rsvps_select on public.event_rsvps;
create policy rsvps_select on public.event_rsvps for select to authenticated using (user_id = auth.uid());
drop policy if exists rsvps_insert on public.event_rsvps;
create policy rsvps_insert on public.event_rsvps for insert to authenticated with check (user_id = auth.uid());
drop policy if exists rsvps_delete on public.event_rsvps;
create policy rsvps_delete on public.event_rsvps for delete to authenticated using (user_id = auth.uid());

-- How many people are going, and whether I am (nobody else's name is exposed)
create or replace function public.event_stats(p_ids uuid[])
returns table (event_id uuid, going int, me boolean)
language sql stable security definer set search_path = public as $$
  select e.id, (select count(*)::int from public.event_rsvps r where r.event_id = e.id),
         exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = auth.uid())
    from public.events e where e.id = any (p_ids);
$$;
revoke all on function public.event_stats(uuid[]) from public, anon;
grant execute on function public.event_stats(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Polls: a question with 2 to 6 answers, optionally closing at a time and optionally shown inside a live stream
-- ---------------------------------------------------------------------
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 200),
  live_id uuid references public.live_streams (id) on delete cascade,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists polls_created_idx on public.polls (created_at desc);
create index if not exists polls_live_idx on public.polls (live_id);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  position int not null default 0
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
revoke all on public.polls, public.poll_options, public.poll_votes from anon;
revoke all on public.poll_votes from authenticated;
revoke insert, update on public.polls, public.poll_options from authenticated;
grant select, delete on public.polls to authenticated;
grant select on public.poll_options to authenticated;

drop policy if exists polls_select on public.polls;
create policy polls_select on public.polls for select to authenticated using (true);
drop policy if exists polls_delete on public.polls;
create policy polls_delete on public.polls for delete to authenticated using (author_id = auth.uid());
drop policy if exists poll_options_select on public.poll_options;
create policy poll_options_select on public.poll_options for select to authenticated using (true);

-- A poll is closed once its time has passed or the live stream it belongs to has ended
create or replace function public.poll_is_open(p_poll uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.polls p
     where p.id = p_poll
       and (p.closes_at is null or p.closes_at > now())
       and (p.live_id is null or exists (select 1 from public.live_streams l where l.id = p.live_id and l.status = 'live')));
$$;
revoke all on function public.poll_is_open(uuid) from public, anon;
grant execute on function public.poll_is_open(uuid) to authenticated;

create or replace function public.create_poll(p_question text, p_options text[], p_live uuid default null, p_closes timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  clean text[];
  pid uuid;
  i int;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select coalesce(array_agg(btrim(o)) filter (where btrim(o) <> ''), '{}') into clean from unnest(p_options) as o;
  if char_length(btrim(coalesce(p_question, ''))) = 0 then raise exception 'invalid_question'; end if;
  if coalesce(array_length(clean, 1), 0) < 2 or array_length(clean, 1) > 6 then raise exception 'invalid_options'; end if;
  if exists (select 1 from unnest(clean) o where char_length(o) > 80) then raise exception 'invalid_options'; end if;
  if p_closes is not null and p_closes <= now() then raise exception 'invalid_close'; end if;
  if p_live is not null and not exists (select 1 from public.live_streams l where l.id = p_live and l.host_id = me and l.status = 'live') then
    raise exception 'not_live_host';
  end if;
  if (select count(*) from public.polls where author_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_polls';
  end if;
  insert into public.polls (author_id, question, live_id, closes_at) values (me, btrim(p_question), p_live, p_closes) returning id into pid;
  for i in 1 .. array_length(clean, 1) loop
    insert into public.poll_options (poll_id, label, position) values (pid, clean[i], i);
  end loop;
  return pid;
end;
$$;
revoke all on function public.create_poll(text, text[], uuid, timestamptz) from public, anon;
grant execute on function public.create_poll(text, text[], uuid, timestamptz) to authenticated;

-- One vote per person per poll; they can change it while the poll is open
create or replace function public.vote_poll(p_option uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  pid uuid;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  select poll_id into pid from public.poll_options where id = p_option;
  if pid is null then raise exception 'invalid_option'; end if;
  if not public.poll_is_open(pid) then raise exception 'poll_closed'; end if;
  insert into public.poll_votes (poll_id, user_id, option_id) values (pid, me, p_option)
  on conflict (poll_id, user_id) do update set option_id = excluded.option_id, created_at = now();
end;
$$;
revoke all on function public.vote_poll(uuid) from public, anon;
grant execute on function public.vote_poll(uuid) to authenticated;

-- Totals per answer, and which answer is mine (never who voted for what)
create or replace function public.poll_results(p_ids uuid[])
returns table (poll_id uuid, option_id uuid, votes int, mine boolean, open boolean)
language sql stable security definer set search_path = public as $$
  select o.poll_id, o.id,
         (select count(*)::int from public.poll_votes v where v.option_id = o.id),
         exists (select 1 from public.poll_votes v where v.option_id = o.id and v.user_id = auth.uid()),
         public.poll_is_open(o.poll_id)
    from public.poll_options o where o.poll_id = any (p_ids);
$$;
revoke all on function public.poll_results(uuid[]) from public, anon;
grant execute on function public.poll_results(uuid[]) to authenticated;
