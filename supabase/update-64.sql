-- Update 64: protect bank and card details on Kezzo.
-- 1) Kezzo refuses card numbers, IBANs, PINs and passwords typed into payment fields, notes and references.
-- 2) Kezzo's own receiving accounts are no longer readable by every member: they are given only through kezzo_pay_methods(country).
-- 3) A seller's payment details are given to the buyer only while the order is waiting for payment.

create or replace function public._luhn_ok(p text) returns boolean language plpgsql immutable as $$
declare i int; d int; s int := 0; alt boolean := false;
begin
  for i in reverse length(p)..1 loop
    d := substr(p, i, 1)::int;
    if alt then d := d * 2; if d > 9 then d := d - 9; end if; end if;
    s := s + d; alt := not alt;
  end loop;
  return s % 10 = 0;
end; $$;

create or replace function public._looks_sensitive(t text, check_iban boolean default true) returns boolean language plpgsql immutable as $$
declare m text[]; digits text;
begin
  if t is null or t = '' then return false; end if;
  for m in select regexp_matches(t, '((?:[0-9][ -]?){13,19})', 'g') loop
    digits := regexp_replace(m[1], '[^0-9]', '', 'g');
    if length(digits) between 13 and 19 and public._luhn_ok(digits) then return true; end if;
  end loop;
  if check_iban and upper(t) ~ '(^|[^A-Z0-9])[A-Z]{2}[0-9]{2}[ ]?([A-Z0-9]{4}[ ]?){2,7}[A-Z0-9]{1,4}([^A-Z0-9]|$)' and length(regexp_replace(t, '[^A-Za-z0-9]', '', 'g')) >= 15 then return true; end if;
  if lower(t) ~ '(cvv2?|cvc|password|mot de passe|mot-de-passe|code secret|pin code|code pin|\mpin *[:=])' then return true; end if;
  return false;
end; $$;

create or replace function public._reject_sensitive() returns trigger language plpgsql as $$
declare c text; v text; j jsonb := to_jsonb(new);
begin
  foreach c in array tg_argv loop
    v := j ->> c;
    if public._looks_sensitive(v, c <> 'reference') then raise exception 'sensitive_data'; end if;
  end loop;
  return new;
end; $$;

drop trigger if exists upm_sensitive on public.user_payment_methods;
create trigger upm_sensitive before insert or update on public.user_payment_methods
  for each row execute function public._reject_sensitive('method', 'account_name', 'account_number', 'instructions', 'pay_link');
drop trigger if exists ca_sensitive on public.collection_accounts;
create trigger ca_sensitive before insert or update on public.collection_accounts
  for each row execute function public._reject_sensitive('method', 'account_name', 'account_number', 'instructions', 'pay_link');
drop trigger if exists sp_sensitive on public.subscription_payments;
create trigger sp_sensitive before insert or update on public.subscription_payments
  for each row execute function public._reject_sensitive('reference', 'note');
drop trigger if exists orders_sensitive on public.orders;
create trigger orders_sensitive before insert or update on public.orders
  for each row execute function public._reject_sensitive('buyer_note');

-- Kezzo's receiving accounts: admin reads the table; members get them only for a country that has a price.
drop policy if exists accounts_read on public.collection_accounts;
create policy accounts_read on public.collection_accounts for select to authenticated using (public.is_admin());

create or replace function public.kezzo_pay_methods(p_country text)
returns table (id uuid, method text, account_name text, account_number text, instructions text, pay_link text, qr_data text, country text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.plan_prices p where lower(p.country) = lower(p_country) and p.active) then return; end if;
  return query select a.id, a.method, a.account_name, a.account_number, a.instructions, a.pay_link, a.qr_data, a.country
    from public.collection_accounts a where lower(a.country) = lower(p_country) and a.active order by a.created_at;
end; $$;
revoke all on function public.kezzo_pay_methods(text) from public, anon;
grant execute on function public.kezzo_pay_methods(text) to authenticated;

-- Seller details: the seller always, the buyer only while payment is still expected, admins for disputes.
create or replace function public.order_payment_methods(p_order uuid)
returns table (id uuid, method text, type text, account_name text, account_number text, instructions text, is_default boolean, pay_link text, qr_data text)
language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where orders.id = p_order;
  if not found then return; end if;
  if not (auth.uid() = o.seller_id or public.is_admin()
          or (auth.uid() = o.buyer_id and o.status in ('awaiting_payment', 'marked_paid', 'disputed'))) then return; end if;
  return query select m.id, m.method, m.type, m.account_name, m.account_number, m.instructions, m.is_default, m.pay_link, m.qr_data
    from public.user_payment_methods m where m.user_id = o.seller_id and m.enabled order by m.is_default desc, m.created_at;
end; $$;
revoke all on function public.order_payment_methods(uuid) from public, anon;
grant execute on function public.order_payment_methods(uuid) to authenticated;
