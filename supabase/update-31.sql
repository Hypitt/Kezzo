-- Update 31: cover picture on profiles.
-- Run once in the Supabase SQL editor (safe to run again).
alter table public.profiles add column if not exists cover_url text;
grant update (cover_url) on public.profiles to authenticated;
