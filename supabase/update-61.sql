-- Kezzo update 61: small fix. Members who left a savings group no longer count toward the plan's member limit.
-- Run once in the Supabase SQL editor, after update-60. Safe to run again. Contains no secrets.
create or replace function public._limit_vsla_members() returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select owner_id into owner from public.vsla_groups where id = new.group_id;
  if (select count(*) from public.vsla_members where group_id = new.group_id and active) >= public.plan_limit(owner, 'vsla_members') then
    raise exception 'plan_limit_vsla_members';
  end if;
  return new;
end; $$;
