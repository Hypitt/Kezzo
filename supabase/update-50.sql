-- Kezzo update 50: savings groups. Treasurers can approve a different amount than requested; a monthly social fund per cycle.
-- Run once in the Supabase SQL editor, after update-49. Safe to run again.

alter table public.vsla_contributions add column if not exists approved_amount numeric(14,2);
alter table public.vsla_requests add column if not exists approved_amount numeric(14,2);
alter table public.vsla_cycles add column if not exists social_monthly numeric(14,2) not null default 0 check (social_monthly >= 0);

-- Approve a member's contribution, optionally with a different amount.
-- For shares the amount must be a whole number of shares (a multiple of the share price).
drop function if exists public.vsla_decide_contribution(uuid, boolean);
create or replace function public.vsla_decide_contribution(p_id uuid, p_approve boolean, p_amount numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.vsla_contributions; c public.vsla_cycles; amt numeric; n int;
begin
  select * into r from public.vsla_contributions where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if not public.vsla_is_admin(r.group_id) then raise exception 'not_admin'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  amt := coalesce(p_amount, r.amount);
  if p_approve then
    if amt <= 0 then raise exception 'bad_amount'; end if;
    if r.kind = 'shares' then
      select * into c from public.vsla_cycles where id = r.cycle_id;
      n := round(amt / c.share_price);
      if n < 1 or abs(n * c.share_price - amt) > 0.005 then raise exception 'amount_not_multiple'; end if;
      perform public.vsla_record(r.cycle_id, r.member_id, 'shares', n, null, null, r.note, r.meeting_date, r.id);
    else
      perform public.vsla_record(r.cycle_id, r.member_id, r.kind, 0, amt, r.loan_id, r.note, r.meeting_date, r.id);
    end if;
  end if;
  update public.vsla_contributions set status = case when p_approve then 'approved' else 'declined' end,
    approved_amount = case when p_approve then amt else null end, decided_at = now(), decided_by = auth.uid() where id = p_id;
end $$;

-- Approve a loan request, optionally for a different amount.
drop function if exists public.vsla_decide_request(uuid, boolean, date);
create or replace function public.vsla_decide_request(p_request uuid, p_approve boolean, p_due date, p_amount numeric default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.vsla_requests; c public.vsla_cycles; amt numeric;
begin
  select * into r from public.vsla_requests where id = p_request for update;
  if not found then raise exception 'not_found'; end if;
  if not public.vsla_is_admin(r.group_id) then raise exception 'not_admin'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  amt := coalesce(p_amount, r.amount);
  if p_approve then
    if amt <= 0 then raise exception 'bad_amount'; end if;
    select * into c from public.vsla_cycles where id = r.cycle_id;
    if c.status <> 'active' then raise exception 'cycle_closed'; end if;
    insert into public.vsla_loans (cycle_id, group_id, member_id, principal, interest_pct, due_date)
    values (r.cycle_id, r.group_id, r.member_id, amt, c.loan_interest_pct, p_due);
  end if;
  update public.vsla_requests set status = case when p_approve then 'approved' else 'declined' end,
    approved_amount = case when p_approve then amt else null end, decided_at = now(), decided_by = auth.uid() where id = p_request;
end $$;

-- The monthly social fund amount each member is asked to pay (kept apart from savings).
create or replace function public.vsla_set_social(p_cycle uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select group_id into g from public.vsla_cycles where id = p_cycle;
  if g is null then raise exception 'not_found'; end if;
  if not public.vsla_is_admin(g) then raise exception 'not_admin'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'bad_amount'; end if;
  update public.vsla_cycles set social_monthly = p_amount where id = p_cycle;
end $$;

revoke all on function public.vsla_decide_contribution(uuid, boolean, numeric), public.vsla_decide_request(uuid, boolean, date, numeric), public.vsla_set_social(uuid, numeric) from public, anon;
grant execute on function public.vsla_decide_contribution(uuid, boolean, numeric), public.vsla_decide_request(uuid, boolean, date, numeric), public.vsla_set_social(uuid, numeric) to authenticated;
