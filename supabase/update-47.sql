-- Kezzo update 47: Market feed in random order, with items close to the member first, then online, then elsewhere.
-- Run once in the Supabase SQL editor. Safe to run again.

create or replace function public.market_feed(
  p_seed text, p_country text, p_city text,
  p_kind text default null, p_cat text default null, p_avail boolean default false,
  p_term text default null, p_cats text[] default null, p_sellers uuid[] default null,
  p_offset int default 0, p_limit int default 18
) returns setof public.market_listings
language sql stable security invoker set search_path = public as $$
  select l.*
  from public.market_listings l
  where not l.hidden and l.status <> 'paused'
    and (p_kind is null or l.kind = p_kind)
    and (p_cat is null or l.category = p_cat)
    and (not p_avail or l.status = 'active')
    and (p_term is null
         or l.title ilike '%' || p_term || '%' or l.body ilike '%' || p_term || '%'
         or l.city ilike '%' || p_term || '%' or l.country ilike '%' || p_term || '%'
         or (p_cats is not null and l.category = any (p_cats))
         or (p_sellers is not null and l.seller_id = any (p_sellers)))
  order by
    case
      when coalesce(p_city, '') <> '' and lower(l.city) = lower(p_city) and (coalesce(p_country, '') = '' or lower(l.country) = lower(p_country)) then 0
      when coalesce(p_country, '') <> '' and lower(l.country) = lower(p_country) then 1
      when l.online then 2
      else 3
    end,
    md5(l.id::text || coalesce(p_seed, ''))
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.market_feed(text, text, text, text, text, boolean, text, text[], uuid[], int, int) from public, anon;
grant execute on function public.market_feed(text, text, text, text, text, boolean, text, text[], uuid[], int, int) to authenticated;
