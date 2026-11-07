-- Update 35: contribution frequency, loans without a forced ceiling, optional member details and guarantors.
-- Safe to run more than once; keeps all existing savings data. Contains no secrets. Run after update-34.

-- 1) Contributions can be weekly, every two weeks or monthly.
alter table public.vsla_cycles add column if not exists frequency text not null default 'weekly';
alter table public.vsla_cycles drop constraint if exists vsla_cycles_frequency_check;
alter table public.vsla_cycles add constraint vsla_cycles_frequency_check check (frequency in ('weekly', 'biweekly', 'monthly'));

-- 2) The loan limit becomes optional guidance (empty = no limit) and is no longer enforced.
alter table public.vsla_cycles alter column loan_multiple drop not null;
alter table public.vsla_cycles alter column loan_multiple drop default;
alter table public.vsla_cycles drop constraint if exists vsla_cycles_loan_multiple_check;
alter table public.vsla_cycles add constraint vsla_cycles_loan_multiple_check check (loan_multiple is null or loan_multiple between 1 and 10);

-- 3) Optional contact details and guarantor for each member. Kept private: only treasurers and the member themselves can read them.
alter table public.vsla_members add column if not exists phone text not null default '' check (char_length(phone) <= 40);
alter table public.vsla_members add column if not exists email text not null default '' check (char_length(email) <= 120);
alter table public.vsla_members add column if not exists address text not null default '' check (char_length(address) <= 200);
alter table public.vsla_members add column if not exists guarantor_name text not null default '' check (char_length(guarantor_name) <= 60);
alter table public.vsla_members add column if not exists guarantor_phone text not null default '' check (char_length(guarantor_phone) <= 40);
revoke select on public.vsla_members from authenticated;
grant select (id, group_id, user_id, display_name, role, joined_at) on public.vsla_members to authenticated;

-- 4) A loan can name a guarantor from the group (optional).
alter table public.vsla_loans add column if not exists guarantor_id uuid references public.vsla_members (id) on delete set null;

create or replace function public.vsla_member_details(p_group uuid)
returns table (id uuid, phone text, email text, address text, guarantor_name text, guarantor_phone text)
language sql stable security definer set search_path = public as $$
  select m.id, m.phone, m.email, m.address, m.guarantor_name, m.guarantor_phone
    from public.vsla_members m
   where m.group_id = p_group and (public.vsla_is_admin(p_group) or m.user_id = auth.uid());
$$;

create or replace function public.vsla_update_member(p_group uuid, p_member uuid, p_name text, p_phone text, p_email text, p_address text, p_gname text, p_gphone text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.vsla_members;
begin
  select * into m from public.vsla_members where id = p_member and group_id = p_group;
  if not found then raise exception 'not_found'; end if;
  if not (public.vsla_is_admin(p_group) or m.user_id = auth.uid()) then raise exception 'not_admin'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 1 then raise exception 'bad_name'; end if;
  update public.vsla_members set
    display_name = left(trim(p_name), 60), phone = left(trim(coalesce(p_phone, '')), 40), email = left(trim(coalesce(p_email, '')), 120),
    address = left(trim(coalesce(p_address, '')), 200), guarantor_name = left(trim(coalesce(p_gname, '')), 60), guarantor_phone = left(trim(coalesce(p_gphone, '')), 40)
   where id = p_member;
end $$;

-- 5) Start a cycle with a frequency and an optional loan limit.
drop function if exists public.vsla_start_cycle(uuid, text, text, numeric, numeric, int, uuid);
create or replace function public.vsla_start_cycle(p_group uuid, p_name text, p_currency text, p_price numeric, p_interest numeric, p_multiple int, p_frequency text, p_client uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vsla_is_admin(p_group) then raise exception 'not_admin'; end if;
  if p_client is not null and exists (select 1 from public.vsla_cycles where client_id = p_client) then return; end if;
  insert into public.vsla_cycles (group_id, name, currency, share_price, loan_interest_pct, loan_multiple, frequency, created_by, client_id)
  values (p_group, trim(p_name), upper(trim(p_currency)), p_price, p_interest, p_multiple, coalesce(p_frequency, 'weekly'), auth.uid(), p_client);
exception when unique_violation then raise exception 'cycle_active';
end $$;

-- 6) Lending: admins and treasurers decide. No ceiling and no cash check; an optional guarantor.
drop function if exists public.vsla_lend(uuid, uuid, numeric, date, uuid);
create or replace function public.vsla_lend(p_cycle uuid, p_member uuid, p_principal numeric, p_due date, p_guarantor uuid, p_client uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.vsla_cycles;
begin
  select * into c from public.vsla_cycles where id = p_cycle for update;
  if not found then raise exception 'not_found'; end if;
  if not public.vsla_is_admin(c.group_id) then raise exception 'not_admin'; end if;
  if c.status <> 'active' then raise exception 'cycle_closed'; end if;
  if p_client is not null and exists (select 1 from public.vsla_loans where client_id = p_client) then return; end if;
  if p_principal is null or p_principal <= 0 then raise exception 'bad_amount'; end if;
  if not exists (select 1 from public.vsla_members where id = p_member and group_id = c.group_id) then raise exception 'not_member'; end if;
  if p_guarantor is not null and not exists (select 1 from public.vsla_members where id = p_guarantor and group_id = c.group_id) then raise exception 'not_member'; end if;
  insert into public.vsla_loans (cycle_id, group_id, member_id, principal, interest_pct, due_date, guarantor_id, client_id)
  values (p_cycle, c.group_id, p_member, p_principal, c.loan_interest_pct, p_due, p_guarantor, p_client);
end $$;

revoke all on function public.vsla_member_details(uuid), public.vsla_update_member(uuid, uuid, text, text, text, text, text, text),
  public.vsla_start_cycle(uuid, text, text, numeric, numeric, int, text, uuid), public.vsla_lend(uuid, uuid, numeric, date, uuid, uuid) from public, anon;
grant execute on function public.vsla_member_details(uuid), public.vsla_update_member(uuid, uuid, text, text, text, text, text, text),
  public.vsla_start_cycle(uuid, text, text, numeric, numeric, int, text, uuid), public.vsla_lend(uuid, uuid, numeric, date, uuid, uuid) to authenticated;
