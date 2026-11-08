-- Update 37: admins choose the colours, fonts and text size of the landing page and the app.
-- Anyone can read the theme; only admins can save it. Safe to run more than once. Contains no secrets.
create or replace function public.site_theme()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.site_settings where key = 'theme'), '{}'::jsonb);
$$;
revoke all on function public.site_theme() from public;
grant execute on function public.site_theme() to anon, authenticated;

create or replace function public.admin_set_theme(p_theme jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  fonts text[] := array['Sora','DM Sans','Inter','Poppins','Montserrat','Nunito','Raleway','Work Sans','Space Grotesk','Playfair Display','Lora','Merriweather'];
  clean jsonb := '{}'::jsonb; k text; v text; n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_theme is null or jsonb_typeof(p_theme) <> 'object' then raise exception 'bad theme'; end if;
  foreach k in array array['accent','ink','soft'] loop
    v := p_theme->>k;
    if v ~ '^#[0-9a-fA-F]{6}$' then clean := clean || jsonb_build_object(k, lower(v)); end if;
  end loop;
  foreach k in array array['headingFont','bodyFont'] loop
    v := p_theme->>k;
    if v = any(fonts) then clean := clean || jsonb_build_object(k, v); end if;
  end loop;
  foreach k in array array['appScale','landingScale'] loop
    if (p_theme->>k) ~ '^[0-9]{2,3}$' then
      n := (p_theme->>k)::int;
      if n between 85 and 125 then clean := clean || jsonb_build_object(k, n); end if;
    end if;
  end loop;
  insert into public.site_settings (key, value, updated_at) values ('theme', clean, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function public.admin_set_theme(jsonb) from public, anon;
grant execute on function public.admin_set_theme(jsonb) to authenticated;
