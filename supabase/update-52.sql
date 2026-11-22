-- Kezzo update 52: Invite & Earn (referral program) with admin control.
-- Run once in the Supabase SQL editor, after update-51. Safe to run again. Contains no secrets.
--
-- How it works:
--  * every member gets a personal code (and link kezzo.live/?ref=CODE)
--  * a new member claims a code within a few days of signing up (once, never their own)
--  * the referral stays "pending" until the new member is real: confirmed e-mail, old enough, and active
--    (posts, comments or likes). Then it becomes "qualified" and the reward is added to the referrer's balance.
--  * once a month an admin pays the balances and marks them "paid". Admins can reject fakes and block abusers.

create table if not exists public.referral_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  reward_cents int not null default 100 check (reward_cents >= 0),
  min_actions int not null default 3 check (min_actions >= 0),
  min_days int not null default 3 check (min_days >= 0),
  claim_window_days int not null default 7 check (claim_window_days >= 0),
  monthly_cap int not null default 30 check (monthly_cap >= 0),
  min_payout_cents int not null default 500 check (min_payout_cents >= 0)
);
insert into public.referral_settings (id) values (1) on conflict do nothing;
alter table public.referral_settings enable row level security;
revoke all on public.referral_settings from anon, authenticated;

create table if not exists public.referral_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{6,12}$'),
  payout_info text not null default '' check (char_length(payout_info) <= 200),
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
drop policy if exists referral_codes_own on public.referral_codes;
create policy referral_codes_own on public.referral_codes for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.referral_codes from anon, authenticated;
grant select on public.referral_codes to authenticated;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null unique references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'qualified', 'paid', 'rejected')),
  reward_cents int not null default 0,
  reject_reason text not null default '' check (char_length(reject_reason) <= 200),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  paid_at timestamptz,
  paid_note text not null default '' check (char_length(paid_note) <= 200),
  check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, status);
alter table public.referrals enable row level security;
drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals for select to authenticated using (referrer_id = auth.uid() or public.is_admin());
revoke all on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;

-- A member's own code, made the first time it is asked for.
create or replace function public.my_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare got text; cand text; alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789'; i int; tries int := 0;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select code into got from public.referral_codes where user_id = auth.uid();
  if got is not null then return got; end if;
  loop
    cand := '';
    for i in 1..7 loop cand := cand || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    insert into public.referral_codes (user_id, code) values (auth.uid(), cand) on conflict do nothing;
    select code into got from public.referral_codes where user_id = auth.uid();
    if got is not null then return got; end if;
    tries := tries + 1;
    if tries > 20 then raise exception 'no_code'; end if;
  end loop;
end $$;

-- The new member claims a code. Returns ok, disabled, bad_code, self, already, too_late or blocked.
create or replace function public.claim_referral(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare s public.referral_settings; c public.referral_codes; created timestamptz;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select * into s from public.referral_settings where id = 1;
  if not s.enabled then return 'disabled'; end if;
  if exists (select 1 from public.referrals where referred_id = auth.uid()) then return 'already'; end if;
  select * into c from public.referral_codes where code = lower(trim(coalesce(p_code, '')));
  if not found then return 'bad_code'; end if;
  if c.user_id = auth.uid() then return 'self'; end if;
  if c.blocked then return 'blocked'; end if;
  select created_at into created from public.profiles where id = auth.uid();
  if created is null or created < now() - make_interval(days => s.claim_window_days) then return 'too_late'; end if;
  insert into public.referrals (referrer_id, referred_id) values (c.user_id, auth.uid()) on conflict do nothing;
  return 'ok';
end $$;

-- Checks pending referrals (of one referrer, or all when null) and qualifies the real ones.
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
    select (email_confirmed_at is not null) into confirmed from auth.users where id = r.referred_id;
    if not coalesce(confirmed, false) then continue; end if;
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

-- Everything the Invite & Earn page needs for the signed-in member.
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
    'settings', jsonb_build_object('enabled', s.enabled, 'reward_cents', s.reward_cents, 'min_actions', s.min_actions, 'min_days', s.min_days, 'monthly_cap', s.monthly_cap, 'min_payout_cents', s.min_payout_cents),
    'pending', (select count(*) from public.referrals where referrer_id = auth.uid() and status = 'pending'),
    'qualified', (select count(*) from public.referrals where referrer_id = auth.uid() and status in ('qualified', 'paid')),
    'balance_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where referrer_id = auth.uid() and status = 'qualified'),
    'paid_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where referrer_id = auth.uid() and status = 'paid'),
    'referrals', rows);
end $$;

