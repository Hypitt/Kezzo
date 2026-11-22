-- Kezzo update 60: savings groups, Premium tools (advanced roles, group payment method, CSV export, reports across groups).
-- Run once in the Supabase SQL editor, after update-59. Safe to run again. Contains no secrets.
-- One group with the basic roles stays fully free. These extras need the group owner to have Premium (checked here, in the database).

alter table public.vsla_members drop constraint if exists vsla_members_role_check;
alter table public.vsla_members add constraint vsla_members_role_check check (role in ('admin', 'member', 'secretary', 'agent'));

create or replace function public.vsla_owner_premium(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.user_plan(owner_id) = 'premium' from public.vsla_groups where id = p_group), false);
$$;
revoke all on function public.vsla_owner_premium(uuid) from public, anon, authenticated;

-- Treasurer ('admin') keeps every power. The secretary may edit member details and add guests. The field agent may send contributions for members.
create or replace function public.vsla_can_edit(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vsla_members where group_id = p_group and user_id = auth.uid() and active and role in ('admin', 'secretary'));
$$;
revoke all on function public.vsla_can_edit(uuid) from public, anon, authenticated;

create or replace function public.vsla_set_role(p_group uuid, p_member uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.vsla_members;
begin
  if not public.vsla_is_admin(p_group) then raise exception 'not_admin'; end if;
  if p_role not in ('admin', 'member', 'secretary', 'agent') then raise exception 'bad_role'; end if;
  if p_role in ('secretary', 'agent') and not public.vsla_owner_premium(p_group) then raise exception 'premium_required'; end if;
  select * into m from public.vsla_members where id = p_member and group_id = p_group and active;
  if not found then raise exception 'not_found'; end if;
  if p_role <> 'admin' and m.role = 'admin' and (select count(*) from public.vsla_members where group_id = p_group and role = 'admin' and active and user_id is not null) <= 1 then raise exception 'last_admin'; end if;
  if p_role <> 'member' and m.user_id is null then raise exception 'guest_no_role'; end if;
  update public.vsla_members set role = p_role where id = p_member;
end $$;

create or replace function public.vsla_member_details(p_group uuid)
returns table (id uuid, phone text, email text, address text, id_number text, guarantor_name text, guarantor_phone text)
language sql stable security definer set search_path = public as $$
  select m.id, m.phone, m.email, m.address, m.id_number, m.guarantor_name, m.guarantor_phone
    from public.vsla_members m
   where m.group_id = p_group and (public.vsla_can_edit(p_group) or m.user_id = auth.uid());
$$;

create or replace function public.vsla_update_member(p_group uuid, p_member uuid, p_name text, p_phone text, p_email text, p_address text, p_id_number text, p_gname text, p_gphone text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.vsla_members;
begin
  select * into m from public.vsla_members where id = p_member and group_id = p_group;
  if not found then raise exception 'not_found'; end if;
  if not (public.vsla_can_edit(p_group) or m.user_id = auth.uid()) then raise exception 'not_admin'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 1 then raise exception 'bad_name'; end if;
  update public.vsla_members set
    display_name = left(trim(p_name), 60), phone = left(trim(coalesce(p_phone, '')), 40), email = left(trim(coalesce(p_email, '')), 120),
    address = left(trim(coalesce(p_address, '')), 200), id_number = left(trim(coalesce(p_id_number, '')), 40),
    guarantor_name = left(trim(coalesce(p_gname, '')), 60), guarantor_phone = left(trim(coalesce(p_gphone, '')), 40)
   where id = p_member;
end $$;

create or replace function public.vsla_add_guest(p_group uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  if not public.vsla_can_edit(p_group) then raise exception 'not_admin'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 1 then raise exception 'bad_name'; end if;
  insert into public.vsla_members (group_id, display_name) values (p_group, left(trim(p_name), 60)) returning id into m;
  return m;
end $$;

-- Field agent: sends a contribution on behalf of a member. A treasurer still approves it.
create or replace function public.vsla_agent_submit(p_group uuid, p_member uuid, p_kind text, p_shares int, p_amount numeric, p_note text, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare c public.vsla_cycles; amt numeric;
begin
  if not exists (select 1 from public.vsla_members where group_id = p_group and user_id = auth.uid() and active and role in ('admin', 'agent')) then raise exception 'not_admin'; end if;
  if not public.vsla_owner_premium(p_group) then raise exception 'premium_required'; end if;
  if not exists (select 1 from public.vsla_members where id = p_member and group_id = p_group and active) then raise exception 'not_found'; end if;
  select * into c from public.vsla_cycles where group_id = p_group and status = 'active' order by started_at desc limit 1;
  if not found then raise exception 'no_cycle'; end if;
  if (select count(*) from public.vsla_contributions where member_id = p_member and status = 'pending') >= 10 then raise exception 'too_many_pending'; end if;
  if p_kind = 'shares' then
    if p_shares is null or p_shares < 1 or p_shares > c.max_shares then raise exception 'bad_shares'; end if;
    amt := p_shares * c.share_price;
  elsif p_kind = 'social' then
    if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
    amt := p_amount;
  else raise exception 'bad_kind'; end if;
  insert into public.vsla_contributions (group_id, cycle_id, member_id, kind, shares, amount, note, meeting_date)
  values (p_group, c.id, p_member, p_kind, case when p_kind = 'shares' then p_shares else 0 end, amt, left(coalesce(p_note, ''), 120), coalesce(p_date, current_date));
end $$;

-- The group's own payment method (for example the group's mobile money account). Kezzo holds none of this money.
create table if not exists public.vsla_group_methods (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.vsla_groups (id) on delete cascade,
  method text not null check (char_length(method) between 1 and 40),
  account_name text not null default '' check (char_length(account_name) <= 80),
  account_number text not null default '' check (char_length(account_number) <= 80),
  instructions text not null default '' check (char_length(instructions) <= 500),
  created_at timestamptz not null default now()
);
alter table public.vsla_group_methods enable row level security;
revoke all on public.vsla_group_methods from anon, authenticated;
grant select, insert, delete on public.vsla_group_methods to authenticated;
drop policy if exists vgm_admin on public.vsla_group_methods;
create policy vgm_admin on public.vsla_group_methods for all to authenticated using (public.vsla_is_admin(group_id)) with check (public.vsla_is_admin(group_id));
create or replace function public._limit_group_methods() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.vsla_owner_premium(new.group_id) then raise exception 'premium_required'; end if;
  if (select count(*) from public.vsla_group_methods where group_id = new.group_id) >= 3 then raise exception 'plan_limit_group_methods'; end if;
  return new;
end $$;
drop trigger if exists limit_group_methods on public.vsla_group_methods;
create trigger limit_group_methods before insert on public.vsla_group_methods for each row execute function public._limit_group_methods();

create or replace function public.vsla_pay_methods(p_group uuid)
returns table (id uuid, method text, account_name text, account_number text, instructions text)
language sql stable security definer set search_path = public as $$
  select m.id, m.method, m.account_name, m.account_number, m.instructions from public.vsla_group_methods m
   where m.group_id = p_group and public.vsla_is_member(p_group) and public.vsla_owner_premium(p_group) order by m.created_at;
$$;
revoke all on function public.vsla_pay_methods(uuid) from public, anon;
grant execute on function public.vsla_pay_methods(uuid) to authenticated;

-- Export: every recorded entry of a group (treasurers only, Premium owner, "export" limit above 0).
create or replace function public.vsla_export(p_group uuid)
returns table (meeting_date date, cycle text, member text, kind text, shares int, amount numeric, note text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.vsla_is_admin(p_group) then raise exception 'not_admin'; end if;
  if not public.vsla_owner_premium(p_group) or public.plan_limit((select owner_id from public.vsla_groups where id = p_group), 'export') <= 0 then raise exception 'premium_required'; end if;
  return query select e.meeting_date, c.name, m.display_name, e.kind, e.shares, e.amount, e.note
    from public.vsla_entries e join public.vsla_cycles c on c.id = e.cycle_id join public.vsla_members m on m.id = e.member_id
   where e.group_id = p_group order by e.meeting_date, e.created_at;
end $$;
revoke all on function public.vsla_export(uuid) from public, anon;
grant execute on function public.vsla_export(uuid) to authenticated;

-- Report across the groups the person manages as treasurer (Premium owner, "export" limit above 0).
create or replace function public.vsla_report()
returns table (group_id uuid, name text, currency text, members int, shares_total numeric, social_total numeric, fines_total numeric, loans_out numeric, outstanding numeric)
language sql stable security definer set search_path = public as $$
  select g.id, g.name,
         coalesce((select c.currency from public.vsla_cycles c where c.group_id = g.id order by c.started_at desc limit 1), ''),
         (select count(*)::int from public.vsla_members mm where mm.group_id = g.id and mm.active),
         coalesce((select sum(e.amount) from public.vsla_entries e where e.group_id = g.id and e.kind = 'shares'), 0),
         coalesce((select sum(e.amount) from public.vsla_entries e where e.group_id = g.id and e.kind = 'social'), 0),
         coalesce((select sum(e.amount) from public.vsla_entries e where e.group_id = g.id and e.kind = 'fine'), 0),
         coalesce((select sum(l.principal) from public.vsla_loans l where l.group_id = g.id), 0),
         coalesce((select sum(l.principal * (1 + l.interest_pct / 100) - coalesce((select sum(e.amount) from public.vsla_entries e where e.loan_id = l.id), 0)) from public.vsla_loans l where l.group_id = g.id and l.status = 'open'), 0)
    from public.vsla_groups g
   where public.vsla_is_admin(g.id) and public.vsla_owner_premium(g.id) and public.plan_limit(g.owner_id, 'export') > 0
   order by g.name;
$$;
revoke all on function public.vsla_report() from public, anon;
grant execute on function public.vsla_report() to authenticated;
