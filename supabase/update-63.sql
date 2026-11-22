-- Kezzo update 63: payment link and QR code image for payment methods (sellers and Kezzo's own collection accounts).
-- Run once in the Supabase SQL editor, after update-62. Safe to run again. Contains no secrets.
-- The QR image is stored as a small picture inside the row, so it stays as private as the other payment details.

alter table public.user_payment_methods add column if not exists pay_link text not null default '';
alter table public.user_payment_methods add column if not exists qr_data text not null default '';
alter table public.collection_accounts add column if not exists pay_link text not null default '';
alter table public.collection_accounts add column if not exists qr_data text not null default '';

alter table public.user_payment_methods drop constraint if exists upm_link_ck;
alter table public.user_payment_methods add constraint upm_link_ck check (char_length(pay_link) <= 300 and (pay_link = '' or pay_link ~* '^https?://'));
alter table public.user_payment_methods drop constraint if exists upm_qr_ck;
alter table public.user_payment_methods add constraint upm_qr_ck check (char_length(qr_data) <= 200000 and (qr_data = '' or qr_data like 'data:image/%'));
alter table public.collection_accounts drop constraint if exists ca_link_ck;
alter table public.collection_accounts add constraint ca_link_ck check (char_length(pay_link) <= 300 and (pay_link = '' or pay_link ~* '^https?://'));
alter table public.collection_accounts drop constraint if exists ca_qr_ck;
alter table public.collection_accounts add constraint ca_qr_ck check (char_length(qr_data) <= 200000 and (qr_data = '' or qr_data like 'data:image/%'));

drop function if exists public.order_payment_methods(uuid);
create or replace function public.order_payment_methods(p_order uuid)
returns table (id uuid, method text, type text, account_name text, account_number text, instructions text, is_default boolean, pay_link text, qr_data text)
language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where orders.id = p_order;
  if not found or not (auth.uid() in (o.buyer_id, o.seller_id) or public.is_admin()) then return; end if;
  return query select m.id, m.method, m.type, m.account_name, m.account_number, m.instructions, m.is_default, m.pay_link, m.qr_data
    from public.user_payment_methods m where m.user_id = o.seller_id and m.enabled order by m.is_default desc, m.created_at;
end; $$;
revoke all on function public.order_payment_methods(uuid) from public, anon;
grant execute on function public.order_payment_methods(uuid) to authenticated;
