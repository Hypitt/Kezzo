-- Update 34: VSLA savings groups become their own feature (Connect > Savings), separate from social groups.
-- Members can be Kezzo users OR "guest" members with just a name (many savings-group members have no phone;
-- the treasurer records for them). Safe to run more than once. Contains no secrets.
-- NOTE: this replaces the first VSLA tables from update-33 (same names). If you already recorded real data with
-- update-33, tell me before running this. If you have only tested, run it as is.

drop table if exists public.vsla_entries cascade;
drop table if exists public.vsla_loans cascade;
drop table if exists public.vsla_cycles cascade;
drop function if exists public.vsla_start_cycle(uuid, text, text, numeric, numeric, int);
drop function if exists public.vsla_record(uuid, uuid, text, int, numeric, uuid, text, date, uuid);
drop function if exists public.vsla_lend(uuid, uuid, numeric, date, uuid);
drop function if exists public.vsla_close(uuid);

create table if not exists public.vsla_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 200),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  created_at timestamptz not null default now()
);

create table if not exists public.vsla_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.vsla_groups (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now()
);
create unique index if not exists vsla_members_user_uq on public.vsla_members (group_id, user_id) where user_id is not null;
create index if not exists vsla_members_user_idx on public.vsla_members (user_id);

create or replace function public.vsla_is_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vsla_members where group_id = p_group and user_id = auth.uid());
$$;
create or replace function public.vsla_is_admin(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vsla_members where group_id = p_group and user_id = auth.uid() and role = 'admin');
$$;

create table public.vsla_cycles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.vsla_groups (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  currency text not null default 'KES' check (char_length(currency) between 1 and 6),
  share_price numeric(14,2) not null check (share_price > 0),
  max_shares int not null default 5 check (max_shares between 1 and 50),
  loan_interest_pct numeric(5,2) not null default 10 check (loan_interest_pct between 0 and 100),
  loan_multiple int not null default 3 check (loan_multiple between 1 and 10),
  status text not null default 'active' check (status in ('active', 'closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  client_id uuid unique
);
create unique index vsla_one_active_cycle on public.vsla_cycles (group_id) where status = 'active';

create table public.vsla_loans (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.vsla_cycles (id) on delete cascade,
  group_id uuid not null references public.vsla_groups (id) on delete cascade,
  member_id uuid not null references public.vsla_members (id) on delete cascade,
  principal numeric(14,2) not null check (principal > 0),
  interest_pct numeric(5,2) not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'repaid')),
  created_at timestamptz not null default now(),
  client_id uuid unique
);
create index vsla_loans_cycle_idx on public.vsla_loans (cycle_id);

create table public.vsla_entries (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.vsla_cycles (id) on delete cascade,
  group_id uuid not null references public.vsla_groups (id) on delete cascade,
  member_id uuid not null references public.vsla_members (id) on delete cascade,
  kind text not null check (kind in ('shares', 'social', 'fine', 'loan_repay')),
  amount numeric(14,2) not null check (amount > 0),
  shares int not null default 0 check (shares >= 0),
  loan_id uuid references public.vsla_loans (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 120),
  meeting_date date not null default current_date,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  client_id uuid unique
);
create index vsla_entries_cycle_idx on public.vsla_entries (cycle_id, created_at desc);

alter table public.vsla_groups enable row level security;
alter table public.vsla_members enable row level security;
alter table public.vsla_cycles enable row level security;
alter table public.vsla_loans enable row level security;
alter table public.vsla_entries enable row level security;

drop policy if exists vsla_groups_read on public.vsla_groups;
create policy vsla_groups_read on public.vsla_groups for select to authenticated using (public.vsla_is_member(id));
drop policy if exists vsla_members_read on public.vsla_members;
create policy vsla_members_read on public.vsla_members for select to authenticated using (public.vsla_is_member(group_id));
drop policy if exists vsla_cycles_read on public.vsla_cycles;
create policy vsla_cycles_read on public.vsla_cycles for select to authenticated using (public.vsla_is_member(group_id));
drop policy if exists vsla_loans_read on public.vsla_loans;
create policy vsla_loans_read on public.vsla_loans for select to authenticated using (public.vsla_is_member(group_id));
drop policy if exists vsla_entries_read on public.vsla_entries;
create policy vsla_entries_read on public.vsla_entries for select to authenticated using (public.vsla_is_member(group_id));

revoke all on public.vsla_groups, public.vsla_members, public.vsla_cycles, public.vsla_loans, public.vsla_entries from anon, authenticated;
grant select on public.vsla_groups, public.vsla_members, public.vsla_cycles, public.vsla_loans, public.vsla_entries to authenticated;

