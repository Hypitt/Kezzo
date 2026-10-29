-- =====================================================================
-- Kezzo update 22: AI translation
--   * translations: saved translations, so the same text is only translated once per language (server only)
--   * post_transcripts: what is said in a free public video or audio post, with times, for subtitles and "Listen"
--   * ai_usage: a small daily limit per person, so nobody can run up the AI bill
-- Run this in the Supabase SQL Editor AFTER the earlier updates. Safe to run more than once.
-- =====================================================================
create table if not exists public.translations (
  h text not null,
  lang text not null check (lang in ('en', 'fr', 'es', 'pt', 'hi')),
  body text not null,
  created_at timestamptz not null default now(),
  primary key (h, lang)
);
alter table public.translations enable row level security;
revoke all on public.translations from anon, authenticated;     -- only the server (service role) reads and writes it

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  n integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Adds p_n to today's count for the person; false when that goes over the daily cap.
create or replace function public.ai_take(p_user uuid, p_n integer, p_cap integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare used integer;
begin
  insert into public.ai_usage (user_id, day, n) values (p_user, current_date, 0) on conflict do nothing;
  update public.ai_usage set n = n + greatest(p_n, 0) where user_id = p_user and day = current_date returning n into used;
  return used <= p_cap;
end; $$;
revoke all on function public.ai_take(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, integer, integer) to service_role;

create table if not exists public.post_transcripts (
  post_id uuid primary key references public.posts (id) on delete cascade,
  lang text not null check (char_length(lang) between 2 and 8),
  segments jsonb not null check (jsonb_typeof(segments) = 'array' and jsonb_array_length(segments) <= 300),
  created_at timestamptz not null default now()
);
alter table public.post_transcripts enable row level security;
revoke all on public.post_transcripts from anon, authenticated;
grant select on public.post_transcripts to authenticated;   -- members only (visitors only see the landing page)
grant insert, update, delete on public.post_transcripts to authenticated;

drop policy if exists transcripts_select on public.post_transcripts;
create policy transcripts_select on public.post_transcripts for select using (
  exists (select 1 from public.posts p where p.id = post_id and p.download_price = 0 and p.media_bucket = 'media-public'));
drop policy if exists transcripts_insert on public.post_transcripts;
create policy transcripts_insert on public.post_transcripts for insert to authenticated with check (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()
          and p.download_price = 0 and p.media_bucket = 'media-public' and p.kind in ('video', 'audio')));
drop policy if exists transcripts_update on public.post_transcripts;
create policy transcripts_update on public.post_transcripts for update to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()))
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()
          and p.download_price = 0 and p.media_bucket = 'media-public' and p.kind in ('video', 'audio')));
drop policy if exists transcripts_delete on public.post_transcripts;
create policy transcripts_delete on public.post_transcripts for delete to authenticated using (
  exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
