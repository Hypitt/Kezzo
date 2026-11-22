-- Kezzo update 58: Premium step 3 (report reasons for scams, one small "needs attention" summary for the menu).
-- Run once in the Supabase SQL editor, after update-57. Safe to run again. Contains no secrets.

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check
  check (reason in ('spam', 'harassment', 'sexual', 'violence', 'other', 'scam', 'fake_product', 'no_delivery'));

-- Orders waiting for the seller to answer, and how many days of Premium are left (null when there is no Premium to remind about).
create or replace function public.my_alerts()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.subscriptions; n int; left_days int;
begin
  select count(*) into n from public.orders where seller_id = auth.uid() and status = 'marked_paid';
  select * into s from public.subscriptions where user_id = auth.uid() and not suspended;
  if found then left_days := ceil(extract(epoch from (s.expires_at - now())) / 86400)::int; end if;
  return jsonb_build_object('orders', n, 'premium_days', left_days);
end; $$;
revoke all on function public.my_alerts() from public, anon;
grant execute on function public.my_alerts() to authenticated;
