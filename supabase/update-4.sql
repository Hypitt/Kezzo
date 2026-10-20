-- =====================================================================
-- Kezzo update 4: admin statistics (visitors, page views, sign-ins, platform activity)
-- Run this in the Supabase SQL Editor AFTER schema.sql, update-2.sql and update-3.sql. Safe to run more than once.
--
-- After running it, make yourself an admin (replace the e-mail with the one you sign in with):
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
-- =====================================================================

-- ---------------------------------------------------------------------
-- Who is an admin. No policies on purpose: nobody can read or write this table from the app.
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Anonymous usage events. Written only by the server (api/track.ts, service role); read only through admin_stats().
-- No IP address, no user agent string, no page content: only a random visitor id, the page pattern and coarse device data.
-- ---------------------------------------------------------------------
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('pageview', 'signin', 'signup', 'signout', 'perf', 'error')),
  visitor text not null check (char_length(visitor) between 8 and 64),
  session text not null check (char_length(session) between 8 and 64),
  user_id uuid,
  path text check (char_length(path) <= 120),
  referrer text check (char_length(referrer) <= 120),
  country text check (char_length(country) <= 3),
  device text check (device in ('mobile', 'tablet', 'desktop', 'other')),
  browser text check (char_length(browser) <= 30),
  os text check (char_length(os) <= 30),
  lang text check (char_length(lang) <= 8),
  value int,
  detail text check (char_length(detail) <= 160)
);
create index if not exists analytics_events_time_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_kind_idx on public.analytics_events (kind, created_at desc);
create index if not exists analytics_events_visitor_idx on public.analytics_events (visitor, created_at);
alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

-- Deletes events older than the retention period (13 months by default). Called by the tracking endpoint now and then.
create or replace function public.purge_analytics(p_months int default 13)
returns void language sql security definer set search_path = public as $$
  delete from public.analytics_events where created_at < now() - make_interval(months => greatest(p_months, 1));
