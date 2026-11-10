-- =====================================================================
-- Kezzo update 40: moderation tools for Kezzo admins
--   * Suspend or ban a member (they can still read, but can no longer post, comment, message, like, go live or start battles)
--   * A queue of reports, one line per reported item, to review and resolve
--   * Search and remove posts, comments, groups, battles, chat messages and opportunities
--   * An activity log of everything admins do
-- Run in the Supabase SQL Editor AFTER update-39. Safe to run more than once.
-- =====================================================================

-- 1. Restrictions -------------------------------------------------------
create table if not exists public.user_restrictions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null check (status in ('suspended', 'banned')),
  reason text not null default '' check (char_length(reason) <= 300),
  until timestamptz,
  set_by uuid references public.profiles (id) on delete set null,
  set_at timestamptz not null default now()
);
alter table public.user_restrictions enable row level security;
revoke all on public.user_restrictions from anon, authenticated;

create or replace function public.is_restricted(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_restrictions r
                  where r.user_id = p_user and (r.status = 'banned' or r.until is null or r.until > now()));
$$;
revoke all on function public.is_restricted(uuid) from public, anon, authenticated;

create or replace function public.trg_block_restricted()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  uid := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  if uid is not null and public.is_restricted(uid) then raise exception 'account_restricted'; end if;
  return new;
end; $$;
revoke all on function public.trg_block_restricted() from public, anon, authenticated;

do $$
declare x record;
begin
  for x in select * from (values
    ('posts', 'author_id'), ('post_comments', 'author_id'), ('post_likes', 'user_id'), ('chat_messages', 'author_id'),
    ('direct_messages', 'sender_id'), ('battles', 'host_id'), ('live_streams', 'host_id'), ('groups', 'owner_id'),
    ('opportunities', 'author_id'), ('events', 'author_id')) as v(t, c) loop
    if to_regclass('public.' || x.t) is not null
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = x.t and column_name = x.c) then
      execute format('drop trigger if exists block_restricted on public.%I', x.t);
      execute format('create trigger block_restricted before insert on public.%I for each row execute function public.trg_block_restricted(%L)', x.t, x.c);
    end if;
  end loop;
end $$;

-- A member can see their own restriction (to show a notice)
create or replace function public.my_restriction()
returns table (status text, reason text, until timestamptz)
language sql stable security definer set search_path = public as $$
  select r.status, r.reason, r.until from public.user_restrictions r
   where r.user_id = auth.uid() and (r.status = 'banned' or r.until is null or r.until > now());
$$;
revoke all on function public.my_restriction() from public, anon;
grant execute on function public.my_restriction() to authenticated;

-- 2. Activity log -------------------------------------------------------
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_time_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from anon, authenticated;

create or replace function public.log_admin(p_action text, p_type text, p_id uuid, p_detail text)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_actions (admin_id, action, target_type, target_id, detail)
  values (auth.uid(), p_action, p_type, p_id, left(coalesce(p_detail, ''), 300));
$$;
revoke all on function public.log_admin(text, text, uuid, text) from public, anon, authenticated;

