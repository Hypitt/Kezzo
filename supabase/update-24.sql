-- =====================================================================
-- Kezzo update 24: admins choose which sections show on the public landing page and on Home
--   * site_settings: small named settings (only the server functions below read or write it)
--   * site_sections(): anyone can read which sections are switched off
--   * admin_set_sections(): admins save the choice
-- Run this in the Supabase SQL Editor AFTER update-4 (admins). Safe to run more than once.
-- =====================================================================
create table if not exists public.site_settings (
  key text primary key check (char_length(key) <= 40),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
revoke all on public.site_settings from anon, authenticated;

create or replace function public.site_sections()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'landing', coalesce((select value from public.site_settings where key = 'landing_sections'), '{}'::jsonb),
    'home', coalesce((select value from public.site_settings where key = 'home_sections'), '{}'::jsonb));
$$;
revoke all on function public.site_sections() from public;
grant execute on function public.site_sections() to anon, authenticated;

-- p_landing / p_home: objects like {"media": false}. Only true/false values for short names are kept.
create or replace function public.admin_set_sections(p_landing jsonb, p_home jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  k text; v jsonb; l jsonb := '{}'::jsonb; h jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  for k, v in select * from jsonb_each(coalesce(p_landing, '{}'::jsonb)) loop
    if k ~ '^[a-z]{2,20}$' and jsonb_typeof(v) = 'boolean' then l := l || jsonb_build_object(k, v); end if;
  end loop;
  for k, v in select * from jsonb_each(coalesce(p_home, '{}'::jsonb)) loop
    if k ~ '^[a-z]{2,20}$' and jsonb_typeof(v) = 'boolean' then h := h || jsonb_build_object(k, v); end if;
  end loop;
  insert into public.site_settings (key, value, updated_at) values ('landing_sections', l, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.site_settings (key, value, updated_at) values ('home_sections', h, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end; $$;
revoke all on function public.admin_set_sections(jsonb, jsonb) from public, anon;
grant execute on function public.admin_set_sections(jsonb, jsonb) to authenticated;