$$;
revoke all on function public.purge_analytics(int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- One call returns everything the dashboard shows. Admins only.
-- ---------------------------------------------------------------------
create or replace function public.admin_stats(p_days int default 30, p_tz text default 'UTC')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d int := least(greatest(coalesce(p_days, 30), 1), 365);
  tz text := case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  today date := (now() at time zone (case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'UTC' end))::date;
  since timestamptz;
  prev_since timestamptz;
  cur jsonb;
  prev jsonb;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  since := ((today - (d - 1))::timestamp) at time zone tz;
  prev_since := ((today - (2 * d - 1))::timestamp) at time zone tz;

  -- Headline numbers for the period and for the period before it
  with w(label, lo, hi) as (values ('cur', since, now() + interval '1 minute'), ('prev', prev_since, since)),
  base as (
    select w.label, e.*
      from w join public.analytics_events e on e.created_at >= w.lo and e.created_at < w.hi
  ),
  sess as (
    select label, session, count(*) filter (where kind = 'pageview') as pv
      from base group by label, session
  ),
  agg as (
    select label,
           count(distinct visitor) filter (where kind = 'pageview') as visitors,
           count(*) filter (where kind = 'pageview') as views,
           count(distinct session) filter (where kind = 'pageview') as sessions,
           count(*) filter (where kind = 'signin') as signins,
           count(distinct user_id) filter (where kind in ('signin', 'pageview') and user_id is not null) as active_users,
           count(*) filter (where kind = 'error') as errors,
           round(avg(value) filter (where kind = 'perf'))::int as load_avg,
           round(percentile_cont(0.75) within group (order by value) filter (where kind = 'perf'))::int as load_p75
      from base group by label
  ),
  sagg as (
    select label,
           count(*) filter (where pv = 1) as bounced,
           count(*) filter (where pv >= 1) as counted,
           coalesce(avg(pv) filter (where pv >= 1), 0) as pages_per_session
      from sess group by label
  )
  select jsonb_object_agg(a.label, jsonb_build_object(
           'visitors', a.visitors, 'views', a.views, 'sessions', a.sessions, 'signins', a.signins,
           'active_users', a.active_users, 'errors', a.errors, 'load_avg', a.load_avg, 'load_p75', a.load_p75,
           'bounce_rate', case when s.counted > 0 then round(100.0 * s.bounced / s.counted, 1) else 0 end,
           'pages_per_session', round(s.pages_per_session, 2)))
    into result
    from agg a left join sagg s using (label);

  cur := coalesce(result -> 'cur', '{}'::jsonb);
  prev := coalesce(result -> 'prev', '{}'::jsonb);

  return jsonb_build_object(
    'days', d,
    'tz', tz,
    'generated_at', now(),
    'tracking_since', (select min(created_at) from public.analytics_events),
    'current', cur,
    'previous', prev,

    -- Visitors who had never been seen before this period vs those who came back
    'new_visitors', (
      select count(*) from (
        select visitor from public.analytics_events
         where visitor in (select visitor from public.analytics_events where kind = 'pageview' and created_at >= since)
         group by visitor having min(created_at) >= since) x),

    'online_now', (select count(distinct visitor) from public.analytics_events
                    where kind = 'pageview' and created_at >= now() - interval '30 minutes'),

    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'day', g.day, 'visitors', coalesce(s.visitors, 0), 'views', coalesce(s.views, 0),
               'signins', coalesce(s.signins, 0), 'new_users', coalesce(u.n, 0)) order by g.day), '[]'::jsonb)
        from (select generate_series((today - (d - 1))::timestamp, today::timestamp, interval '1 day')::date as day) g
        left join (
          select (created_at at time zone tz)::date as day,
                 count(distinct visitor) filter (where kind = 'pageview') as visitors,
                 count(*) filter (where kind = 'pageview') as views,
                 count(*) filter (where kind = 'signin') as signins
            from public.analytics_events where created_at >= since group by 1) s on s.day = g.day
        left join (
          select (created_at at time zone tz)::date as day, count(*) as n
            from public.profiles where created_at >= since group by 1) u on u.day = g.day),

    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', h.hour, 'views', coalesce(c.n, 0)) order by h.hour), '[]'::jsonb)
        from generate_series(0, 23) as h(hour)
        left join (select extract(hour from created_at at time zone tz)::int as hour, count(*) as n
                     from public.analytics_events where kind = 'pageview' and created_at >= since group by 1) c on c.hour = h.hour),

    'pages', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct visitor) as visitors
          from public.analytics_events where kind = 'pageview' and created_at >= since and path is not null
         group by path order by views desc limit 12) t),

    'referrers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(nullif(referrer, ''), 'direct') as name, count(distinct session) as sessions
          from public.analytics_events where kind = 'pageview' and created_at >= since
         group by 1 order by sessions desc limit 8) t),

    'countries', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(nullif(country, ''), '??') as name, count(distinct visitor) as visitors
          from public.analytics_events where kind = 'pageview' and created_at >= since
         group by 1 order by visitors desc limit 10) t),

    'devices', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(device, 'other') as name, count(distinct visitor) as visitors
          from public.analytics_events where kind = 'pageview' and created_at >= since
         group by 1 order by visitors desc) t),

    'browsers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(browser, 'Other') as name, count(distinct visitor) as visitors
          from public.analytics_events where kind = 'pageview' and created_at >= since
         group by 1 order by visitors desc limit 6) t),

    'systems', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(os, 'Other') as name, count(distinct visitor) as visitors
          from public.analytics_events where kind = 'pageview' and created_at >= since
         group by 1 order by visitors desc limit 6) t),

    'languages', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(nullif(lang, ''), '??') as name, count(distinct visitor) as visitors
          from public.analytics_events where kind = 'pageview' and created_at >= since
         group by 1 order by visitors desc limit 6) t),

    'signin_methods', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select coalesce(nullif(detail, ''), 'unknown') as name, count(*) as n
          from public.analytics_events where kind = 'signin' and created_at >= since
         group by 1 order by n desc) t),

    'errors', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select detail as name, count(*) as n, max(created_at) as last_seen
          from public.analytics_events where kind = 'error' and created_at >= since and detail is not null
         group by detail order by n desc limit 8) t),

    -- Platform totals straight from the real tables
    'platform', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'new_users', (select count(*) from public.profiles where created_at >= since),
      'posts', (select count(*) from public.posts),
      'new_posts', (select count(*) from public.posts where created_at >= since),
      'likes', (select count(*) from public.post_likes where created_at >= since),
      'comments', (select count(*) from public.post_comments where created_at >= since),
      'follows', (select count(*) from public.follows where created_at >= since),
      'battles', (select count(*) from public.battles),
      'new_battles', (select count(*) from public.battles where created_at >= since),
      'battles_live', (select count(*) from public.battles where status = 'live'),
      'battles_ended', (select count(*) from public.battles where status = 'ended'),
      'votes', (select count(*) from public.battle_votes where created_at >= since),
      'live_streams', (select count(*) from public.live_streams where created_at >= since),
      'live_now', (select count(*) from public.live_streams where status = 'live'),
      'groups', (select count(*) from public.groups),
      'messages', (select count(*) from public.direct_messages where created_at >= since)
                + (select count(*) from public.chat_messages where created_at >= since),
      'reports', (select count(*) from public.reports)
    )
  );
end;
$$;
revoke all on function public.admin_stats(int, text) from public, anon;
grant execute on function public.admin_stats(int, text) to authenticated;
