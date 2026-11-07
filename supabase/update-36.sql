-- Update 36: savings groups. ID number, safer removal, loan requests, messages. Run after update-35.
-- Safe to run more than once; keeps all existing data. Contains no secrets.

-- 1) Members: optional ID number (private like the other contact details), and "active" so removed members keep their history.
alter table public.vsla_members add column if not exists id_number text not null default '' check (char_length(id_number) <= 40);
alter table public.vsla_members add column if not exists active boolean not null default true;
revoke select on public.vsla_members from authenticated;
grant select (id, group_id, user_id, display_name, role, joined_at, active) on public.vsla_members to authenticated;

create or replace function public.vsla_is_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vsla_members where group_id = p_group and user_id = auth.uid() and active);
$$;
create or replace function public.vsla_is_admin(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vsla_members where group_id = p_group and user_id = auth.uid() and role = 'admin' and active);
$$;

drop function if exists public.vsla_member_details(uuid);
create or replace function public.vsla_member_details(p_group uuid)
returns table (id uuid, phone text, email text, address text, id_number text, guarantor_name text, guarantor_phone text)
language sql stable security definer set search_path = public as $$
  select m.id, m.phone, m.email, m.address, m.id_number, m.guarantor_name, m.guarantor_phone
    from public.vsla_members m
   where m.group_id = p_group and (public.vsla_is_admin(p_group) or m.user_id = auth.uid());
$$;

drop function if exists public.vsla_update_member(uuid, uuid, text, text, text, text, text, text);
create or replace function public.vsla_update_member(p_group uuid, p_member uuid, p_name text, p_phone text, p_email text, p_address text, p_id_number text, p_gname text, p_gphone text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.vsla_members;
begin
  select * into m from public.vsla_members where id = p_member and group_id = p_group;
  if not found then raise exception 'not_found'; end if;
  if not (public.vsla_is_admin(p_group) or m.user_id = auth.uid()) then raise exception 'not_admin'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 1 then raise exception 'bad_name'; end if;
  update public.vsla_members set
    display_name = left(trim(p_name), 60), phone = left(trim(coalesce(p_phone, '')), 40), email = left(trim(coalesce(p_email, '')), 120),
    address = left(trim(coalesce(p_address, '')), 200), id_number = left(trim(coalesce(p_id_number, '')), 40),
    guarantor_name = left(trim(coalesce(p_gname, '')), 60), guarantor_phone = left(trim(coalesce(p_gphone, '')), 40)
   where id = p_member;
end $$;

-- 2) Removal. A member is "blocked" while they hold shares in the running cycle or still owe on a loan.
create or replace function public.vsla_member_blocked(p_member uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from public.vsla_entries e join public.vsla_cycles c on c.id = e.cycle_id
       where e.member_id = p_member and e.kind = 'shares' and c.status = 'active')
    or exists (select 1 from public.vsla_loans l where l.member_id = p_member and l.status = 'open');
$$;

