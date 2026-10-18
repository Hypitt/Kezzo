-- =====================================================================
-- Kezzo database schema (Supabase / PostgreSQL)
-- Run the whole file once in: Supabase Dashboard > SQL Editor > New query.
-- It is safe to re-run (idempotent).
--
-- Security model
--   * Every table has Row Level Security (RLS) enabled.
--   * Coins, battles, votes and unlocks can ONLY be changed through the
--     SECURITY DEFINER functions below. Clients cannot write to those
--     tables directly, so balances cannot be edited from the browser.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 280),
  generation text check (generation in ('Gen Z', 'Millennial', 'Other')),
  status_text text check (char_length(status_text) <= 80),
  status_expires_at timestamptz,
  language text not null default 'en' check (language in ('en', 'fr')),
  dm_policy text not null default 'everyone' check (dm_policy in ('everyone', 'followers', 'nobody')),
  terms_accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Wallet (virtual coins only: no cash value, no purchases)
-- ---------------------------------------------------------------------
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  voting_coins int not null default 100 check (voting_coins >= 0),
  reward_coins int not null default 0 check (reward_coins >= 0),
  last_claim_month date not null default ((date_trunc('month', now() at time zone 'utc'))::date)
);

create table if not exists public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta int not null,
  balance_type text not null check (balance_type in ('voting', 'reward')),
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists coin_ledger_user_idx on public.coin_ledger (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Posts, likes, comments, follows, unlocks, blocks, reports
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('text', 'photo', 'audio', 'video')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  media_bucket text check (media_bucket in ('media-public', 'media-paid')),
  media_path text,
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  download_price int not null default 0 check (download_price between 0 and 100),
  created_at timestamptz not null default now(),
  check ((kind = 'text') = (media_path is null)),
  check (media_path is null or media_path like author_id::text || '/%'),
  check ((download_price = 0) = (media_bucket is distinct from 'media-paid')),
  check (kind <> 'video' or (duration_seconds is not null and duration_seconds <= 90))
);
create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id);

create table if not exists public.post_unlocks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'profile', 'battle', 'group', 'message')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'sexual', 'violence', 'other')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Battles
-- ---------------------------------------------------------------------
create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  category text not null check (category in ('roasting', 'dance', 'singing', 'debate', 'comedy', 'genz_vs_millennial', 'clout', 'custom')),
  custom_theme text check (char_length(custom_theme) <= 60),
  mode text not null check (mode in ('video', 'audio')),
  topic text not null default '' check (char_length(topic) <= 200),
  total_rounds int not null default 3 check (total_rounds between 1 and 5),
  current_round int not null default 1 check (current_round >= 1),
  max_contenders int not null default 2 check (max_contenders between 2 and 5),
  entry_fee int not null default 0 check (entry_fee between 0 and 100),
  prize_pool int not null default 0 check (prize_pool >= 0),
  status text not null default 'open' check (status in ('open', 'live', 'ended')),
  winner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz
);
create index if not exists battles_status_idx on public.battles (status, created_at desc);

create table if not exists public.battle_contenders (
  battle_id uuid not null references public.battles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  score int not null default 0 check (score >= 0),
  joined_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);
create index if not exists battle_contenders_user_idx on public.battle_contenders (user_id);
alter table public.battle_contenders replica identity full;

