-- Kezzo update 49: savings groups (VSLA): members send their own contributions, treasurers approve them.
-- Run once in the Supabase SQL editor, after update-36. Safe to run again.

create table if not exists public.vsla_contributions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.vsla_groups (id) on delete cascade,
  cycle_id uuid not null references public.vsla_cycles (id) on delete cascade,
  member_id uuid not null references public.vsla_members (id) on delete cascade,
  kind text not null check (kind in ('shares', 'social', 'loan_repay')),
  shares int not null default 0 check (shares >= 0),
  amount numeric(14,2) not null check (amount > 0),
  loan_id uuid references public.vsla_loans (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 120),
  meeting_date date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null
);
create index if not exists vsla_contributions_group_idx on public.vsla_contributions (group_id, status, created_at desc);
alter table public.vsla_contributions enable row level security;

drop policy if exists vsla_contributions_read on public.vsla_contributions;
create policy vsla_contributions_read on public.vsla_contributions for select to authenticated using (
  public.vsla_is_admin(group_id)
  or exists (select 1 from public.vsla_members m where m.id = member_id and m.user_id = auth.uid()));
revoke all on public.vsla_contributions from anon, authenticated;
grant select on public.vsla_contributions to authenticated;

-- A member sends a contribution. For shares the amount is worked out from the share price.
create or replace function public.vsla_submit_contribution(p_group uuid, p_kind text, p_shares int, p_amount numeric, p_loan uuid, p_note text, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare m uuid; c public.vsla_cycles; amt numeric; l public.vsla_loans; owed numeric;
begin
  select id into m from public.vsla_members where group_id = p_group and user_id = auth.uid() and active;
  if m is null then raise exception 'not_member'; end if;
  select * into c from public.vsla_cycles where group_id = p_group and status = 'active' order by started_at desc limit 1;
  if not found then raise exception 'no_cycle'; end if;
  if (select count(*) from public.vsla_contributions where member_id = m and status = 'pending') >= 10 then raise exception 'too_many_pending'; end if;

  if p_kind = 'shares' then
    if p_shares is null or p_shares < 1 or p_shares > c.max_shares then raise exception 'bad_shares'; end if;
    amt := p_shares * c.share_price;
  elsif p_kind = 'social' then
    if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
    amt := p_amount;
  elsif p_kind = 'loan_repay' then
    select * into l from public.vsla_loans where id = p_loan and cycle_id = c.id and member_id = m and status = 'open';
    if not found then raise exception 'bad_loan'; end if;
    if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;
    owed := l.principal * (1 + l.interest_pct / 100) - coalesce((select sum(amount) from public.vsla_entries where loan_id = l.id), 0);
    if p_amount > owed + 0.005 then raise exception 'over_repay'; end if;
    amt := p_amount;
  else
    raise exception 'bad_kind';
  end if;

  insert into public.vsla_contributions (group_id, cycle_id, member_id, kind, shares, amount, loan_id, note, meeting_date)
  values (p_group, c.id, m, p_kind, case when p_kind = 'shares' then p_shares else 0 end, amt,
          case when p_kind = 'loan_repay' then p_loan else null end, left(coalesce(p_note, ''), 120), coalesce(p_date, current_date));
end $$;

-- A treasurer approves (it is then written in the books like any other entry) or declines.
create or replace function public.vsla_decide_contribution(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.vsla_contributions;
begin
  select * into r from public.vsla_contributions where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not public.vsla_is_admin(r.group_id) then raise exception 'not_admin'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  if p_approve then
    perform public.vsla_record(r.cycle_id, r.member_id, r.kind, r.shares,
      case when r.kind = 'shares' then null else r.amount end, r.loan_id, r.note, r.meeting_date, r.id);
  end if;
  update public.vsla_contributions set status = case when p_approve then 'approved' else 'declined' end, decided_at = now(), decided_by = auth.uid() where id = p_id;
end $$;

-- A member takes back a contribution that is still waiting.
create or replace function public.vsla_cancel_contribution(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.vsla_contributions set status = 'cancelled', decided_at = now()
   where id = p_id and status = 'pending'
     and exists (select 1 from public.vsla_members m where m.id = member_id and m.user_id = auth.uid());
end $$;

revoke all on function public.vsla_submit_contribution(uuid, text, int, numeric, uuid, text, date) from public, anon;
revoke all on function public.vsla_decide_contribution(uuid, boolean) from public, anon;
revoke all on function public.vsla_cancel_contribution(uuid) from public, anon;
grant execute on function public.vsla_submit_contribution(uuid, text, int, numeric, uuid, text, date) to authenticated;
grant execute on function public.vsla_decide_contribution(uuid, boolean) to authenticated;
grant execute on function public.vsla_cancel_contribution(uuid) to authenticated;
