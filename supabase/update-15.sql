-- =====================================================================
-- Kezzo update 15: put the battle functions back to their latest version
-- Run this in the Supabase SQL Editor. Safe to run more than once.
-- Why: if schema.sql was run again after update-2.sql, it put the OLD battle functions back
-- (for example "Cancel battle" then fails with "That is not possible in this battle's current state").
-- This re-applies the current versions: create / join / start / next round / vote / end (or cancel and refund) a battle.
-- =====================================================================

create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id, role) values (new.id, new.owner_id, 'owner');
  insert into public.group_invites (group_id) values (new.id);
  return new;
end $$;

create or replace function public.create_battle(
  p_title text, p_category text, p_custom_theme text, p_mode text,
  p_topic text, p_rounds int, p_max int, p_fee int,
  p_host_competes boolean default true, p_public_weight int default 100, p_round_seconds int default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bid uuid;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_authenticated';
  end if;
  if p_public_weight < 0 or p_public_weight > 100 then raise exception 'invalid_weight'; end if;
  if p_round_seconds <> 0 and (p_round_seconds < 15 or p_round_seconds > 3600) then raise exception 'invalid_timer'; end if;
  insert into public.battles (host_id, title, category, custom_theme, mode, topic, total_rounds, max_contenders,
                              entry_fee, host_competes, public_weight, round_seconds)
  values (uid, btrim(p_title), p_category, nullif(btrim(coalesce(p_custom_theme, '')), ''),
          p_mode, btrim(coalesce(p_topic, '')), p_rounds, p_max, p_fee,
          coalesce(p_host_competes, true), p_public_weight, p_round_seconds)
  returning id into bid;
  if coalesce(p_host_competes, true) then
    perform public.spend_voting(uid, p_fee, 'battle_entry', bid);
    update public.battles set prize_pool = p_fee where id = bid;
    insert into public.battle_contenders (battle_id, user_id) values (bid, uid);
  end if;
  return bid;
end $$;

create or replace function public.join_battle(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles; n int;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_authenticated';
  end if;
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.status = 'ended' then raise exception 'bad_status'; end if;
  if uid = b.host_id and not b.host_competes then raise exception 'host_only'; end if;
  if exists (select 1 from public.battle_judges where battle_id = p_battle and user_id = uid) then
    raise exception 'judge_cannot_compete';
  end if;
  if exists (select 1 from public.battle_contenders where battle_id = p_battle and user_id = uid) then
    raise exception 'already_joined';
  end if;
  select count(*) into n from public.battle_contenders where battle_id = p_battle;
  if n >= b.max_contenders then raise exception 'battle_full'; end if;
  perform public.spend_voting(uid, b.entry_fee, 'battle_entry', p_battle);
  update public.battles set prize_pool = prize_pool + b.entry_fee where id = p_battle;
  insert into public.battle_contenders (battle_id, user_id) values (p_battle, uid);
end $$;

create or replace function public.next_round(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status <> 'live' then raise exception 'bad_status'; end if;
  if b.current_round >= b.total_rounds then raise exception 'last_round'; end if;
  update public.battles
     set current_round = current_round + 1,
         timer_ends_at = case when round_seconds > 0 then now() + make_interval(secs => round_seconds) else null end
   where id = p_battle;
end $$;

-- Starting a battle also starts the round timer when the host chose one.
create or replace function public.start_battle(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles; n int;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status <> 'open' then raise exception 'bad_status'; end if;
  select count(*) into n from public.battle_contenders where battle_id = p_battle;
  if n < 2 then raise exception 'not_enough_contenders'; end if;
  update public.battles
     set status = 'live', started_at = now(),
         timer_ends_at = case when round_seconds > 0 then now() + make_interval(secs => round_seconds) else null end
   where id = p_battle;
end $$;

-- 2-coin or 5-coin vote for one competitor.
create or replace function public.cast_vote(p_battle uuid, p_contender uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_authenticated';
  end if;
  if p_amount not in (2, 5) then raise exception 'invalid_vote'; end if;
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.status <> 'live' then raise exception 'not_live'; end if;
  if p_contender = uid then raise exception 'cannot_vote_self'; end if;
  if exists (select 1 from public.battle_judges where battle_id = p_battle and user_id = uid) then
    raise exception 'judge_cannot_vote';
  end if;
  if not exists (select 1 from public.battle_contenders where battle_id = p_battle and user_id = p_contender) then
    raise exception 'invalid_vote';
  end if;
  perform public.spend_voting(uid, p_amount, 'vote', p_battle);
  update public.battles set prize_pool = prize_pool + p_amount where id = p_battle;
  update public.battle_contenders set score = score + p_amount where battle_id = p_battle and user_id = p_contender;
  insert into public.battle_votes (battle_id, voter_id, contender_id, amount) values (p_battle, uid, p_contender, p_amount);
end $$;

-- Ends a live battle and pays out exactly once (status guard + row lock).
-- 20% of the pool goes to the host; 80% is shared by competitors in proportion to their FINAL score
-- (equally if nobody scored). Rounding dust goes to the host. Winner = unique top final score.
create or replace function public.end_battle(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b public.battles;
  total numeric; n int; remaining int; host_cut int; paid int := 0; share int;
  top numeric; ties int; winner uuid;
  c record;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status = 'ended' then raise exception 'bad_status'; end if;

  -- Cancelled before it started: give every entry fee back, nobody wins.
  if b.status = 'open' then
    if b.entry_fee > 0 then
      for c in select bc.user_id from public.battle_contenders bc where bc.battle_id = p_battle loop
        perform public.credit_reward(c.user_id, b.entry_fee, 'battle_refund', p_battle);
      end loop;
    end if;
    update public.battles set status = 'ended', ended_at = now(), winner_id = null, timer_ends_at = null, prize_pool = 0 where id = p_battle;
    return;
  end if;

  host_cut := floor(b.prize_pool * 0.2);
  remaining := b.prize_pool - host_cut;
  select coalesce(sum(s.final_pct), 0), count(*) into total, n from public.battle_standings(p_battle) s;

  for c in select s.user_id, s.final_pct from public.battle_standings(p_battle) s loop
    if total > 0 then
      share := floor(remaining::numeric * c.final_pct / total);
    else
      share := floor(remaining::numeric / n);
    end if;
    perform public.credit_reward(c.user_id, share, 'battle_prize', p_battle);
    paid := paid + share;
  end loop;
  perform public.credit_reward(b.host_id, host_cut + (remaining - paid), 'host_cut', p_battle);

  select max(s.final_pct) into top from public.battle_standings(p_battle) s;
  select count(*) into ties from public.battle_standings(p_battle) s where s.final_pct = top;
  if top > 0 and ties = 1 then
    select s.user_id into winner from public.battle_standings(p_battle) s where s.final_pct = top;
  end if;
  update public.battles set status = 'ended', ended_at = now(), winner_id = winner, timer_ends_at = null where id = p_battle;
end $$;
