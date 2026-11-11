-- =====================================================================
-- Kezzo update 42: Market (members sell products and services). No payments yet: buyers and sellers
-- contact each other by message and arrange everything themselves.
-- Run in the Supabase SQL Editor AFTER update-41. Safe to run more than once.
-- =====================================================================
create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('product', 'service')),
  category text not null default 'other' check (category in ('fashion', 'electronics', 'home', 'food', 'beauty', 'art', 'music', 'education', 'events', 'repairs', 'transport', 'digital', 'other')),
  title text not null check (char_length(title) between 3 and 120),
  body text not null default '' check (char_length(body) <= 3000),
  price numeric(12, 2) check (price is null or (price >= 0 and price < 1000000000)),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  condition text check (condition is null or condition in ('new', 'used')),
  country text not null default '' check (char_length(country) <= 60),
  city text not null default '' check (char_length(city) <= 80),
  online boolean not null default false,
  contact text check (contact is null or char_length(contact) <= 120),
  photos text[] not null default '{}' check (cardinality(photos) <= 5),
  status text not null default 'active' check (status in ('active', 'sold', 'paused')),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (online or country <> '')
);
create index if not exists market_listings_created_idx on public.market_listings (created_at desc);
create index if not exists market_listings_kind_idx on public.market_listings (kind, category, created_at desc);
create index if not exists market_listings_place_idx on public.market_listings (lower(country), lower(city));
create index if not exists market_listings_seller_idx on public.market_listings (seller_id, created_at desc);
alter table public.market_listings enable row level security;

revoke all on public.market_listings from anon, authenticated;
grant select on public.market_listings to authenticated;
grant insert (seller_id, kind, category, title, body, price, currency, condition, country, city, online, contact, photos) on public.market_listings to authenticated;
grant update (kind, category, title, body, price, currency, condition, country, city, online, contact, photos, status, updated_at) on public.market_listings to authenticated;
grant delete on public.market_listings to authenticated;

drop policy if exists market_select on public.market_listings;
create policy market_select on public.market_listings for select to authenticated using (not hidden or seller_id = auth.uid());
drop policy if exists market_insert on public.market_listings;
create policy market_insert on public.market_listings for insert to authenticated with check (seller_id = auth.uid());
drop policy if exists market_update on public.market_listings;
create policy market_update on public.market_listings for update to authenticated using (seller_id = auth.uid()) with check (seller_id = auth.uid());
drop policy if exists market_delete on public.market_listings;
create policy market_delete on public.market_listings for delete to authenticated using (seller_id = auth.uid());

-- At most 10 new listings per person per day
create or replace function public.market_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.market_listings where seller_id = new.seller_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited';
  end if;
  return new;
end; $$;
drop trigger if exists market_limit_trg on public.market_listings;
create trigger market_limit_trg before insert on public.market_listings for each row execute function public.market_limit();

-- Restricted accounts cannot list (same rule as other content)
drop trigger if exists block_restricted on public.market_listings;
create trigger block_restricted before insert on public.market_listings for each row execute function public.trg_block_restricted('seller_id');

-- Admins hide (or show again) a listing, and can see the hidden ones
create or replace function public.admin_hide_listing(p_id uuid, p_hide boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.market_listings set hidden = coalesce(p_hide, true) where id = p_id;
  perform public.log_admin(case when coalesce(p_hide, true) then 'hide_listing' else 'show_listing' end, 'listing', p_id, '');
end; $$;
revoke all on function public.admin_hide_listing(uuid, boolean) from public, anon;
grant execute on function public.admin_hide_listing(uuid, boolean) to authenticated;

create or replace function public.admin_listings_hidden()
returns setof public.market_listings language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select * from public.market_listings where hidden order by created_at desc limit 100;
end; $$;
revoke all on function public.admin_listings_hidden() from public, anon;
grant execute on function public.admin_listings_hidden() to authenticated;

-- Reports can point at a listing
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'profile', 'battle', 'group', 'message', 'opportunity', 'listing'));
