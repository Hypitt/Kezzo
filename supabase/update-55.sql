-- Kezzo update 55: Invite & Earn. A review screen for admins (which rules each referral meets) and a manual-approval option.
-- Run once in the Supabase SQL editor, after update-54. Safe to run again. Contains no secrets.

alter table public.referral_settings add column if not exists auto_approve boolean not null default true;

-- All the facts about one referral, and whether it meets every rule that is switched on.
create or replace function public._referral_checks(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.referral_settings; r public.referrals; made timestamptz; days int; confirmed boolean; inst boolean; src text;
  posts int; comments int; likes int; acts int; mcount int; burst int; blocked boolean; ok_days boolean; ok_mail boolean; ok_inst boolean; ok_acts boolean; ok_cap boolean; flags jsonb := '[]'::jsonb;
begin
  select * into s from public.referral_settings where id = 1;
  select * into r from public.referrals where id = p_id;
  if not found then return null; end if;
  select created_at into made from public.profiles where id = r.referred_id;
  days := greatest(floor(extract(epoch from (now() - coalesce(made, now()))) / 86400)::int, 0);
  select coalesce(email_confirmed_at is not null, false) into confirmed from auth.users where id = r.referred_id;
  select true, a.source into inst, src from public.app_installs a where a.user_id = r.referred_id;
  posts := (select count(*) from public.posts where author_id = r.referred_id);
  comments := (select count(*) from public.post_comments where author_id = r.referred_id);
  likes := (select count(*) from public.post_likes where user_id = r.referred_id);
  acts := posts + comments + likes;
  mcount := (select count(*) from public.referrals where referrer_id = r.referrer_id and status in ('qualified', 'paid') and qualified_at >= date_trunc('month', now()));
  burst := (select count(*) from public.referrals where referrer_id = r.referrer_id and created_at > now() - interval '24 hours');
  blocked := coalesce((select c.blocked from public.referral_codes c where c.user_id = r.referrer_id), false);
  ok_days := days >= s.min_days;
  ok_mail := (not s.require_email) or coalesce(confirmed, false);
  ok_inst := (not s.require_install) or coalesce(inst, false);
  ok_acts := acts >= s.min_actions;
  ok_cap := mcount < s.monthly_cap;
  if burst >= 5 then flags := flags || '"burst"'::jsonb; end if;
  if posts + comments = 0 and likes > 0 then flags := flags || '"only_likes"'::jsonb; end if;
  if blocked then flags := flags || '"blocked"'::jsonb; end if;
  return jsonb_build_object(
    'days', days, 'days_need', s.min_days, 'ok_days', ok_days,
    'email', coalesce(confirmed, false), 'email_required', s.require_email, 'ok_email', ok_mail,
    'install', coalesce(inst, false), 'install_source', src, 'install_required', s.require_install, 'ok_install', ok_inst,
    'posts', posts, 'comments', comments, 'likes', likes, 'actions', acts, 'actions_need', s.min_actions, 'ok_actions', ok_acts,
    'month_count', mcount, 'cap', s.monthly_cap, 'ok_cap', ok_cap,
    'burst', burst, 'flags', flags,
    'ready', (ok_days and ok_mail and ok_inst and ok_acts and ok_cap and not blocked));
end $$;
revoke all on function public._referral_checks(uuid) from public, anon, authenticated;

-- Automatic approval (when switched on) uses the same checks the admin sees.
create or replace function public._referral_eval(p_referrer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.referral_settings; r record;
begin
  if not public._referral_active() then return; end if;
  select * into s from public.referral_settings where id = 1;
  if not s.auto_approve then return; end if;
  for r in select id from public.referrals where status = 'pending' and (p_referrer is null or referrer_id = p_referrer) order by created_at loop
    if (public._referral_checks(r.id) ->> 'ready')::boolean then
      update public.referrals set status = 'qualified', reward_cents = s.reward_cents, qualified_at = now() where id = r.id;
    end if;
  end loop;
end $$;
revoke all on function public._referral_eval(uuid) from public, anon, authenticated;

-- The review list: each referral with its checks.
create or replace function public.admin_referral_review(p_status text, p_limit int default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  perform public._referral_eval(null);
  select coalesce(jsonb_agg(x order by (x ->> 'created_at') desc), '[]'::jsonb) into out from (
    select jsonb_build_object(
      'id', r.id, 'status', r.status, 'reward_cents', r.reward_cents, 'reject_reason', r.reject_reason, 'created_at', r.created_at,
      'referrer_id', r.referrer_id, 'referrer_name', a.display_name, 'referrer_handle', a.handle,
      'referred_name', b.display_name, 'referred_handle', b.handle,
      'checks', case when r.status = 'pending' then public._referral_checks(r.id) else null end) as x
    from public.referrals r join public.profiles a on a.id = r.referrer_id join public.profiles b on b.id = r.referred_id
    where (p_status is null or p_status = '' or p_status = 'ready' and r.status = 'pending' or r.status = p_status)
    order by r.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 300)) t;
  if p_status = 'ready' then
    select coalesce(jsonb_agg(e), '[]'::jsonb) into out from jsonb_array_elements(out) e where (e -> 'checks' ->> 'ready')::boolean;
  end if;
  return out;
end $$;

-- Approve every pending referral that meets all the rules (only while the program is running).
create or replace function public.admin_referral_approve_ready()
returns int language plpgsql security definer set search_path = public as $$
declare s public.referral_settings; r record; n int := 0;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if not public._referral_active() then raise exception 'paused'; end if;
  select * into s from public.referral_settings where id = 1;
  for r in select id from public.referrals where status = 'pending' order by created_at loop
    if (public._referral_checks(r.id) ->> 'ready')::boolean then
      update public.referrals set status = 'qualified', reward_cents = s.reward_cents, qualified_at = now() where id = r.id;
      n := n + 1;
    end if;
  end loop;
  perform public.log_admin('referral_approve_ready', 'settings', null, n || ' approved');
  return n;
end $$;

create or replace function public.admin_referral_summary()
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.referral_settings; ready int := 0; r record;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  perform public._referral_eval(null);
  select * into s from public.referral_settings where id = 1;
  for r in select id from public.referrals where status = 'pending' loop
    if (public._referral_checks(r.id) ->> 'ready')::boolean then ready := ready + 1; end if;
  end loop;
  return jsonb_build_object(
    'settings', to_jsonb(s), 'active', public._referral_active(), 'ready', ready,
    'pending', (select count(*) from public.referrals where status = 'pending'),
    'qualified', (select count(*) from public.referrals where status = 'qualified'),
    'paid', (select count(*) from public.referrals where status = 'paid'),
    'rejected', (select count(*) from public.referrals where status = 'rejected'),
    'installs', (select count(*) from public.app_installs),
    'owed_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where status = 'qualified'),
    'paid_cents', (select coalesce(sum(reward_cents), 0) from public.referrals where status = 'paid'));
end $$;

drop function if exists public.admin_referral_settings(boolean, int, int, int, int, int, int, boolean, boolean, text);
create or replace function public.admin_referral_settings(p_enabled boolean, p_reward int, p_actions int, p_days int, p_window int, p_cap int, p_min_payout int,
  p_install boolean, p_email boolean, p_rules text, p_auto boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.referral_settings set enabled = p_enabled, reward_cents = greatest(p_reward, 0), min_actions = greatest(p_actions, 0),
    min_days = greatest(p_days, 0), claim_window_days = greatest(p_window, 0), monthly_cap = greatest(p_cap, 0), min_payout_cents = greatest(p_min_payout, 0),
    require_install = coalesce(p_install, true), require_email = coalesce(p_email, true), rules_text = left(coalesce(p_rules, ''), 1200),
    auto_approve = coalesce(p_auto, true) where id = 1;
  perform public.log_admin('referral_settings', 'settings', null, 'reward ' || p_reward || ' cents');
end $$;

revoke all on function public.admin_referral_review(text, int), public.admin_referral_approve_ready(), public.admin_referral_summary(),
  public.admin_referral_settings(boolean, int, int, int, int, int, int, boolean, boolean, text, boolean) from public, anon;
grant execute on function public.admin_referral_review(text, int), public.admin_referral_approve_ready(), public.admin_referral_summary(),
  public.admin_referral_settings(boolean, int, int, int, int, int, int, boolean, boolean, text, boolean) to authenticated;