create or replace function public.admin_log(p_limit integer default 100)
returns table (id uuid, created_at timestamptz, admin_name text, action text, target_type text, target_id uuid, detail text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select a.id, a.created_at, p.display_name, a.action, a.target_type, a.target_id, a.detail
      from public.admin_actions a left join public.profiles p on p.id = a.admin_id
     order by a.created_at desc limit least(greatest(p_limit, 1), 300);
end; $$;
revoke all on function public.admin_log(integer) from public, anon;
grant execute on function public.admin_log(integer) to authenticated;

-- 3. Reports ------------------------------------------------------------
alter table public.reports add column if not exists resolved_at timestamptz;
alter table public.reports add column if not exists resolved_by uuid references public.profiles (id) on delete set null;
alter table public.reports add column if not exists resolution text;

create or replace function public.admin_reports(p_status text default 'open', p_limit integer default 100)
returns table (target_type text, target_id uuid, report_count integer, last_at timestamptz, reason text, resolved boolean,
               resolution text, preview text, owner_id uuid, owner_name text, owner_status text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  with g as (
    select r.target_type as tt, r.target_id as tid, count(*)::int as n, max(r.created_at) as last_at,
           (array_agg(r.reason order by r.created_at desc))[1] as reason,
           bool_and(r.resolved_at is not null) as resolved, max(r.resolution) as resolution
      from public.reports r group by r.target_type, r.target_id
  ), t as (
    select g.*,
      case g.tt
        when 'post' then (select x.title from public.posts x where x.id = g.tid)
        when 'profile' then (select x.display_name from public.profiles x where x.id = g.tid)
        when 'battle' then (select x.title from public.battles x where x.id = g.tid)
        when 'group' then (select x.name from public.groups x where x.id = g.tid)
        when 'message' then (select left(x.body, 120) from public.chat_messages x where x.id = g.tid)
        when 'opportunity' then (select x.title from public.opportunities x where x.id = g.tid)
      end as preview,
      case g.tt
        when 'post' then (select x.author_id from public.posts x where x.id = g.tid)
        when 'profile' then g.tid
        when 'battle' then (select x.host_id from public.battles x where x.id = g.tid)
        when 'group' then (select x.owner_id from public.groups x where x.id = g.tid)
        when 'message' then (select x.author_id from public.chat_messages x where x.id = g.tid)
        when 'opportunity' then (select x.author_id from public.opportunities x where x.id = g.tid)
      end as oid
    from g
  )
  select t.tt, t.tid, t.n, t.last_at, t.reason, t.resolved, t.resolution, t.preview, t.oid, p.display_name,
         (select r.status from public.user_restrictions r where r.user_id = t.oid and public.is_restricted(r.user_id))
    from t left join public.profiles p on p.id = t.oid
   where p_status = 'all' or (p_status = 'open' and not t.resolved) or (p_status = 'resolved' and t.resolved)
   order by t.last_at desc limit least(greatest(p_limit, 1), 300);
end; $$;
revoke all on function public.admin_reports(text, integer) from public, anon;
grant execute on function public.admin_reports(text, integer) to authenticated;

create or replace function public.admin_resolve_reports(p_type text, p_id uuid, p_resolution text default 'dismissed')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.reports set resolved_at = now(), resolved_by = auth.uid(), resolution = left(coalesce(p_resolution, 'dismissed'), 40)
   where target_type = p_type and target_id = p_id and resolved_at is null;
  perform public.log_admin('resolve_report', p_type, p_id, p_resolution);
end; $$;
revoke all on function public.admin_resolve_reports(text, uuid, text) from public, anon;
grant execute on function public.admin_resolve_reports(text, uuid, text) to authenticated;

-- 4. Members ------------------------------------------------------------
create or replace function public.admin_users(p_q text default '', p_filter text default 'all', p_limit integer default 40, p_offset integer default 0)
returns table (id uuid, handle text, display_name text, avatar_url text, created_at timestamptz, posts integer, open_reports integer,
               status text, until timestamptz, reason text, is_admin boolean)
language plpgsql stable security definer set search_path = public as $$
declare q text := '%' || replace(replace(coalesce(p_q, ''), '%', ''), '_', '') || '%';
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
  select * from (
    select p.id, p.handle, p.display_name, p.avatar_url, p.created_at,
           (select count(*) from public.posts x where x.author_id = p.id)::int as posts,
           (select count(*) from public.reports r where r.resolved_at is null
              and ((r.target_type = 'profile' and r.target_id = p.id)
                or (r.target_type = 'post' and r.target_id in (select x.id from public.posts x where x.author_id = p.id))))::int as open_reports,
           (select case when public.is_restricted(p.id) then r.status end from public.user_restrictions r where r.user_id = p.id) as status,
           (select r.until from public.user_restrictions r where r.user_id = p.id and public.is_restricted(p.id)) as until,
           (select r.reason from public.user_restrictions r where r.user_id = p.id and public.is_restricted(p.id)) as reason,
           exists (select 1 from public.admins a where a.user_id = p.id) as is_admin
      from public.profiles p
     where (p.handle ilike q or p.display_name ilike q)
  ) u
  where p_filter = 'all' or (p_filter = 'restricted' and u.status is not null) or (p_filter = 'reported' and u.open_reports > 0)
  order by u.open_reports desc, u.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end; $$;
revoke all on function public.admin_users(text, text, integer, integer) from public, anon;
grant execute on function public.admin_users(text, text, integer, integer) to authenticated;

create or replace function public.admin_set_user_status(p_user uuid, p_status text, p_reason text default '', p_days integer default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_user = auth.uid() then raise exception 'self'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then raise exception 'is_admin'; end if;
  if p_status = 'active' then
    delete from public.user_restrictions where user_id = p_user;
  elsif p_status in ('suspended', 'banned') then
    insert into public.user_restrictions (user_id, status, reason, until, set_by)
    values (p_user, p_status, left(coalesce(p_reason, ''), 300),
            case when p_status = 'suspended' and coalesce(p_days, 0) > 0 then now() + make_interval(days => p_days) end, auth.uid())
    on conflict (user_id) do update set status = excluded.status, reason = excluded.reason, until = excluded.until,
                                        set_by = excluded.set_by, set_at = now();
  else
    raise exception 'bad_status';
  end if;
  perform public.log_admin('user_' || p_status, 'profile', p_user, coalesce(p_reason, '') || case when p_days is not null then ' (' || p_days || ' days)' else '' end);
end; $$;
revoke all on function public.admin_set_user_status(uuid, text, text, integer) from public, anon;
grant execute on function public.admin_set_user_status(uuid, text, text, integer) to authenticated;

-- 5. Content ------------------------------------------------------------
create or replace function public.admin_content(p_type text, p_q text default '', p_limit integer default 40)
returns table (id uuid, kind text, title text, author_id uuid, author_name text, created_at timestamptz, post_id uuid, reports integer)
language plpgsql stable security definer set search_path = public as $$
declare q text := '%' || replace(replace(coalesce(p_q, ''), '%', ''), '_', '') || '%'; lim integer := least(greatest(p_limit, 1), 100);
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_type = 'post' then
    return query select x.id, x.kind::text, x.title, x.author_id, a.display_name, x.created_at, null::uuid,
           (select count(*)::int from public.reports r where r.target_type = 'post' and r.target_id = x.id)
      from public.posts x join public.profiles a on a.id = x.author_id
     where x.title ilike q or a.display_name ilike q order by x.created_at desc limit lim;
  elsif p_type = 'comment' then
    return query select x.id, 'comment'::text, left(x.body, 160), x.author_id, a.display_name, x.created_at, x.post_id, 0
      from public.post_comments x join public.profiles a on a.id = x.author_id
     where x.body ilike q or a.display_name ilike q order by x.created_at desc limit lim;
  elsif p_type = 'group' then
    return query select x.id, 'group'::text, x.name, x.owner_id, a.display_name, x.created_at, null::uuid,
           (select count(*)::int from public.reports r where r.target_type = 'group' and r.target_id = x.id)
      from public.groups x join public.profiles a on a.id = x.owner_id
     where x.name ilike q or a.display_name ilike q order by x.created_at desc limit lim;
  elsif p_type = 'battle' then
    return query select x.id, 'battle'::text, x.title, x.host_id, a.display_name, x.created_at, null::uuid,
           (select count(*)::int from public.reports r where r.target_type = 'battle' and r.target_id = x.id)
      from public.battles x join public.profiles a on a.id = x.host_id
     where x.title ilike q or a.display_name ilike q order by x.created_at desc limit lim;
  elsif p_type = 'opportunity' then
    return query select x.id, 'opportunity'::text, x.title, x.author_id, a.display_name, x.created_at, null::uuid,
           (select count(*)::int from public.reports r where r.target_type = 'opportunity' and r.target_id = x.id)
      from public.opportunities x join public.profiles a on a.id = x.author_id
     where x.title ilike q or a.display_name ilike q order by x.created_at desc limit lim;
  else
    raise exception 'bad_type';
  end if;
end; $$;
revoke all on function public.admin_content(text, text, integer) from public, anon;
grant execute on function public.admin_content(text, text, integer) to authenticated;

create or replace function public.admin_remove_content(p_type text, p_id uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_type = 'post' then delete from public.posts where id = p_id;
  elsif p_type = 'comment' then delete from public.post_comments where id = p_id;
  elsif p_type = 'group' then delete from public.groups where id = p_id;
  elsif p_type = 'battle' then delete from public.battles where id = p_id;
  elsif p_type = 'message' then delete from public.chat_messages where id = p_id;
  elsif p_type = 'opportunity' then update public.opportunities set hidden = true where id = p_id;
  else raise exception 'bad_type';
  end if;
  update public.reports set resolved_at = now(), resolved_by = auth.uid(), resolution = 'removed'
   where target_type = p_type and target_id = p_id and resolved_at is null;
  perform public.log_admin('remove_' || p_type, p_type, p_id, p_reason);
end; $$;
revoke all on function public.admin_remove_content(text, uuid, text) from public, anon;
grant execute on function public.admin_remove_content(text, uuid, text) to authenticated;

-- 6. Overview numbers ---------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'open_reports', (select count(distinct r.target_type || ':' || r.target_id::text) from public.reports r where r.resolved_at is null),
    'restricted_users', (select count(*) from public.user_restrictions r where public.is_restricted(r.user_id)),
    'contests_open', (select count(*) from public.contests c where not c.hidden and now() between c.starts_at and c.ends_at),
    'contests_hidden', (select count(*) from public.contests c where c.hidden),
    'actions_24h', (select count(*) from public.admin_actions a where a.created_at > now() - interval '24 hours'),
    'members', (select count(*) from public.profiles));
end; $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
