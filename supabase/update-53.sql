-- Kezzo update 53: Invite & Earn. Count the first install of a phone, and let admins control the rules.
-- Run once in the Supabase SQL editor, after update-52. Safe to run again. Contains no secrets.
--
-- Install count: when Kezzo runs as an installed app, the phone sends a one-way "device code" (a hash, never the
-- raw device details). The first install of a device counts. Deleting and installing again on the same phone,
-- or signing in with another account on it, does not count again. A referrer's own phone cannot earn for them.

alter table public.referral_settings add column if not exists require_install boolean not null default true;
alter table public.referral_settings add column if not exists require_email boolean not null default true;
alter table public.referral_settings add column if not exists rules_text text not null default '' check (char_length(rules_text) <= 1200);

create table if not exists public.app_installs (
  device_hash text primary key check (char_length(device_hash) between 16 and 128),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null default 'web' check (source in ('web', 'native')),
  first_seen timestamptz not null default now()
);
create unique index if not exists app_installs_user_idx on public.app_installs (user_id);
alter table public.app_installs enable row level security;
revoke all on public.app_installs from anon, authenticated;

-- Returns true only when this is the first install of this device (and of this account).
create or replace function public.record_install(p_device text, p_source text default 'web')
returns boolean language plpgsql security definer set search_path = public as $$
declare added int;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_device is null or char_length(p_device) < 16 then return false; end if;
  insert into public.app_installs (device_hash, user_id, source)
  values (left(p_device, 128), auth.uid(), case when p_source = 'native' then 'native' else 'web' end)
  on conflict do nothing;
  get diagnostics added = row_count;
  return added > 0;
end $$;

create or replace function public._referral_eval(p_referrer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.referral_settings; r record; acts int; this_month int; confirmed boolean; made timestamptz;
begin
  select * into s from public.referral_settings where id = 1;
  if not s.enabled then return; end if;
  for r in select * from public.referrals where status = 'pending' and (p_referrer is null or referrer_id = p_referrer) order by created_at loop
    if exists (select 1 from public.referral_codes where user_id = r.referrer_id and blocked) then continue; end if;
    select created_at into made from public.profiles where id = r.referred_id;
    if made is null or made > now() - make_interval(days => s.min_days) then continue; end if;
    if s.require_email then
      select (email_confirmed_at is not null) into confirmed from auth.users where id = r.referred_id;
      if not coalesce(confirmed, false) then continue; end if;
    end if;
    if s.require_install and not exists (select 1 from public.app_installs where user_id = r.referred_id) then continue; end if;
    select (select count(*) from public.posts where author_id = r.referred_id)
         + (select count(*) from public.post_comments where author_id = r.referred_id)
         + (select count(*) from public.post_likes where user_id = r.referred_id) into acts;
    if acts < s.min_actions then continue; end if;
    select count(*) into this_month from public.referrals
      where referrer_id = r.referrer_id and status in ('qualified', 'paid') and qualified_at >= date_trunc('month', now());
    if this_month >= s.monthly_cap then continue; end if;
    update public.referrals set status = 'qualified', reward_cents = s.reward_cents, qualified_at = now() where id = r.id;
  end loop;
end $$;
revoke all on function public._referral_eval(uuid) from public, anon, authenticated;

-- Member page: now also tells which rules are on, and shows the admin's own rules text.
create or replace function public.referral_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.referral_settings; code text; info text; rows jsonb;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  code := public.my_referral_code();
  perform public._referral_eval(auth.uid());
  select * into s from public.referral_settings where id = 1;
  select payout_info into info from public.referral_codes where user_id = auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'status', r.status, 'created_at', r.created_at, 'reward_cents', r.reward_cents) order by r.created_at desc), '[]'::jsonb)
    into rows from public.referrals r join public.profiles p on p.id = r.referred_id where r.referrer_id = auth.uid();
  return jsonb_build_object(
    'code', code, 'payout_info', coalesce(info, ''),
    'settings', jsonb_build_object('enabled', s.enabled, 'reward_cents', s.reward_cents, 'min_actions', s.min_actions, 'min_days', s.min_days, 'monthly_cap', s.monthly_cap,
       'min_payout_cents', s.min_payout_cents, 'require_install', s.require_install, 'require_email', s.require_email, 'rules_text', s.rules_text),
    'pending', (select count(*) from public.referrals where referrer_id = auth.uid() and status = 'pending'),
    'qualified', (select count(*) from public.referrals where referrer_id = auth.uid() and status in ('qualified', 'paid')),
    'balance_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where referrer_id = auth.uid() and status = 'qualified'),
    'paid_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where referrer_id = auth.uid() and status = 'paid'),
    'referrals', rows);
end $$;

-- Admin: summary now also counts installs.
create or replace function public.admin_referral_summary()
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.referral_settings;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  perform public._referral_eval(null);
  select * into s from public.referral_settings where id = 1;
  return jsonb_build_object(
    'settings', to_jsonb(s),
    'pending', (select count(*) from public.referrals where status = 'pending'),
    'qualified', (select count(*) from public.referrals where status = 'qualified'),
    'paid', (select count(*) from public.referrals where status = 'paid'),
    'rejected', (select count(*) from public.referrals where status = 'rejected'),
    'installs', (select count(*) from public.app_installs),
    'owed_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where status = 'qualified'),
    'paid_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where status = 'paid'));
end $$;

-- Admin: all the rules in one call.
drop function if exists public.admin_referral_settings(boolean, int, int, int, int, int, int);
create or replace function public.admin_referral_settings(p_enabled boolean, p_reward int, p_actions int, p_days int, p_window int, p_cap int, p_min_payout int,
  p_install boolean, p_email boolean, p_rules text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.referral_settings set enabled = p_enabled, reward_cents = greatest(p_reward, 0), min_actions = greatest(p_actions, 0),
    min_days = greatest(p_days, 0), claim_window_days = greatest(p_window, 0), monthly_cap = greatest(p_cap, 0), min_payout_cents = greatest(p_min_payout, 0),
    require_install = coalesce(p_install, true), require_email = coalesce(p_email, true), rules_text = left(coalesce(p_rules, ''), 1200) where id = 1;
  perform public.log_admin('referral_settings', 'settings', null, 'reward ' || p_reward || ' cents');
end $$;

-- Admin: accept a pending referral by hand (for a real person the automatic checks could not see).
create or replace function public.admin_referral_approve(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.referral_settings;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  select * into s from public.referral_settings where id = 1;
  update public.referrals set status = 'qualified', reward_cents = s.reward_cents, qualified_at = now() where id = p_id and status = 'pending';
  if not found then raise exception 'cannot_approve'; end if;
  perform public.log_admin('referral_approve', 'referral', p_id, '');
end $$;

revoke all on function public.record_install(text, text), public.referral_stats(), public.admin_referral_summary(),
  public.admin_referral_settings(boolean, int, int, int, int, int, int, boolean, boolean, text), public.admin_referral_approve(uuid) from public, anon;
grant execute on function public.record_install(text, text), public.referral_stats(), public.admin_referral_summary(),
  public.admin_referral_settings(boolean, int, int, int, int, int, int, boolean, boolean, text), public.admin_referral_approve(uuid) to authenticated;
