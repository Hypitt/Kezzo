-- Kezzo update 46: posts may have no title (the title box is optional; nothing is invented when it is empty).
-- Run once in the Supabase SQL editor. Safe to run again.

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.posts'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%char_length(title)%'
  loop
    execute format('alter table public.posts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.posts add constraint posts_title_len check (char_length(title) <= 120);
