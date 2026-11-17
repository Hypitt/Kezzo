-- Kezzo update 44: quantity available for Market listings, and favorites.
-- Run once in the Supabase SQL editor. Safe to run again.

alter table public.market_listings add column if not exists quantity integer check (quantity is null or (quantity >= 0 and quantity <= 100000));

-- Quantity 0 marks the listing as sold; raising it again from 0 puts it back on sale.
create or replace function public.market_quantity() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.quantity = 0 then new.status := 'sold'; end if;
  else
    if new.quantity = 0 and old.quantity is distinct from 0 then
      new.status := 'sold';
    elsif new.quantity > 0 and old.quantity = 0 and old.status = 'sold' and new.status = 'sold' then
      new.status := 'active';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists market_quantity_trg on public.market_listings;
create trigger market_quantity_trg before insert or update on public.market_listings for each row execute function public.market_quantity();

create table if not exists public.market_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.market_favorites enable row level security;

drop policy if exists market_fav_select on public.market_favorites;
create policy market_fav_select on public.market_favorites for select to authenticated using (user_id = auth.uid());
drop policy if exists market_fav_insert on public.market_favorites;
create policy market_fav_insert on public.market_favorites for insert to authenticated with check (user_id = auth.uid());
drop policy if exists market_fav_delete on public.market_favorites;
create policy market_fav_delete on public.market_favorites for delete to authenticated using (user_id = auth.uid());

-- Faster search by place and seller
create index if not exists market_listings_city_idx on public.market_listings (lower(city));
create index if not exists market_listings_seller_idx on public.market_listings (seller_id);

-- Permissions: the listings table only allows named columns, so the new column must be added to those lists
grant insert (quantity) on public.market_listings to authenticated;
grant update (quantity) on public.market_listings to authenticated;

-- Make sure shops and favorites are usable by signed-in members (rules above still limit each person to their own rows)
grant select, insert, update, delete on public.market_shops to authenticated;
grant select, insert, delete on public.market_favorites to authenticated;
