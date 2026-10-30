-- =====================================================================
-- Kezzo update 29: short share links (/s/post/3f9a2c1b4d/my-title instead of the 36-character id)
--   * short_id(): finds the item whose id starts with the short code (only the server uses it)
-- Run in the Supabase SQL Editor. Safe to run more than once.
-- =====================================================================
create or replace function public.short_id(p_table text, p_code text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare found uuid[]; 
begin
  if p_table not in ('posts', 'profiles', 'battles', 'live_streams', 'groups', 'events', 'polls', 'opportunities') then return null; end if;
  if p_code !~ '^[0-9a-f]{8,32}$' then return null; end if;
  execute format('select array(select id from public.%I where replace(id::text, ''-'', '''') like $1 || ''%%'' limit 2)', p_table) into found using p_code;
  if array_length(found, 1) = 1 then return found[1]; end if;
  return null;   -- no match, or two items share the start (the full link still works)
end; $$;
revoke all on function public.short_id(text, text) from public, anon, authenticated;
grant execute on function public.short_id(text, text) to service_role;
