-- Kezzo update 59: live room limits from the plan (rooms per month and maximum minutes).
-- Run once in the Supabase SQL editor, after update-58. Safe to run again. Contains no secrets.

alter table public.live_streams add column if not exists ends_at timestamptz;

create or replace function public.start_live(p_title text, p_kind text, p_mode text, p_max_guests int)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sid uuid; guests int; mins int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where id = uid) then raise exception 'no_profile'; end if;
  if p_kind not in ('solo', 'group') or p_mode not in ('video', 'audio') then raise exception 'invalid_live'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 100 then raise exception 'invalid_live'; end if;
  -- Plan limit: live rooms created this month.
  if (select count(*) from public.live_streams where host_id = uid and created_at >= date_trunc('month', now())) >= public.plan_limit(uid, 'live_rooms_month') then
    raise exception 'plan_limit_live_rooms';
  end if;
  mins := greatest(public.plan_limit(uid, 'live_minutes'), 1);
  guests := case when p_kind = 'solo' then 0 else greatest(1, least(coalesce(p_max_guests, 4), 8)) end;
  -- One live stream per host at a time.
  update public.live_streams set status = 'ended', ended_at = now() where host_id = uid and status = 'live';
  insert into public.live_streams (host_id, title, kind, mode, max_guests, ends_at)
  values (uid, btrim(p_title), p_kind, p_mode, guests, now() + make_interval(mins => mins)) returning id into sid;
  return sid;
end $$;
revoke all on function public.start_live(text, text, text, int) from public, anon;
grant execute on function public.start_live(text, text, text, int) to authenticated;
