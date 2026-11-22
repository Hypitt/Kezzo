-- Kezzo update 54: Invite & Earn. Personal invite codes (the member's @handle) and a pause switch for admins.
-- Run once in the Supabase SQL editor, after update-53. Safe to run again. Contains no secrets.

-- 1) Personal codes: the code is now the member's handle, so the link reads kezzo.live/r/marie.
alter table public.referral_codes drop constraint if exists referral_codes_code_check;
alter table public.referral_codes add constraint referral_codes_code_check check (code ~ '^[a-z0-9_]{3,20}$');

update public.referral_codes c set code = p.handle
  from public.profiles p
 where p.id = c.user_id and c.code <> p.handle
   and not exists (select 1 from public.referral_codes o where o.code = p.handle and o.user_id <> c.user_id);

create or replace function public.my_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare got text; base text; cand text; tries int := 0;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select code into got from public.referral_codes where user_id = auth.uid();
  if got is not null then return got; end if;
  select handle into base from public.profiles where id = auth.uid();
  if base is null then raise exception 'no_profile'; end if;
  cand := base;
  loop
    insert into public.referral_codes (user_id, code) values (auth.uid(), cand) on conflict do nothing;
    select code into got from public.referral_codes where user_id = auth.uid();
    if got is not null then return got; end if;
    tries := tries + 1;
    cand := left(base, 17) || (10 + floor(random() * 90))::int;
    if tries > 30 then raise exception 'no_code'; end if;
  end loop;
end $$;

-- 2) Pause: from / until (until empty = until an admin resumes), and a short note members can read.
alter table public.referral_settings add column if not exists pause_from timestamptz;
alter table public.referral_settings add column if not exists pause_until timestamptz;
alter table public.referral_settings add column if not exists pause_note text not null default '' check (char_length(pause_note) <= 200);

-- True when the program is on and not paused right now.
create or replace function public._referral_active()
returns boolean language sql stable security definer set search_path = public as $$
  select s.enabled and not (s.pause_from is not null and s.pause_from <= now() and (s.pause_until is null or s.pause_until > now()))
    from public.referral_settings s where s.id = 1;
$$;
revoke all on function public._referral_active() from public, anon, authenticated;

-- While paused, friends can still join with a code, but nothing new qualifies (no rewards are earned) until the program resumes.
create or replace function public._referral_eval(p_referrer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.referral_settings; r record; acts int; this_month int; confirmed boolean; made timestamptz;
begin
  if not public._referral_active() then return; end if;
  select * into s from public.referral_settings where id = 1;
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
    'settings', jsonb_build_object('enabled', s.enabled, 'paused', (s.enabled and not public._referral_active()), 'pause_until', s.pause_until, 'pause_note', s.pause_note,
       'reward_cents', s.reward_cents, 'min_actions', s.min_actions, 'min_days', s.min_days, 'monthly_cap', s.monthly_cap,
       'min_payout_cents', s.min_payout_cents, 'require_install', s.require_install, 'require_email', s.require_email, 'rules_text', s.rules_text),
    'pending', (select count(*) from public.referrals where referrer_id = auth.uid() and status = 'pending'),
    'qualified', (select count(*) from public.referrals where referrer_id = auth.uid() and status in ('qualified', 'paid')),
    'balance_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where referrer_id = auth.uid() and status = 'qualified'),
    'paid_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where referrer_id = auth.uid() and status = 'paid'),
    'referrals', rows);
end $$;

create or replace function public.admin_referral_summary()
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.referral_settings;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  perform public._referral_eval(null);
  select * into s from public.referral_settings where id = 1;
  return jsonb_build_object(
    'settings', to_jsonb(s),
    'active', public._referral_active(),
    'pending', (select count(*) from public.referrals where status = 'pending'),
    'qualified', (select count(*) from public.referrals where status = 'qualified'),
    'paid', (select count(*) from public.referrals where status = 'paid'),
    'rejected', (select count(*) from public.referrals where status = 'rejected'),
    'installs', (select count(*) from public.app_installs),
    'owed_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where status = 'qualified'),
    'paid_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where status = 'paid'));
end $$;

-- Admin: pause or resume. Both dates empty = resume. From empty = pause starting now. Until empty = pause until resumed.
create or replace function public.admin_referral_pause(p_from timestamptz, p_until timestamptz, p_note text, p_pause boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_pause then
    if p_until is not null and p_until <= coalesce(p_from, now()) then raise exception 'bad_dates'; end if;
    update public.referral_settings set pause_from = coalesce(p_from, now()), pause_until = p_until, pause_note = left(coalesce(p_note, ''), 200) where id = 1;
  else
    update public.referral_settings set pause_from = null, pause_until = null, pause_note = '' where id = 1;
  end if;
  perform public.log_admin(case when p_pause then 'referral_pause' else 'referral_resume' end, 'settings', null, coalesce(p_note, ''));
end $$;

revoke all on function public.my_referral_code(), public.referral_stats(), public.admin_referral_summary(), public.admin_referral_pause(timestamptz, timestamptz, text, boolean) from public, anon;
grant execute on function public.my_referral_code(), public.referral_stats(), public.admin_referral_summary(), public.admin_referral_pause(timestamptz, timestamptz, text, boolean) to authenticated;
