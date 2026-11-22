-- Kezzo update 56: Premium plan, step 1 (plans, limits, country prices, manual subscription with admin approval).
-- Run once in the Supabase SQL editor, after update-55. Safe to run again. Contains no secrets.
-- Kezzo never holds customer money. These tables only record Kezzo's own Premium fee, paid outside the app and checked by an admin.

create table if not exists public.plans (
  id text primary key check (id in ('free', 'premium')),
  name text not null,
  active boolean not null default true
);
insert into public.plans (id, name) values ('free', 'Free'), ('premium', 'Premium') on conflict (id) do nothing;

create table if not exists public.plan_limits (
  plan text not null references public.plans (id) on delete cascade,
  key text not null check (key in ('listings', 'payment_methods', 'live_rooms_month', 'live_minutes', 'vsla_groups', 'vsla_members', 'featured_month', 'export')),
  value int not null check (value >= 0),
  primary key (plan, key)
);
insert into public.plan_limits (plan, key, value) values
  ('free', 'listings', 20), ('premium', 'listings', 500),
  ('free', 'payment_methods', 0), ('premium', 'payment_methods', 5),
  ('free', 'live_rooms_month', 3), ('premium', 'live_rooms_month', 30),
  ('free', 'live_minutes', 30), ('premium', 'live_minutes', 180),
  ('free', 'vsla_groups', 1), ('premium', 'vsla_groups', 20),
  ('free', 'vsla_members', 30), ('premium', 'vsla_members', 30),
  ('free', 'featured_month', 0), ('premium', 'featured_month', 2),
  ('free', 'export', 0), ('premium', 'export', 1)
on conflict (plan, key) do nothing;

create table if not exists public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  country text not null check (char_length(country) between 2 and 60),
  currency text not null check (char_length(currency) between 1 and 8),
  duration text not null check (duration in ('week', 'month', 'quarter')),
  amount numeric(14, 2) not null check (amount > 0),
  active boolean not null default true,
  unique (country, duration)
);