create table if not exists public.battle_votes (
  id bigint generated always as identity primary key,
  battle_id uuid not null references public.battles (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  contender_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null check (amount in (1, 5, 10)),
  created_at timestamptz not null default now()
);
create index if not exists battle_votes_battle_idx on public.battle_votes (battle_id);

create table if not exists public.ai_verdicts (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  winner_id uuid references public.profiles (id) on delete set null,
  verdict text not null,
  highlights jsonb not null default '[]'::jsonb,
  language text not null default 'en',
  created_at timestamptz not null default now()
);
create index if not exists ai_verdicts_battle_idx on public.ai_verdicts (battle_id, created_at desc);

-- ---------------------------------------------------------------------
-- Squads (groups), chat and direct messages
-- ---------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  tagline text not null default '' check (char_length(tagline) <= 100),
  category text not null default 'dance' check (category in ('dance', 'roasting', 'singing', 'debate', 'comedy', 'other')),
  member_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_type text not null check (room_type in ('battle', 'group')),
  room_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists chat_room_idx on public.chat_messages (room_type, room_id, created_at desc);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create index if not exists dm_recipient_idx on public.direct_messages (recipient_id, created_at desc);
create index if not exists dm_sender_idx on public.direct_messages (sender_id, created_at desc);

-- ---------------------------------------------------------------------
-- Helper functions (not callable by clients)
-- ---------------------------------------------------------------------
create or replace function public.spend_voting(p_user uuid, p_amount int, p_reason text, p_ref uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then return; end if;
  update public.wallets set voting_coins = voting_coins - p_amount
   where user_id = p_user and voting_coins >= p_amount;
  if not found then raise exception 'insufficient_coins'; end if;
  insert into public.coin_ledger (user_id, delta, balance_type, reason, ref_id)
  values (p_user, -p_amount, 'voting', p_reason, p_ref);
end $$;

create or replace function public.credit_reward(p_user uuid, p_amount int, p_reason text, p_ref uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then return; end if;
  update public.wallets set reward_coins = reward_coins + p_amount where user_id = p_user;
  insert into public.coin_ledger (user_id, delta, balance_type, reason, ref_id)
  values (p_user, p_amount, 'reward', p_reason, p_ref);
end $$;

create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid());
$$;

create or replace function public.can_dm(p_sender uuid, p_recipient uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_sender <> p_recipient
    and not exists (
      select 1 from public.blocks b
       where (b.blocker_id = p_recipient and b.blocked_id = p_sender)
          or (b.blocker_id = p_sender and b.blocked_id = p_recipient))
    and exists (
      select 1 from public.profiles r
       where r.id = p_recipient
         and (r.dm_policy = 'everyone'
              or (r.dm_policy = 'followers' and exists (
                    select 1 from public.follows f
                     where f.follower_id = p_sender and f.followee_id = p_recipient))));
$$;

-- ---------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallets (user_id) values (new.id);
  insert into public.coin_ledger (user_id, delta, balance_type, reason) values (new.id, 100, 'voting', 'welcome');
  return new;
end $$;
drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created after insert on public.profiles
  for each row execute function public.handle_new_profile();

create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members (group_id, user_id) values (new.id, new.owner_id);
  return new;
end $$;
drop trigger if exists on_group_created on public.groups;
create trigger on_group_created after insert on public.groups
  for each row execute function public.handle_new_group();

create or replace function public.sync_group_member_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.groups set member_count = member_count + 1 where id = new.group_id;
  else
    update public.groups set member_count = greatest(member_count - 1, 0) where id = old.group_id;
  end if;
  return null;
end $$;
drop trigger if exists on_group_member_change on public.group_members;
create trigger on_group_member_change after insert or delete on public.group_members
  for each row execute function public.sync_group_member_count();

-- ---------------------------------------------------------------------
-- Public RPC functions (the only way to change coins, battles, unlocks)
-- ---------------------------------------------------------------------
create or replace function public.claim_monthly_coins()
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  this_month date := (date_trunc('month', now() at time zone 'utc'))::date;
  w public.wallets;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into w from public.wallets where user_id = uid for update;
  if not found then raise exception 'not_authenticated'; end if;
  if w.last_claim_month >= this_month then raise exception 'already_claimed'; end if;
  update public.wallets set voting_coins = voting_coins + 100, last_claim_month = this_month where user_id = uid;
  insert into public.coin_ledger (user_id, delta, balance_type, reason) values (uid, 100, 'voting', 'monthly');
  return w.voting_coins + 100;
end $$;

create or replace function public.unlock_post(p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.posts;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into p from public.posts where id = p_post;
  if not found then raise exception 'not_found'; end if;
  if p.download_price <= 0 then raise exception 'not_paid'; end if;
  if p.author_id = uid then raise exception 'own_post'; end if;
  if exists (select 1 from public.post_unlocks where user_id = uid and post_id = p_post) then
    raise exception 'already_unlocked';
  end if;
  perform public.spend_voting(uid, p.download_price, 'unlock', p_post);
  perform public.credit_reward(p.author_id, p.download_price, 'sale', p_post);
  insert into public.post_unlocks (user_id, post_id) values (uid, p_post);
end $$;

create or replace function public.create_battle(
  p_title text, p_category text, p_custom_theme text, p_mode text,
  p_topic text, p_rounds int, p_max int, p_fee int)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); bid uuid;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_authenticated';
  end if;
  insert into public.battles (host_id, title, category, custom_theme, mode, topic, total_rounds, max_contenders, entry_fee)
  values (uid, btrim(p_title), p_category, nullif(btrim(coalesce(p_custom_theme, '')), ''),
          p_mode, btrim(coalesce(p_topic, '')), p_rounds, p_max, p_fee)
  returning id into bid;
  perform public.spend_voting(uid, p_fee, 'battle_entry', bid);
  update public.battles set prize_pool = p_fee where id = bid;
  insert into public.battle_contenders (battle_id, user_id) values (bid, uid);
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
  if exists (select 1 from public.battle_contenders where battle_id = p_battle and user_id = uid) then
    raise exception 'already_joined';
  end if;
  select count(*) into n from public.battle_contenders where battle_id = p_battle;
  if n >= b.max_contenders then raise exception 'battle_full'; end if;
  perform public.spend_voting(uid, b.entry_fee, 'battle_entry', p_battle);
  update public.battles set prize_pool = prize_pool + b.entry_fee where id = p_battle;
  insert into public.battle_contenders (battle_id, user_id) values (p_battle, uid);
end $$;

create or replace function public.leave_battle(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.status = 'ended' then raise exception 'bad_status'; end if;
  if b.host_id = uid then raise exception 'host_cannot_leave'; end if;
  delete from public.battle_contenders where battle_id = p_battle and user_id = uid;
end $$;

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
  update public.battles set status = 'live', started_at = now() where id = p_battle;
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
  update public.battles set current_round = current_round + 1 where id = p_battle;
end $$;

create or replace function public.cast_vote(p_battle uuid, p_contender uuid, p_amount int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b public.battles;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid) then
    raise exception 'not_authenticated';
  end if;
  if p_amount not in (1, 5, 10) then raise exception 'invalid_vote'; end if;
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.status <> 'live' then raise exception 'not_live'; end if;
  if p_contender = uid then raise exception 'cannot_vote_self'; end if;
  if not exists (select 1 from public.battle_contenders where battle_id = p_battle and user_id = p_contender) then
    raise exception 'invalid_vote';
  end if;
  perform public.spend_voting(uid, p_amount, 'vote', p_battle);
  update public.battles set prize_pool = prize_pool + p_amount where id = p_battle;
  update public.battle_contenders set score = score + p_amount where battle_id = p_battle and user_id = p_contender;
  insert into public.battle_votes (battle_id, voter_id, contender_id, amount) values (p_battle, uid, p_contender, p_amount);
end $$;

-- Ends a live battle and pays out exactly once (status guard + row lock).
-- 20% of the pool goes to the host, 80% is shared by contenders in
-- proportion to their votes (equally if nobody voted). Rounding dust goes to the host.
create or replace function public.end_battle(p_battle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b public.battles;
  total int; n int; remaining int; host_cut int; paid int := 0; share int;
  top int; ties int; winner uuid;
  c record;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from uid then raise exception 'not_host'; end if;
  if b.status <> 'live' then raise exception 'bad_status'; end if;

  host_cut := floor(b.prize_pool * 0.2);
  remaining := b.prize_pool - host_cut;
  select coalesce(sum(score), 0), count(*) into total, n
    from public.battle_contenders where battle_id = p_battle;

  for c in select user_id, score from public.battle_contenders where battle_id = p_battle loop
    if total > 0 then
      share := floor(remaining::numeric * c.score / total);
    else
      share := floor(remaining::numeric / n);
    end if;
    perform public.credit_reward(c.user_id, share, 'battle_prize', p_battle);
    paid := paid + share;
  end loop;
  perform public.credit_reward(b.host_id, host_cut + (remaining - paid), 'host_cut', p_battle);

  select max(score) into top from public.battle_contenders where battle_id = p_battle;
  select count(*) into ties from public.battle_contenders where battle_id = p_battle and score = top;
  if top > 0 and ties = 1 then
    select user_id into winner from public.battle_contenders where battle_id = p_battle and score = top;
  end if;
  update public.battles set status = 'ended', ended_at = now(), winner_id = winner where id = p_battle;
end $$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ---------------------------------------------------------------------
-- Function permissions
-- ---------------------------------------------------------------------
revoke all on function public.spend_voting(uuid, int, text, uuid) from public, anon, authenticated;
revoke all on function public.credit_reward(uuid, int, text, uuid) from public, anon, authenticated;
revoke all on function public.handle_new_profile() from public, anon, authenticated;
revoke all on function public.handle_new_group() from public, anon, authenticated;
revoke all on function public.sync_group_member_count() from public, anon, authenticated;

revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.can_dm(uuid, uuid) from public, anon;
revoke all on function public.claim_monthly_coins() from public, anon;
revoke all on function public.unlock_post(uuid) from public, anon;
revoke all on function public.create_battle(text, text, text, text, text, int, int, int) from public, anon;
revoke all on function public.join_battle(uuid) from public, anon;
revoke all on function public.leave_battle(uuid) from public, anon;
revoke all on function public.start_battle(uuid) from public, anon;
revoke all on function public.next_round(uuid) from public, anon;
revoke all on function public.cast_vote(uuid, uuid, int) from public, anon;
revoke all on function public.end_battle(uuid) from public, anon;
revoke all on function public.delete_my_account() from public, anon;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.can_dm(uuid, uuid) to authenticated, service_role;
grant execute on function public.claim_monthly_coins() to authenticated;
grant execute on function public.unlock_post(uuid) to authenticated;
grant execute on function public.create_battle(text, text, text, text, text, int, int, int) to authenticated;
grant execute on function public.join_battle(uuid) to authenticated;
grant execute on function public.leave_battle(uuid) to authenticated;
grant execute on function public.start_battle(uuid) to authenticated;
grant execute on function public.next_round(uuid) to authenticated;
grant execute on function public.cast_vote(uuid, uuid, int) to authenticated;
grant execute on function public.end_battle(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.follows enable row level security;
alter table public.post_unlocks enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.battles enable row level security;
alter table public.battle_contenders enable row level security;
alter table public.battle_votes enable row level security;
alter table public.ai_verdicts enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.chat_messages enable row level security;
alter table public.direct_messages enable row level security;

-- Table privileges (defense in depth on top of RLS)
revoke insert, update, delete on public.wallets, public.coin_ledger, public.post_unlocks,
  public.battles, public.battle_contenders, public.battle_votes, public.ai_verdicts
  from anon, authenticated;
revoke select on public.reports from anon, authenticated;
revoke insert, update, delete on public.profiles, public.posts, public.post_likes, public.post_comments,
  public.follows, public.blocks, public.reports, public.groups, public.group_members,
  public.chat_messages, public.direct_messages from anon;
revoke select on public.wallets, public.coin_ledger, public.post_unlocks, public.blocks,
  public.chat_messages, public.direct_messages from anon;

-- Column-level update limits
revoke update on public.profiles from authenticated;
grant update (handle, display_name, avatar_url, bio, generation, status_text, status_expires_at, language, dm_policy)
  on public.profiles to authenticated;
revoke update on public.posts from authenticated;
grant update (title, body) on public.posts to authenticated;
revoke update on public.direct_messages from authenticated;
grant update (read_at) on public.direct_messages to authenticated;
revoke update on public.groups from authenticated;
grant update (name, tagline, category) on public.groups to authenticated;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- wallets and ledger: owner can read, nobody can write directly
drop policy if exists wallets_select on public.wallets;
create policy wallets_select on public.wallets for select to authenticated using (user_id = auth.uid());
drop policy if exists ledger_select on public.coin_ledger;
create policy ledger_select on public.coin_ledger for select to authenticated using (user_id = auth.uid());

-- posts
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select using (true);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid());

-- likes
drop policy if exists likes_select on public.post_likes;
create policy likes_select on public.post_likes for select using (true);
drop policy if exists likes_insert on public.post_likes;
create policy likes_insert on public.post_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists likes_delete on public.post_likes;
create policy likes_delete on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- comments
drop policy if exists comments_select on public.post_comments;
create policy comments_select on public.post_comments for select using (true);
drop policy if exists comments_insert on public.post_comments;
create policy comments_insert on public.post_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists comments_delete on public.post_comments;
create policy comments_delete on public.post_comments for delete to authenticated using (
  author_id = auth.uid()
  or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

-- follows
drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select using (true);
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete to authenticated using (follower_id = auth.uid());

-- unlocks (read own only; rows are created by unlock_post)
drop policy if exists unlocks_select on public.post_unlocks;
create policy unlocks_select on public.post_unlocks for select to authenticated using (user_id = auth.uid());

-- blocks
drop policy if exists blocks_select on public.blocks;
create policy blocks_select on public.blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists blocks_insert on public.blocks;
create policy blocks_insert on public.blocks for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists blocks_delete on public.blocks;
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = auth.uid());

-- reports (write-only for users; read them in the Supabase dashboard)
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());

-- battles (read-only for clients; changes go through RPC functions)
drop policy if exists battles_select on public.battles;
create policy battles_select on public.battles for select using (true);
drop policy if exists contenders_select on public.battle_contenders;
create policy contenders_select on public.battle_contenders for select using (true);
drop policy if exists votes_select on public.battle_votes;
create policy votes_select on public.battle_votes for select using (true);
drop policy if exists verdicts_select on public.ai_verdicts;
create policy verdicts_select on public.ai_verdicts for select using (true);

-- groups
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select using (true);
drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups for delete to authenticated using (owner_id = auth.uid());

drop policy if exists members_select on public.group_members;
create policy members_select on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id));
drop policy if exists members_insert on public.group_members;
create policy members_insert on public.group_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists members_delete on public.group_members;
create policy members_delete on public.group_members for delete to authenticated using (
  user_id = auth.uid()
  and not exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));

-- chat
drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages for select to authenticated
  using (room_type = 'battle' or (room_type = 'group' and public.is_group_member(room_id)));
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert to authenticated with check (
  author_id = auth.uid()
  and ((room_type = 'battle' and exists (select 1 from public.battles b where b.id = room_id and b.status <> 'ended'))
       or (room_type = 'group' and public.is_group_member(room_id))));
drop policy if exists chat_delete on public.chat_messages;
create policy chat_delete on public.chat_messages for delete to authenticated using (author_id = auth.uid());

-- direct messages
drop policy if exists dm_select on public.direct_messages;
create policy dm_select on public.direct_messages for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists dm_insert on public.direct_messages;
create policy dm_insert on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_dm(sender_id, recipient_id));
drop policy if exists dm_update on public.direct_messages;
create policy dm_update on public.direct_messages for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---------------------------------------------------------------------
-- Storage buckets and policies
--   avatars       public, 2 MB images
--   media-public  public, 50 MB (free posts)
--   media-paid    PRIVATE, 50 MB (readable only by owner or buyers)
-- Files must live under a folder named after the uploader's user id.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('media-public', 'media-public', true, 52428800,
     array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('media-paid', 'media-paid', false, 52428800,
     array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "kezzo_storage_insert" on storage.objects;
create policy "kezzo_storage_insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'media-public', 'media-paid')
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kezzo_storage_delete" on storage.objects;
create policy "kezzo_storage_delete" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'media-public', 'media-paid')
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kezzo_storage_select_own" on storage.objects;
create policy "kezzo_storage_select_own" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'media-public', 'media-paid')
         and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "kezzo_storage_select_unlocked" on storage.objects;
create policy "kezzo_storage_select_unlocked" on storage.objects for select to authenticated
  using (bucket_id = 'media-paid'
         and exists (
           select 1 from public.post_unlocks u
             join public.posts p on p.id = u.post_id
            where u.user_id = auth.uid()
              and p.media_bucket = 'media-paid'
              and p.media_path = storage.objects.name));

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['chat_messages', 'direct_messages', 'battles', 'battle_contenders', 'ai_verdicts'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
