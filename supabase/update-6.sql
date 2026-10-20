-- =====================================================================
-- Kezzo update 6: email notifications for new direct and group messages
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-5. Safe to run more than once.
-- =====================================================================

-- Each person can turn these emails off in their profile settings (or with the link in the email). On by default.
alter table public.profiles add column if not exists email_messages boolean not null default true;
grant update (email_messages) on public.profiles to authenticated;

-- Remembers which emails were sent, to limit them: at most one email every 30 minutes per conversation (direct)
-- or per group. Written only by the server (service role). Nobody can read or write it from the app.
create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete cascade,
  room_id uuid,
  kind text not null,
  sent_at timestamptz not null default now()
);
-- If an earlier version of this file was already run, bring the table up to date
alter table public.email_log add column if not exists room_id uuid;
alter table public.email_log alter column sender_id drop not null;
alter table public.email_log drop constraint if exists email_log_kind_check;
alter table public.email_log add constraint email_log_kind_check check (kind in ('message', 'group'));
create index if not exists email_log_lookup_idx on public.email_log (recipient_id, sender_id, kind, sent_at desc);
create index if not exists email_log_room_idx on public.email_log (room_id, recipient_id, sent_at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
