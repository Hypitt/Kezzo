-- =====================================================================
-- Kezzo update 6: email notifications for new direct messages
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-5. Safe to run more than once.
-- =====================================================================

-- Each person can turn these emails off in their profile settings. On by default.
alter table public.profiles add column if not exists email_messages boolean not null default true;
grant update (email_messages) on public.profiles to authenticated;

-- Remembers which emails were sent, to limit them (at most one per sender and recipient every 30 minutes).
-- Written only by the server (api/notify-message.ts, service role). Nobody can read or write it from the app.
create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('message')),
  sent_at timestamptz not null default now()
);
create index if not exists email_log_lookup_idx on public.email_log (recipient_id, sender_id, kind, sent_at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