create table if not exists public.collection_accounts (
  id uuid primary key default gen_random_uuid(),
  country text not null check (char_length(country) between 2 and 60),
  method text not null check (char_length(method) between 1 and 40),
  account_name text not null default '' check (char_length(account_name) <= 80),
  account_number text not null default '' check (char_length(account_number) <= 80),
  instructions text not null default '' check (char_length(instructions) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'premium' references public.plans (id),
  suspended boolean not null default false,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  country text not null,
  duration text not null check (duration in ('week', 'month', 'quarter')),
  currency text not null,
  amount numeric(14, 2) not null,
  reference text not null check (char_length(reference) between 3 and 80),
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text not null default '' check (char_length(reason) <= 200),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists subscription_payments_ref_uq on public.subscription_payments (lower(reference));
create index if not exists subscription_payments_user_idx on public.subscription_payments (user_id, created_at desc);

alter table public.plans enable row level security;
alter table public.plan_limits enable row level security;
alter table public.plan_prices enable row level security;
alter table public.collection_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
revoke all on public.plans, public.plan_limits, public.plan_prices, public.collection_accounts, public.subscriptions, public.subscription_payments from anon;

-- Everybody signed in may read plans, limits, active prices and Kezzo's own collection accounts (they are meant to be shown).
drop policy if exists plans_read on public.plans; create policy plans_read on public.plans for select to authenticated using (true);
drop policy if exists limits_read on public.plan_limits; create policy limits_read on public.plan_limits for select to authenticated using (true);
drop policy if exists prices_read on public.plan_prices; create policy prices_read on public.plan_prices for select to authenticated using (active or public.is_admin());
drop policy if exists accounts_read on public.collection_accounts; create policy accounts_read on public.collection_accounts for select to authenticated using (active or public.is_admin());
-- Only admins change limits, prices and accounts.
drop policy if exists limits_admin on public.plan_limits; create policy limits_admin on public.plan_limits for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists prices_admin on public.plan_prices; create policy prices_admin on public.plan_prices for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists accounts_admin on public.collection_accounts; create policy accounts_admin on public.collection_accounts for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.plan_limits, public.plan_prices, public.collection_accounts from authenticated;
grant insert, update, delete on public.plan_limits, public.plan_prices, public.collection_accounts to authenticated;
-- A person reads only their own subscription and payment submissions. All changes go through the functions below.
drop policy if exists subs_own on public.subscriptions; create policy subs_own on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists subpay_own on public.subscription_payments; create policy subpay_own on public.subscription_payments for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.subscriptions, public.subscription_payments from authenticated;

-- Premium is live when the expiry date has not passed, or within the 3-day grace period. Nothing needs a daily job: the answer is worked out from the dates.
create or replace function public.plan_status(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when s.user_id is null or s.suspended then 'free'
    when now() < s.expires_at then 'active'
    when now() < s.expires_at + interval '3 days' then 'grace'
    else 'free' end
  from (select 1) x left join public.subscriptions s on s.user_id = p_user;
$$;
revoke all on function public.plan_status(uuid) from public, anon, authenticated;

create or replace function public.user_plan(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case when public.plan_status(p_user) in ('active', 'grace') then 'premium' else 'free' end;
$$;
revoke all on function public.user_plan(uuid) from public, anon, authenticated;

create or replace function public.plan_limit(p_user uuid, p_key text)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.plan_limits where plan = public.user_plan(p_user) and key = p_key), 0);
$$;
revoke all on function public.plan_limit(uuid, text) from public, anon, authenticated;

create or replace function public.my_plan()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.subscriptions; lim jsonb; st text;
begin
  select * into s from public.subscriptions where user_id = auth.uid();
  st := public.plan_status(auth.uid());
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into lim from public.plan_limits where plan = public.user_plan(auth.uid());
  return jsonb_build_object('plan', public.user_plan(auth.uid()), 'status', case when s.user_id is not null and s.suspended then 'suspended' when st = 'free' and s.user_id is not null then 'expired' else st end,
    'expires_at', s.expires_at, 'grace_until', s.expires_at + interval '3 days', 'limits', lim);
end; $$;
revoke all on function public.my_plan() from public, anon;
grant execute on function public.my_plan() to authenticated;

-- Limits enforced in the database when something is created.
create or replace function public._limit_listings() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.market_listings where seller_id = new.seller_id) >= public.plan_limit(new.seller_id, 'listings') then
    raise exception 'plan_limit_listings';
  end if;
  return new;
end; $$;
drop trigger if exists limit_listings on public.market_listings;
create trigger limit_listings before insert on public.market_listings for each row execute function public._limit_listings();

create or replace function public._limit_vsla_groups() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.vsla_groups where owner_id = new.owner_id) >= public.plan_limit(new.owner_id, 'vsla_groups') then
    raise exception 'plan_limit_vsla_groups';
  end if;
  return new;
end; $$;
drop trigger if exists limit_vsla_groups on public.vsla_groups;
create trigger limit_vsla_groups before insert on public.vsla_groups for each row execute function public._limit_vsla_groups();

create or replace function public._limit_vsla_members() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select owner_id into owner from public.vsla_groups where id = new.group_id;
  if (select count(*) from public.vsla_members where group_id = new.group_id and active) >= public.plan_limit(owner, 'vsla_members') then
    raise exception 'plan_limit_vsla_members';
  end if;
  return new;
end; $$;
drop trigger if exists limit_vsla_members on public.vsla_members;
create trigger limit_vsla_members before insert on public.vsla_members for each row execute function public._limit_vsla_members();

-- A member sends the payment reference. Results: ok, no_price, duplicate, pending (one waiting submission at a time).
create or replace function public.submit_premium(p_country text, p_duration text, p_reference text, p_note text)
returns text language plpgsql security definer set search_path = public as $$
declare pr public.plan_prices;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into pr from public.plan_prices where lower(country) = lower(trim(p_country)) and duration = p_duration and active;
  if not found then return 'no_price'; end if;
  if exists (select 1 from public.subscription_payments where user_id = auth.uid() and status = 'pending') then return 'pending'; end if;
  if exists (select 1 from public.subscription_payments where lower(reference) = lower(trim(p_reference))) then return 'duplicate'; end if;
  insert into public.subscription_payments (user_id, country, duration, currency, amount, reference, note)
  values (auth.uid(), pr.country, pr.duration, pr.currency, pr.amount, trim(p_reference), left(coalesce(p_note, ''), 300));
  return 'ok';
