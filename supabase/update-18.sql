-- =====================================================================
-- Kezzo update 18: random order for Home, Search and Media
-- shuffled_post_ids(): the ids of posts in a random order that stays the same while the same seed is used,
-- so "Load more" never repeats or skips a post. Run in the Supabase SQL Editor. Safe to run more than once.
-- =====================================================================
create or replace function public.shuffled_post_ids(
  p_seed text, p_from integer, p_limit integer, p_q text default null, p_author_ids uuid[] default null,
  p_exclude uuid[] default null, p_kinds text[] default null, p_paid boolean default null
) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(s.id order by s.n), '{}')
    from (
      select p.id, row_number() over (order by md5(p.id::text || coalesce(p_seed, '')), p.id) as n
        from public.posts p
       where (p_author_ids is null or p.author_id = any (p_author_ids))
         and (p_exclude is null or not (p.author_id = any (p_exclude)))
         and (p_kinds is null or p.kind = any (p_kinds))
         and (p_paid is null or ((p.download_price > 0) = p_paid))
         and (coalesce(p_q, '') = '' or p.title ilike '%' || p_q || '%' or p.body ilike '%' || p_q || '%')
       order by n
      offset greatest(coalesce(p_from, 0), 0)
       limit least(greatest(coalesce(p_limit, 12), 1), 50)
    ) s;
$$;
revoke all on function public.shuffled_post_ids(text, integer, integer, text, uuid[], uuid[], text[], boolean) from public;
grant execute on function public.shuffled_post_ids(text, integer, integer, text, uuid[], uuid[], text[], boolean) to anon, authenticated;