-- ---------------------------------------------------------------- groups and members
create or replace function public.vsla_create_group(p_name text, p_description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid; nm text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select display_name into nm from public.profiles where id = auth.uid();
  insert into public.vsla_groups (name, description, owner_id) values (trim(p_name), left(coalesce(p_description, ''), 200), auth.uid()) returning id into g;
  insert into public.vsla_members (group_id, user_id, display_name, role) values (g, auth.uid(), coalesce(nm, 'Member'), 'admin');
  return g;
end $$;

create or replace function public.vsla_join(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid; nm text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id into g from public.vsla_groups where code = trim(p_code);
  if g is null then raise exception 'bad_code'; end if;
  select display_name into nm from public.profiles where id = auth.uid();
  insert into public.vsla_members (group_id, user_id, display_name) values (g, auth.uid(), coalesce(nm, 'Member')) on conflict do nothing;
  return g;
end $$;

create or replace function public.vsla_add_guest(p_group uuid, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare m uuid;
begin
  if not public.vsla_is_admin(p_group) then raise exception 'not_admin'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 1 then raise exception 'bad_name'; end if;
  insert into public.vsla_members (group_id, display_name) values (p_group, left(trim(p_name), 60)) returning id into m;
  return m;
end $$;

create or replace function public.vsla_set_role(p_group uuid, p_member uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vsla_is_admin(p_group) then raise exception 'not_admin'; end if;
  if p_role not in ('admin', 'member') then raise exception 'bad_role'; end if;
  if p_role = 'member' and (select count(*) from public.vsla_members where group_id = p_group and role = 'admin' and user_id is not null) <= 1
     and exists (select 1 from public.vsla_members where id = p_member and role = 'admin') then raise exception 'last_admin'; end if;
  -- guests have no account, so they cannot be admins
  update public.vsla_members set role = p_role where id = p_member and group_id = p_group and (p_role = 'member' or user_id is not null);
end $$;

create or replace function public.vsla_remove_member(p_group uuid, p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.vsla_members;
begin
  select * into m from public.vsla_members where id = p_member and group_id = p_group;
  if not found then raise exception 'not_found'; end if;
  if m.user_id is distinct from auth.uid() and not public.vsla_is_admin(p_group) then raise exception 'not_admin'; end if;
  if exists (select 1 from public.vsla_entries where member_id = p_member) or exists (select 1 from public.vsla_loans where member_id = p_member) then raise exception 'has_records'; end if;
  if m.role = 'admin' and (select count(*) from public.vsla_members where group_id = p_group and role = 'admin') <= 1 then raise exception 'last_admin'; end if;
  delete from public.vsla_members where id = p_member;
end $$;

create or replace function public.vsla_delete_group(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.vsla_groups where id = p_group and owner_id = auth.uid()) then raise exception 'not_owner'; end if;
  delete from public.vsla_groups where id = p_group;
end $$;

-- ---------------------------------------------------------------- the books
create or replace function public.vsla_start_cycle(p_group uuid, p_name text, p_currency text, p_price numeric, p_interest numeric, p_multiple int, p_client uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vsla_is_admin(p_group) then raise exception 'not_admin'; end if;
  if p_client is not null and exists (select 1 from public.vsla_cycles where client_id = p_client) then return; end if;
  insert into public.vsla_cycles (group_id, name, currency, share_price, loan_interest_pct, loan_multiple, created_by, client_id)
  values (p_group, trim(p_name), upper(trim(p_currency)), p_price, p_interest, p_multiple, auth.uid(), p_client);
exception when unique_violation then raise exception 'cycle_active';
end $$;

create or replace function public.vsla_record(p_cycle uuid, p_member uuid, p_kind text, p_shares int, p_amount numeric, p_loan uuid, p_note text, p_date date, p_client uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.vsla_cycles; l public.vsla_loans; amt numeric; owed numeric := 0;
begin
  select * into c from public.vsla_cycles where id = p_cycle;
  if not found then raise exception 'not_found'; end if;
  if not public.vsla_is_admin(c.group_id) then raise exception 'not_admin'; end if;
  if c.status <> 'active' then raise exception 'cycle_closed'; end if;
  if p_client is not null and exists (select 1 from public.vsla_entries where client_id = p_client) then return; end if;

  if p_kind = 'loan_repay' then
    select * into l from public.vsla_loans where id = p_loan and cycle_id = p_cycle for update;
    if not found or l.status <> 'open' then raise exception 'bad_loan'; end if;
    if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
    owed := l.principal * (1 + l.interest_pct / 100) - coalesce((select sum(amount) from public.vsla_entries where loan_id = l.id), 0);
    if p_amount > owed + 0.005 then raise exception 'over_repay'; end if;
    amt := p_amount;
    p_member := l.member_id;
  else
    if not exists (select 1 from public.vsla_members where id = p_member and group_id = c.group_id) then raise exception 'not_member'; end if;
    if p_kind = 'shares' then
      if p_shares is null or p_shares < 1 or p_shares > c.max_shares then raise exception 'bad_shares'; end if;
      amt := p_shares * c.share_price;
    elsif p_kind in ('social', 'fine') then
      if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
      amt := p_amount;
    else
      raise exception 'bad_kind';
    end if;
  end if;

  insert into public.vsla_entries (cycle_id, group_id, member_id, kind, amount, shares, loan_id, note, meeting_date, recorded_by, client_id)
  values (p_cycle, c.group_id, p_member, p_kind, amt, case when p_kind = 'shares' then p_shares else 0 end,
          case when p_kind = 'loan_repay' then p_loan else null end, left(coalesce(p_note, ''), 120), coalesce(p_date, current_date), auth.uid(), p_client);

  if p_kind = 'loan_repay' and owed - amt <= 0.005 then
    update public.vsla_loans set status = 'repaid' where id = p_loan;
  end if;
end $$;

create or replace function public.vsla_lend(p_cycle uuid, p_member uuid, p_principal numeric, p_due date, p_client uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.vsla_cycles; saved numeric; open_owed numeric; cash numeric;
begin
  select * into c from public.vsla_cycles where id = p_cycle for update;
  if not found then raise exception 'not_found'; end if;
  if not public.vsla_is_admin(c.group_id) then raise exception 'not_admin'; end if;
  if c.status <> 'active' then raise exception 'cycle_closed'; end if;
  if p_client is not null and exists (select 1 from public.vsla_loans where client_id = p_client) then return; end if;
  if p_principal is null or p_principal <= 0 then raise exception 'bad_amount'; end if;
  if not exists (select 1 from public.vsla_members where id = p_member and group_id = c.group_id) then raise exception 'not_member'; end if;

  select coalesce(sum(amount), 0) into saved from public.vsla_entries where cycle_id = p_cycle and member_id = p_member and kind = 'shares';
  select coalesce((select sum(l.principal * (1 + l.interest_pct / 100)) from public.vsla_loans l where l.cycle_id = p_cycle and l.member_id = p_member), 0)
       - coalesce((select sum(e.amount) from public.vsla_entries e join public.vsla_loans l2 on l2.id = e.loan_id where l2.cycle_id = p_cycle and l2.member_id = p_member), 0)
    into open_owed;
  if p_principal + greatest(open_owed, 0) > saved * c.loan_multiple then raise exception 'loan_over_limit'; end if;

  select coalesce((select sum(amount) from public.vsla_entries where cycle_id = p_cycle), 0)
       - coalesce((select sum(principal) from public.vsla_loans where cycle_id = p_cycle), 0) into cash;
  if p_principal > cash then raise exception 'not_enough_cash'; end if;

  insert into public.vsla_loans (cycle_id, group_id, member_id, principal, interest_pct, due_date, client_id)
  values (p_cycle, c.group_id, p_member, p_principal, c.loan_interest_pct, p_due, p_client);
end $$;

create or replace function public.vsla_close(p_cycle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.vsla_cycles;
begin
  select * into c from public.vsla_cycles where id = p_cycle for update;
  if not found then raise exception 'not_found'; end if;
  if not public.vsla_is_admin(c.group_id) then raise exception 'not_admin'; end if;
  update public.vsla_cycles set status = 'closed', closed_at = now() where id = p_cycle and status = 'active';
end $$;

revoke all on function public.vsla_is_member(uuid), public.vsla_is_admin(uuid) from public, anon;
revoke all on function public.vsla_create_group(text, text), public.vsla_join(text), public.vsla_add_guest(uuid, text),
  public.vsla_set_role(uuid, uuid, text), public.vsla_remove_member(uuid, uuid), public.vsla_delete_group(uuid),
  public.vsla_start_cycle(uuid, text, text, numeric, numeric, int, uuid), public.vsla_record(uuid, uuid, text, int, numeric, uuid, text, date, uuid),
  public.vsla_lend(uuid, uuid, numeric, date, uuid), public.vsla_close(uuid) from public, anon;
grant execute on function public.vsla_is_member(uuid), public.vsla_is_admin(uuid),
  public.vsla_create_group(text, text), public.vsla_join(text), public.vsla_add_guest(uuid, text),
  public.vsla_set_role(uuid, uuid, text), public.vsla_remove_member(uuid, uuid), public.vsla_delete_group(uuid),
  public.vsla_start_cycle(uuid, text, text, numeric, numeric, int, uuid), public.vsla_record(uuid, uuid, text, int, numeric, uuid, text, date, uuid),
  public.vsla_lend(uuid, uuid, numeric, date, uuid), public.vsla_close(uuid) to authenticated;