end; $$;
revoke all on function public.submit_premium(text, text, text, text) from public, anon;
grant execute on function public.submit_premium(text, text, text, text) to authenticated;

create or replace function public.cancel_premium_submission(p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.subscription_payments where id = p_id and user_id = auth.uid() and status = 'pending';
$$;
revoke all on function public.cancel_premium_submission(uuid) from public, anon;
grant execute on function public.cancel_premium_submission(uuid) to authenticated;

create or replace function public.admin_premium_review(p_status text default 'pending', p_limit int default 100)
returns table (id uuid, user_id uuid, name text, handle text, country text, duration text, currency text, amount numeric, reference text, note text, status text, reason text, created_at timestamptz, expires_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query
    select x.id, x.user_id, p.display_name, p.handle, x.country, x.duration, x.currency, x.amount, x.reference, x.note, x.status, x.reason, x.created_at, s.expires_at
      from public.subscription_payments x join public.profiles p on p.id = x.user_id left join public.subscriptions s on s.user_id = x.user_id
     where p_status = '' or x.status = p_status
     order by x.created_at desc limit least(greatest(p_limit, 1), 300);
end; $$;
revoke all on function public.admin_premium_review(text, int) from public, anon;
grant execute on function public.admin_premium_review(text, int) to authenticated;

-- Approve: Premium turns on. If Premium is still running, the new period starts at the old expiry date.
create or replace function public.admin_premium_decide(p_id uuid, p_approve boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare x public.subscription_payments; start_at timestamptz; cur timestamptz;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into x from public.subscription_payments where id = p_id and status = 'pending' for update;
  if not found then raise exception 'not pending'; end if;
  if p_approve then
    select expires_at into cur from public.subscriptions where user_id = x.user_id;
    start_at := greatest(now(), coalesce(cur, now()));
    insert into public.subscriptions (user_id, plan, suspended, starts_at, expires_at)
    values (x.user_id, 'premium', false, now(), start_at + case x.duration when 'week' then interval '7 days' when 'month' then interval '1 month' else interval '3 months' end)
    on conflict (user_id) do update set plan = 'premium', suspended = false, expires_at = excluded.expires_at;
    update public.subscription_payments set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), reason = '' where id = p_id;
    perform public.log_admin('premium_approve', 'subscription_payment', p_id, x.reference);
  else
    update public.subscription_payments set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), reason = left(coalesce(p_reason, ''), 200) where id = p_id;
    perform public.log_admin('premium_reject', 'subscription_payment', p_id, left(coalesce(p_reason, ''), 100));
  end if;
end; $$;
revoke all on function public.admin_premium_decide(uuid, boolean, text) from public, anon;
grant execute on function public.admin_premium_decide(uuid, boolean, text) to authenticated;

create or replace function public.admin_premium_suspend(p_user uuid, p_suspend boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.subscriptions set suspended = p_suspend where user_id = p_user;
  perform public.log_admin(case when p_suspend then 'premium_suspend' else 'premium_unsuspend' end, 'profile', p_user, '');
end; $$;
revoke all on function public.admin_premium_suspend(uuid, boolean) from public, anon;
grant execute on function public.admin_premium_suspend(uuid, boolean) to authenticated;

create or replace function public.admin_premium_members()
returns table (user_id uuid, name text, handle text, status text, expires_at timestamptz, suspended boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select s.user_id, p.display_name, p.handle, public.plan_status(s.user_id), s.expires_at, s.suspended
    from public.subscriptions s join public.profiles p on p.id = s.user_id order by s.expires_at desc limit 200;
end; $$;
revoke all on function public.admin_premium_members() from public, anon;
grant execute on function public.admin_premium_members() to authenticated;