-- Only admins remove members. The history stays (the member is just marked inactive).
drop function if exists public.vsla_remove_member(uuid, uuid);
create or replace function public.vsla_remove_member(p_group uuid, p_member uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.vsla_members;
begin
  if not public.vsla_is_admin(p_group) then raise exception 'not_admin'; end if;
  select * into m from public.vsla_members where id = p_member and group_id = p_group and active;
  if not found then raise exception 'not_found'; end if;
  if m.user_id is not distinct from auth.uid() then raise exception 'use_leave'; end if;
  if public.vsla_member_blocked(p_member) then raise exception 'has_shares_or_debt'; end if;
  update public.vsla_members set active = false where id = p_member;
end $$;

-- A member can leave on their own only when they hold no shares and owe nothing.
create or replace function public.vsla_leave(p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.vsla_members;
begin
  select * into m from public.vsla_members where group_id = p_group and user_id = auth.uid() and active;
  if not found then raise exception 'not_found'; end if;
  if public.vsla_member_blocked(m.id) then raise exception 'has_shares_or_debt'; end if;
  if m.role = 'admin' and (select count(*) from public.vsla_members where group_id = p_group and role = 'admin' and active) <= 1 then raise exception 'last_admin'; end if;
  update public.vsla_members set active = false where id = m.id;
end $$;

-- Joining again after leaving brings the old record back as a plain member.
create or replace function public.vsla_join(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g uuid; nm text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id into g from public.vsla_groups where code = trim(p_code);
  if g is null then raise exception 'bad_code'; end if;
  select display_name into nm from public.profiles where id = auth.uid();
  insert into public.vsla_members (group_id, user_id, display_name) values (g, auth.uid(), coalesce(nm, 'Member'))
  on conflict (group_id, user_id) where user_id is not null do update set active = true, role = case when public.vsla_members.active then public.vsla_members.role else 'member' end;
  return g;
end $$;

-- 3) Loan requests: any member asks, admins and treasurers decide.
create table if not exists public.vsla_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.vsla_groups (id) on delete cascade,
  cycle_id uuid not null references public.vsla_cycles (id) on delete cascade,
  member_id uuid not null references public.vsla_members (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);
create index if not exists vsla_requests_group_idx on public.vsla_requests (group_id, created_at desc);
alter table public.vsla_requests enable row level security;
drop policy if exists vsla_requests_read on public.vsla_requests;
create policy vsla_requests_read on public.vsla_requests for select to authenticated using (
  public.vsla_is_admin(group_id) or exists (select 1 from public.vsla_members m where m.id = member_id and m.user_id = auth.uid()));
revoke all on public.vsla_requests from anon, authenticated;
grant select on public.vsla_requests to authenticated;

create or replace function public.vsla_request_loan(p_group uuid, p_amount numeric, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare m uuid; c uuid;
begin
  select id into m from public.vsla_members where group_id = p_group and user_id = auth.uid() and active;
  if m is null then raise exception 'not_member'; end if;
  select id into c from public.vsla_cycles where group_id = p_group and status = 'active';
  if c is null then raise exception 'no_cycle'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
  if (select count(*) from public.vsla_requests where member_id = m and status = 'pending') >= 3 then raise exception 'too_many_requests'; end if;
  insert into public.vsla_requests (group_id, cycle_id, member_id, amount, note) values (p_group, c, m, p_amount, left(coalesce(p_note, ''), 200));
end $$;

create or replace function public.vsla_decide_request(p_request uuid, p_approve boolean, p_due date)
returns void language plpgsql security definer set search_path = public as $$
declare r public.vsla_requests; c public.vsla_cycles;
begin
  select * into r from public.vsla_requests where id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  if not public.vsla_is_admin(r.group_id) then raise exception 'not_admin'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  if p_approve then
    select * into c from public.vsla_cycles where id = r.cycle_id;
    if c.status <> 'active' then raise exception 'cycle_closed'; end if;
    insert into public.vsla_loans (cycle_id, group_id, member_id, principal, interest_pct, due_date)
    values (r.cycle_id, r.group_id, r.member_id, r.amount, c.loan_interest_pct, p_due);
  end if;
  update public.vsla_requests set status = case when p_approve then 'approved' else 'declined' end, decided_at = now(), decided_by = auth.uid() where id = p_request;
end $$;

-- 4) Messages: the whole group, or private between a member and the treasurers.
create table if not exists public.vsla_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.vsla_groups (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient text not null check (recipient in ('group', 'admins')),
  thread_user uuid references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists vsla_messages_idx on public.vsla_messages (group_id, created_at desc);
alter table public.vsla_messages enable row level security;
drop policy if exists vsla_messages_read on public.vsla_messages;
create policy vsla_messages_read on public.vsla_messages for select to authenticated using (
  public.vsla_is_member(group_id) and (recipient = 'group' or public.vsla_is_admin(group_id) or thread_user = auth.uid()));
revoke all on public.vsla_messages from anon, authenticated;
grant select on public.vsla_messages to authenticated;

create or replace function public.vsla_post_message(p_group uuid, p_recipient text, p_thread uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if not public.vsla_is_member(p_group) then raise exception 'not_member'; end if;
  if char_length(trim(coalesce(p_body, ''))) < 1 then raise exception 'empty'; end if;
  if p_recipient = 'group' then
    t := null;
  elsif p_recipient = 'admins' then
    if public.vsla_is_admin(p_group) then
      -- a treasurer answers a member's private thread
      if p_thread is null or not exists (select 1 from public.vsla_members where group_id = p_group and user_id = p_thread) then raise exception 'bad_thread'; end if;
      t := p_thread;
    else
      t := auth.uid();
    end if;
  else
    raise exception 'bad_recipient';
  end if;
  insert into public.vsla_messages (group_id, sender_id, recipient, thread_user, body) values (p_group, auth.uid(), p_recipient, t, left(trim(p_body), 500));
end $$;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vsla_messages') then
    alter publication supabase_realtime add table public.vsla_messages;
  end if;
end $$;

revoke all on function public.vsla_member_blocked(uuid), public.vsla_member_details(uuid), public.vsla_update_member(uuid, uuid, text, text, text, text, text, text, text),
  public.vsla_remove_member(uuid, uuid), public.vsla_leave(uuid), public.vsla_join(text), public.vsla_request_loan(uuid, numeric, text),
  public.vsla_decide_request(uuid, boolean, date), public.vsla_post_message(uuid, text, uuid, text) from public, anon;
grant execute on function public.vsla_member_details(uuid), public.vsla_update_member(uuid, uuid, text, text, text, text, text, text, text),
  public.vsla_remove_member(uuid, uuid), public.vsla_leave(uuid), public.vsla_join(text), public.vsla_request_loan(uuid, numeric, text),
  public.vsla_decide_request(uuid, boolean, date), public.vsla_post_message(uuid, text, uuid, text) to authenticated;
