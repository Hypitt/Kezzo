-- Kezzo update 45: a message can be about a Market listing, so the seller sees which product the buyer means.
-- Run once in the Supabase SQL editor. Safe to run again.

alter table public.direct_messages add column if not exists listing_id uuid references public.market_listings(id) on delete set null;
create index if not exists dm_listing_idx on public.direct_messages (listing_id) where listing_id is not null;