create or replace function public.referral_set_payout(p_info text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.my_referral_code();
  update public.referral_codes set payout_info = left(trim(coalesce(p_info, '')), 200) where user_id = auth.uid();
end $$;

-- ------------------------------------------------------------------ admin
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
    'owed_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where status = 'qualified'),
    'paid_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where status = 'paid'));
end $$;

create or replace function public.admin_referral_list(p_status text, p_limit int default 100)
returns table (id uuid, status text, reward_cents int, reject_reason text, created_at timestamptz, qualified_at timestamptz,
  referrer_id uuid, referrer_name text, referrer_handle text, referred_name text, referred_handle text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query
    select r.id, r.status, r.reward_cents, r.reject_reason, r.created_at, r.qualified_at, r.referrer_id,
           a.display_name, a.handle, b.display_name, b.handle
      from public.referrals r join public.profiles a on a.id = r.referrer_id join public.profiles b on b.id = r.referred_id
     where (p_status is null or p_status = '' or r.status = p_status)
     order by r.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 300);
end $$;

create or replace function public.admin_referral_reject(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.referrals set status = 'rejected', reward_cents = 0, reject_reason = left(coalesce(p_reason, ''), 200)
   where id = p_id and status in ('pending', 'qualified');
  if not found then raise exception 'cannot_reject'; end if;
  perform public.log_admin('referral_reject', 'referral', p_id, p_reason);
end $$;

create or replace function public.admin_referral_restore(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.referrals set status = 'pending', reject_reason = '' where id = p_id and status = 'rejected';
  perform public.log_admin('referral_restore', 'referral', p_id, '');
end $$;

create or replace function public.admin_referral_payouts()
returns table (referrer_id uuid, name text, handle text, payout_info text, blocked boolean, n int, owed_cents bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  perform public._referral_eval(null);
  return query
    select r.referrer_id, p.display_name, p.handle, coalesce(c.payout_info, ''), coalesce(c.blocked, false), count(*)::int, sum(r.reward_cents)::bigint
      from public.referrals r join public.profiles p on p.id = r.referrer_id left join public.referral_codes c on c.user_id = r.referrer_id
     where r.status = 'qualified' group by r.referrer_id, p.display_name, p.handle, c.payout_info, c.blocked
     order by sum(r.reward_cents) desc;
end $$;

create or replace function public.admin_referral_mark_paid(p_referrer uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.referrals set status = 'paid', paid_at = now(), paid_note = left(coalesce(p_note, ''), 200)
   where referrer_id = p_referrer and status = 'qualified';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'nothing_to_pay'; end if;
  perform public.log_admin('referral_paid', 'profile', p_referrer, n || ' referrals. ' || coalesce(p_note, ''));
end $$;

create or replace function public.admin_referral_block(p_user uuid, p_block boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  insert into public.referral_codes (user_id, code) values (p_user, 'x' || substr(md5(random()::text || p_user::text), 1, 7)) on conflict (user_id) do nothing;
  update public.referral_codes set blocked = p_block where user_id = p_user;
  if p_block then
    update public.referrals set status = 'rejected', reward_cents = 0, reject_reason = 'blocked' where referrer_id = p_user and status in ('pending', 'qualified');
  end if;
  perform public.log_admin(case when p_block then 'referral_block' else 'referral_unblock' end, 'profile', p_user, '');
end $$;

create or replace function public.admin_referral_settings(p_enabled boolean, p_reward int, p_actions int, p_days int, p_window int, p_cap int, p_min_payout int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.referral_settings set enabled = p_enabled, reward_cents = greatest(p_reward, 0), min_actions = greatest(p_actions, 0),
    min_days = greatest(p_days, 0), claim_window_days = greatest(p_window, 0), monthly_cap = greatest(p_cap, 0), min_payout_cents = greatest(p_min_payout, 0) where id = 1;
  perform public.log_admin('referral_settings', 'settings', null, 'reward ' || p_reward || ' cents');
end $$;

revoke all on function public.my_referral_code(), public.claim_referral(text), public.referral_stats(), public.referral_set_payout(text),
  public.admin_referral_summary(), public.admin_referral_list(text, int), public.admin_referral_reject(uuid, text), public.admin_referral_restore(uuid),
  public.admin_referral_payouts(), public.admin_referral_mark_paid(uuid, text), public.admin_referral_block(uuid, boolean),
  public.admin_referral_settings(boolean, int, int, int, int, int, int) from public, anon;
grant execute on function public.my_referral_code(), public.claim_referral(text), public.referral_stats(), public.referral_set_payout(text),
  public.admin_referral_summary(), public.admin_referral_list(text, int), public.admin_referral_reject(uuid, text), public.admin_referral_restore(uuid),
  public.admin_referral_payouts(), public.admin_referral_mark_paid(uuid, text), public.admin_referral_block(uuid, boolean),
  public.admin_referral_settings(boolean, int, int, int, int, int, int) to authenticated;
