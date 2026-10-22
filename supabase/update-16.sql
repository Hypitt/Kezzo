-- =====================================================================
-- Kezzo update 16: Spanish, Portuguese and Hindi
-- Run this in the Supabase SQL Editor. Safe to run more than once.
-- It lets a profile's language be en, fr, es, pt or hi (before, only en and fr were allowed).
-- =====================================================================
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.profiles'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%language%'
  loop
    execute format('alter table public.profiles drop constraint %I', c);
  end loop;
  alter table public.profiles add constraint profiles_language_check check (language in ('en', 'fr', 'es', 'pt', 'hi'));
end $$;
