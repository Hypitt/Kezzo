-- Kezzo update 62: reviews from completed orders. One review per order, written by the buyer, shown on the seller's profile.
-- Run once in the Supabase SQL editor, after update-61. Safe to run again. Contains no secrets.

create table if not exists public.order_reviews (
  order_id uuid primary key references public.orders (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists order_reviews_seller_idx on public.order_reviews (seller_id, created_at desc);

alter table public.order_reviews enable row level security;
revoke all on public.order_reviews from anon;
revoke insert, update, delete on public.order_reviews from authenticated;
-- Reviews are public to signed-in members. Only the function below writes them; admins may remove an abusive one.
drop policy if exists reviews_read on public.order_reviews;
create policy reviews_read on public.order_reviews for select to authenticated using (true);
drop policy if exists reviews_admin_delete on public.order_reviews;
create policy reviews_admin_delete on public.order_reviews for delete to authenticated using (public.is_admin());
grant delete on public.order_reviews to authenticated;

create or replace function public.review_order(p_order uuid, p_rating int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order and buyer_id = auth.uid();
  if not found then raise exception 'not_buyer'; end if;
  if o.status <> 'completed' then raise exception 'not_completed'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'bad_rating'; end if;
  if exists (select 1 from public.order_reviews where order_id = p_order) then raise exception 'already_reviewed'; end if;
  insert into public.order_reviews (order_id, reviewer_id, seller_id, rating, comment)
  values (p_order, auth.uid(), o.seller_id, p_rating, left(trim(coalesce(p_comment, '')), 300));
end; $$;
revoke all on function public.review_order(uuid, int, text) from public, anon;
grant execute on function public.review_order(uuid, int, text) to authenticated;

-- Average and count for a page of sellers (used on listings).
create or replace function public.seller_ratings(p_ids uuid[])
returns table (seller_id uuid, avg_rating numeric, n bigint)
language sql stable security definer set search_path = public as $$
  select r.seller_id, round(avg(r.rating)::numeric, 1), count(*) from public.order_reviews r where r.seller_id = any(p_ids) group by r.seller_id;
$$;
revoke all on function public.seller_ratings(uuid[]) from public, anon;
grant execute on function public.seller_ratings(uuid[]) to authenticated;

-- The latest reviews of one seller, with the reviewer's first name only.
create or replace function public.seller_reviews(p_seller uuid, p_limit int default 20)
returns table (id uuid, rating int, comment text, created_at timestamptz, reviewer text)
language sql stable security definer set search_path = public as $$
  select r.order_id, r.rating, r.comment, r.created_at, split_part(p.display_name, ' ', 1)
    from public.order_reviews r join public.profiles p on p.id = r.reviewer_id
   where r.seller_id = p_seller order by r.created_at desc limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.seller_reviews(uuid, int) from public, anon;
grant execute on function public.seller_reviews(uuid, int) to authenticated;
