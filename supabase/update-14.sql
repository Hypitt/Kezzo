-- =====================================================================
-- Kezzo update 14: clean up battles and live streams that nobody joined or that were left open
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-13. Safe to run more than once.
-- (Hosts can also end their own battle or live from the lists; this only tidies rooms that were forgotten.)
-- =====================================================================

-- Anyone signed in can trigger the cleanup (the pages call it when they open); it only touches forgotten rooms:
--   * live streams still marked live after 12 hours
--   * battles still waiting for people (not started) after 12 hours with fewer than 2 competitors: cancelled, entry fees refunded
create or replace function public.close_stale_rooms()
returns void language plpgsql security definer set search_path = public as $$
declare b record; c record;
begin
  if auth.uid() is null then return; end if;

  with ended as (
    update public.live_streams set status = 'ended', ended_at = now()
     where status = 'live' and created_at < now() - interval '12 hours'
    returning id)
  delete from public.live_guests where stream_id in (select id from ended);

  for b in
    select * from public.battles
     where status = 'open' and created_at < now() - interval '12 hours'
       and (select count(*) from public.battle_contenders bc where bc.battle_id = battles.id) < 2
     for update skip locked
  loop
    if b.entry_fee > 0 then
      for c in select bc.user_id from public.battle_contenders bc where bc.battle_id = b.id loop
        perform public.credit_reward(c.user_id, b.entry_fee, 'battle_refund', b.id);
      end loop;
    end if;
    update public.battles set status = 'ended', ended_at = now(), winner_id = null, timer_ends_at = null, prize_pool = 0 where id = b.id;
  end loop;
end $$;
revoke all on function public.close_stale_rooms() from public, anon;
grant execute on function public.close_stale_rooms() to authenticated;
