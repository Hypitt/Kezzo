-- Kezzo update 43: shop profile and cover for sellers in the Market.
-- Run once in the Supabase SQL editor. Safe to run again.

create table if not exists public.market_shops (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  about text not null default '' check (char_length(about) <= 300),
  logo_path text check (logo_path is null or logo_path like owner_id::text || '/%'),
  cover_path text check (cover_path is null or cover_path like owner_id::text || '/%'),
  updated_at timestamptz not null default now()
);

alter table public.market_shops enable row level security;

drop policy if exists market_shops_select on public.market_shops;
create policy market_shops_select on public.market_shops for select to authenticated using (true);

drop policy if exists market_shops_insert on public.market_shops;
create policy market_shops_insert on public.market_shops for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists market_shops_update on public.market_shops;
create policy market_shops_update on public.market_shops for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists market_shops_delete on public.market_shops;
create policy market_shops_delete on public.market_shops for delete to authenticated using (owner_id = auth.uid());

drop trigger if exists block_restricted on public.market_shops;
create trigger block_restricted before insert on public.market_shops for each row execute function public.trg_block_restricted('owner_id');
