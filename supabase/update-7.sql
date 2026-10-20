-- =====================================================================
-- Kezzo update 7: the app is for members only. Visitors who are not signed in can no longer read any app data.
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-6. Safe to run more than once.
--
-- The public landing page is plain code with no data behind it, so it keeps working. Everything else (feed, videos,
-- live streams, battles, profiles, groups) now needs a signed-in account, enforced here in the database and not only
-- by the screens. Signed-in people are not affected.
-- =====================================================================
revoke select on all tables in schema public from anon;
alter default privileges in schema public revoke select on tables from anon;
