-- Kezzo update 57: Premium step 2 (seller payment methods, Pay button, orders, verification checks).
-- Run once in the Supabase SQL editor, after update-56. Safe to run again. Contains no secrets.
-- Kezzo never holds, checks or guarantees customer payments: it only records what the buyer and the seller say.

create table if not exists public.trust_settings (
  id int primary key default 1 check (id = 1),
  require_phone boolean not null default false,
  require_name_match boolean not null default false
);
insert into public.trust_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.user_verifications (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone_verified boolean not null default false,
  name_ok boolean not null default false,
  id_status text not null default 'none' check (id_status in ('none', 'pending', 'verified')),
  methods_suspended boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_providers (
  id uuid primary key default gen_random_uuid(),
  country text not null check (char_length(country) between 2 and 60),
  name text not null check (char_length(name) between 1 and 40),
  type text not null default 'mobile_money' check (type in ('mobile_money', 'bank', 'other')),
  enabled boolean not null default true,
  sort int not null default 0,
  unique (country, name)
);

create table if not exists public.user_payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  country text not null check (char_length(country) between 2 and 60),
  method text not null check (char_length(method) between 1 and 40),
  type text not null default 'mobile_money' check (type in ('mobile_money', 'bank', 'other')),
  account_name text not null default '' check (char_length(account_name) <= 80),
  account_number text not null default '' check (char_length(account_number) <= 80),
  instructions text not null default '' check (char_length(instructions) <= 500),
  enabled boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists upm_user_idx on public.user_payment_methods (user_id);

create sequence if not exists public.order_ref_seq start 4821;
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid references public.market_listings (id) on delete set null,
  title text not null check (char_length(title) <= 140),
  quantity int not null default 1 check (quantity between 1 and 100000),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default '' check (char_length(currency) <= 12),
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'marked_paid', 'confirmed', 'disputed', 'preparing', 'completed', 'cancelled')),
  buyer_note text not null default '' check (char_length(buyer_note) <= 300),
  cancel_reason text not null default '' check (char_length(cancel_reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create index if not exists orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx on public.orders (seller_id, created_at desc);

alter table public.trust_settings enable row level security;
alter table public.user_verifications enable row level security;
alter table public.payment_providers enable row level security;
alter table public.user_payment_methods enable row level security;
alter table public.orders enable row level security;
revoke all on public.trust_settings, public.user_verifications, public.payment_providers, public.user_payment_methods, public.orders from anon;

drop policy if exists trust_read on public.trust_settings; create policy trust_read on public.trust_settings for select to authenticated using (true);
drop policy if exists trust_admin on public.trust_settings; create policy trust_admin on public.trust_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke insert, delete on public.trust_settings from authenticated;
drop policy if exists verif_read on public.user_verifications; create policy verif_read on public.user_verifications for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.user_verifications from authenticated;
drop policy if exists prov_read on public.payment_providers; create policy prov_read on public.payment_providers for select to authenticated using (enabled or public.is_admin());
drop policy if exists prov_admin on public.payment_providers; create policy prov_admin on public.payment_providers for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- Payment details are private: only the owner reads them directly. Buyers go through the functions below.
drop policy if exists upm_own on public.user_payment_methods; create policy upm_own on public.user_payment_methods for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists orders_read on public.orders; create policy orders_read on public.orders for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.orders from authenticated;

-- Only Premium (active or in grace) members can add payment methods, up to the plan limit.
create or replace function public._limit_methods() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.user_plan(new.user_id) <> 'premium' then raise exception 'premium_required'; end if;
  if (select count(*) from public.user_payment_methods where user_id = new.user_id) >= public.plan_limit(new.user_id, 'payment_methods') then
    raise exception 'plan_limit_payment_methods';
  end if;
  return new;
end; $$;
drop trigger if exists limit_methods on public.user_payment_methods;
create trigger limit_methods before insert on public.user_payment_methods for each row execute function public._limit_methods();

create or replace function public.set_default_method(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.user_payment_methods set is_default = (id = p_id) where user_id = auth.uid();
end; $$;
revoke all on function public.set_default_method(uuid) from public, anon;
grant execute on function public.set_default_method(uuid) to authenticated;

-- Is this seller allowed to show payment methods right now?
create or replace function public._seller_ready(p_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare t public.trust_settings; v public.user_verifications;
begin
  if public.user_plan(p_user) <> 'premium' then return false; end if;
  select * into t from public.trust_settings where id = 1;
  select * into v from public.user_verifications where user_id = p_user;
  if coalesce(v.methods_suspended, false) then return false; end if;
  if t.require_phone and not coalesce(v.phone_verified, false) then return false; end if;
  if t.require_name_match and not coalesce(v.name_ok, false) then return false; end if;
  return exists (select 1 from public.user_payment_methods where user_id = p_user and enabled);
end; $$;
revoke all on function public._seller_ready(uuid) from public, anon, authenticated;

-- For a page of listings: which sellers are Premium, and which can take payments.
create or replace function public.seller_flags(p_ids uuid[])
returns table (user_id uuid, premium boolean, payable boolean)
language sql stable security definer set search_path = public as $$
  select x, public.user_plan(x) = 'premium', public._seller_ready(x) from unnest(p_ids) x;
$$;
revoke all on function public.seller_flags(uuid[]) from public, anon;
grant execute on function public.seller_flags(uuid[]) to authenticated;

create or replace function public.create_order(p_seller uuid, p_listing uuid, p_qty int, p_amount numeric, p_currency text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.market_listings; amt numeric; cur text; ttl text; qty int := greatest(coalesce(p_qty, 1), 1); oid uuid; ref text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if auth.uid() = p_seller then raise exception 'own_item'; end if;
  if not public._seller_ready(p_seller) then raise exception 'seller_not_ready'; end if;
  if (select count(*) from public.orders where buyer_id = auth.uid() and created_at > now() - interval '24 hours') >= 20 then raise exception 'rate_limited'; end if;
  if p_listing is not null then
    select * into l from public.market_listings where id = p_listing and seller_id = p_seller and status = 'active' and not hidden;
    if not found then raise exception 'not_found'; end if;
    if l.price is null or l.price <= 0 then raise exception 'no_price'; end if;
    if l.quantity is not null and l.quantity < qty then raise exception 'out_of_stock'; end if;
    amt := l.price * qty; cur := l.currency; ttl := l.title;
  else
    if p_amount is null or p_amount <= 0 or p_amount > 1000000000 then raise exception 'bad_amount'; end if;
    amt := p_amount; cur := left(coalesce(p_currency, ''), 12); ttl := 'Support'; qty := 1;
  end if;
  ref := 'KZ-' || nextval('public.order_ref_seq');
  insert into public.orders (reference, buyer_id, seller_id, listing_id, title, quantity, amount, currency)
  values (ref, auth.uid(), p_seller, p_listing, left(ttl, 140), qty, amt, cur) returning id into oid;
  return jsonb_build_object('id', oid, 'reference', ref, 'amount', amt, 'currency', cur, 'title', ttl);
end; $$;
revoke all on function public.create_order(uuid, uuid, int, numeric, text) from public, anon;
grant execute on function public.create_order(uuid, uuid, int, numeric, text) to authenticated;

-- The seller's methods for one order. Only the buyer, the seller or an admin can read them, and they stay readable after Premium ends.
create or replace function public.order_payment_methods(p_order uuid)
returns table (id uuid, method text, type text, account_name text, account_number text, instructions text, is_default boolean)
language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where orders.id = p_order;
  if not found or not (auth.uid() in (o.buyer_id, o.seller_id) or public.is_admin()) then return; end if;
  return query select m.id, m.method, m.type, m.account_name, m.account_number, m.instructions, m.is_default
    from public.user_payment_methods m where m.user_id = o.seller_id and m.enabled order by m.is_default desc, m.created_at;
end; $$;
revoke all on function public.order_payment_methods(uuid) from public, anon;
grant execute on function public.order_payment_methods(uuid) to authenticated;

create or replace function public.order_mark_paid(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'marked_paid', buyer_note = left(coalesce(p_note, ''), 300), updated_at = now()
   where id = p_id and buyer_id = auth.uid() and status = 'awaiting_payment';
  if not found then raise exception 'bad_status'; end if;
end; $$;
create or replace function public.order_seller_step(p_id uuid, p_to text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders; ok boolean;
begin
  select * into o from public.orders where id = p_id and seller_id = auth.uid() for update;
  if not found then raise exception 'not_found'; end if;
  ok := (p_to = 'confirmed' and o.status in ('awaiting_payment', 'marked_paid', 'disputed'))
     or (p_to = 'disputed' and o.status = 'marked_paid')
     or (p_to = 'preparing' and o.status = 'confirmed')
     or (p_to = 'completed' and o.status = 'preparing');
  if not ok then raise exception 'bad_status'; end if;
  update public.orders set status = p_to, updated_at = now() where id = p_id;
end; $$;
create or replace function public.order_cancel(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_id and auth.uid() in (buyer_id, seller_id) for update;
  if not found then raise exception 'not_found'; end if;
  if o.status in ('completed', 'cancelled') then raise exception 'bad_status'; end if;
  if auth.uid() = o.buyer_id and o.status <> 'awaiting_payment' then raise exception 'bad_status'; end if;
  if auth.uid() = o.seller_id and length(trim(coalesce(p_reason, ''))) < 2 then raise exception 'reason_required'; end if;
  update public.orders set status = 'cancelled', cancel_reason = left(coalesce(p_reason, ''), 200), updated_at = now() where id = p_id;
end; $$;
revoke all on function public.order_mark_paid(uuid, text), public.order_seller_step(uuid, text), public.order_cancel(uuid, text) from public, anon;
grant execute on function public.order_mark_paid(uuid, text), public.order_seller_step(uuid, text), public.order_cancel(uuid, text) to authenticated;

create or replace function public.orders_mine()
returns table (id uuid, reference text, role text, other_name text, other_handle text, seller_id uuid, title text, quantity int, amount numeric, currency text, status text, buyer_note text, cancel_reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.reference, case when o.buyer_id = auth.uid() then 'buyer' else 'seller' end,
         p.display_name, p.handle, o.seller_id, o.title, o.quantity, o.amount, o.currency, o.status, o.buyer_note, o.cancel_reason, o.created_at
    from public.orders o join public.profiles p on p.id = case when o.buyer_id = auth.uid() then o.seller_id else o.buyer_id end
   where auth.uid() in (o.buyer_id, o.seller_id) order by o.created_at desc limit 200;
$$;
revoke all on function public.orders_mine() from public, anon;
grant execute on function public.orders_mine() to authenticated;

-- Admin: the two checks, and per-person verification / suspension of payment methods.
create or replace function public.admin_trust_settings(p_phone boolean, p_name boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.trust_settings set require_phone = p_phone, require_name_match = p_name where id = 1;
  perform public.log_admin('trust_settings', 'settings', null, 'phone ' || p_phone || ', name ' || p_name);
end; $$;
create or replace function public.admin_verify_user(p_handle text, p_phone boolean, p_name boolean, p_suspended boolean)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select id into uid from public.profiles where handle = lower(trim(both '@' from trim(p_handle)));
  if uid is null then return 'not_found'; end if;
  insert into public.user_verifications (user_id, phone_verified, name_ok, methods_suspended) values (uid, p_phone, p_name, p_suspended)
  on conflict (user_id) do update set phone_verified = p_phone, name_ok = p_name, methods_suspended = p_suspended, updated_at = now();
  perform public.log_admin('verify_user', 'profile', uid, 'phone ' || p_phone || ', name ' || p_name || ', suspended ' || p_suspended);
  return 'ok';
end; $$;
create or replace function public.admin_verifications()
returns table (user_id uuid, name text, handle text, phone_verified boolean, name_ok boolean, methods_suspended boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select v.user_id, p.display_name, p.handle, v.phone_verified, v.name_ok, v.methods_suspended
    from public.user_verifications v join public.profiles p on p.id = v.user_id order by v.updated_at desc limit 200;
end; $$;
revoke all on function public.admin_trust_settings(boolean, boolean), public.admin_verify_user(text, boolean, boolean, boolean), public.admin_verifications() from public, anon;
grant execute on function public.admin_trust_settings(boolean, boolean), public.admin_verify_user(text, boolean, boolean, boolean), public.admin_verifications() to authenticated;

-- Starting list of payment methods (admins can add, disable or remove any of them).
insert into public.payment_providers (country, name, type, sort) values
  ('Burundi', 'Lumicash', 'mobile_money', 1), ('Burundi', 'EcoCash', 'mobile_money', 2),
  ('Kenya', 'M-Pesa', 'mobile_money', 1), ('Kenya', 'Airtel Money', 'mobile_money', 2),
  ('Rwanda', 'MTN MoMo', 'mobile_money', 1), ('Rwanda', 'Airtel Money', 'mobile_money', 2),
  ('Ghana', 'MTN MoMo', 'mobile_money', 1), ('Ghana', 'Telecel Cash', 'mobile_money', 2),
  ('Senegal', 'Wave', 'mobile_money', 1), ('Senegal', 'Orange Money', 'mobile_money', 2),
  ('Côte d''Ivoire', 'Orange Money', 'mobile_money', 1), ('Côte d''Ivoire', 'MTN MoMo', 'mobile_money', 2), ('Côte d''Ivoire', 'Wave', 'mobile_money', 3)
on conflict (country, name) do nothing;
