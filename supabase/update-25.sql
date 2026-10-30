-- =====================================================================
-- Kezzo update 25: admins edit the public landing page (texts, pictures, a video, order of sections)
--   * site_content(): anyone can read the saved content
--   * admin_set_content(): admins save it
-- Content shape: {"texts":{"en":{"h1a":"..."}}, "images":{"hero":"https://..."}, "video":{"url":"https://...","poster":"https://..."},
--                 "order":["tagline","video",...]}
-- Run in the Supabase SQL Editor AFTER update-24. Safe to run more than once.
-- =====================================================================
create or replace function public.site_content()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.site_settings where key = 'landing_content'), '{}'::jsonb);
$$;
revoke all on function public.site_content() from public;
grant execute on function public.site_content() to anon, authenticated;

create or replace function public.admin_set_content(p_content jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  k text; v jsonb; u text; clean jsonb := '{}'::jsonb; t jsonb := '{}'::jsonb; l text; lv jsonb; p text; pv jsonb; per jsonb;
  imgs jsonb := '{}'::jsonb; ord jsonb := '[]'::jsonb; vid jsonb := '{}'::jsonb; x jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then raise exception 'bad content'; end if;
  if length(p_content::text) > 120000 then raise exception 'content too large'; end if;

  -- texts: only the five languages, short keys, strings up to 2000 characters
  if jsonb_typeof(p_content->'texts') = 'object' then
    for l, lv in select * from jsonb_each(p_content->'texts') loop
      if l in ('en','fr','es','pt','hi') and jsonb_typeof(lv) = 'object' then
        per := '{}'::jsonb;
        for p, pv in select * from jsonb_each(lv) loop
          if p ~ '^[A-Za-z0-9_.]{1,60}$' and jsonb_typeof(pv) = 'string' and char_length(pv #>> '{}') <= 2000 then
            per := per || jsonb_build_object(p, pv);
          end if;
        end loop;
        t := t || jsonb_build_object(l, per);
      end if;
    end loop;
  end if;

  -- pictures: https only
  if jsonb_typeof(p_content->'images') = 'object' then
    for k, v in select * from jsonb_each(p_content->'images') loop
      u := v #>> '{}';
      if k ~ '^[a-z0-9]{2,20}$' and jsonb_typeof(v) = 'string' and (u ~* '^https://[^[:space:]]+$' and char_length(u) <= 600) then imgs := imgs || jsonb_build_object(k, u); end if;
    end loop;
  end if;

  -- video
  if jsonb_typeof(p_content->'video') = 'object' then
    u := p_content->'video'->>'url';
    if (u ~* '^https://[^[:space:]]+$' and char_length(u) <= 600) then vid := jsonb_build_object('url', u); end if;
    u := p_content->'video'->>'poster';
    if vid <> '{}'::jsonb and (u ~* '^https://[^[:space:]]+$' and char_length(u) <= 600) then vid := vid || jsonb_build_object('poster', u); end if;
  end if;

  -- order of sections
  if jsonb_typeof(p_content->'order') = 'array' then
    for x in select * from jsonb_array_elements(p_content->'order') loop
      if jsonb_typeof(x) = 'string' and (x #>> '{}') ~ '^[a-z]{2,20}$' and not ord @> jsonb_build_array(x) then ord := ord || jsonb_build_array(x); end if;
    end loop;
  end if;

  clean := jsonb_build_object('texts', t, 'images', imgs, 'video', vid, 'order', ord);
  insert into public.site_settings (key, value, updated_at) values ('landing_content', clean, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
end; $$;
revoke all on function public.admin_set_content(jsonb) from public, anon;
grant execute on function public.admin_set_content(jsonb) to authenticated;
