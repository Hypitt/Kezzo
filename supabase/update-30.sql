-- =====================================================================
-- Kezzo update 30: share links made of words only (/s/post/my-dance-battle), no numbers or codes
--   * share_slugs: one readable name per shared item (kept even if the title changes later)
--   * share_slug(): members ask for the name of an item; it is made from the item's own title on the server
--   * share_resolve(): the server finds the item from the name
-- Run in the Supabase SQL Editor AFTER update-29. Safe to run more than once.
-- =====================================================================
create table if not exists public.share_slugs (
  type text not null check (type in ('post','profile','battle','live','group','event','poll','opportunity')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (type, slug),
  unique (type, item_id)
);
alter table public.share_slugs enable row level security;
revoke all on public.share_slugs from anon, authenticated;

create or replace function public.share_slug(p_type text, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare tbl text; col text; title text; base text; cand text; n int := 1; got text;
begin
  if auth.uid() is null then raise exception 'sign in'; end if;
  select slug into got from public.share_slugs where type = p_type and item_id = p_id;
  if got is not null then return got; end if;
  select t, c into tbl, col from (values
    ('post','posts','title'), ('profile','profiles','display_name'), ('battle','battles','title'), ('live','live_streams','title'),
    ('group','groups','name'), ('event','events','title'), ('poll','polls','question'), ('opportunity','opportunities','title')
  ) as m(k, t, c) where k = p_type;
  if tbl is null then raise exception 'bad type'; end if;
  execute format('select %I::text from public.%I where id = $1', col, tbl) into title using p_id;
  if title is null then raise exception 'not found'; end if;
  base := regexp_replace(translate(lower(title), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœ', 'aaaaaaceeeeiiiinooooouuuuyyo'), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  base := trim(both '-' from left(base, 50));
  if base = '' then base := p_type; end if;
  cand := base;
  loop
    insert into public.share_slugs (type, slug, item_id) values (p_type, cand, p_id) on conflict do nothing;
    select slug into got from public.share_slugs where type = p_type and item_id = p_id;
    if got is not null then return got; end if;       -- ours (or created at the same moment by someone else for this item)
    n := n + 1;
    cand := left(base, 50) || '-' || n;
    if n > 500 then raise exception 'no free name'; end if;
  end loop;
end; $$;
revoke all on function public.share_slug(text, uuid) from public, anon;
grant execute on function public.share_slug(text, uuid) to authenticated;

create or replace function public.share_resolve(p_type text, p_slug text)
returns uuid language sql stable security definer set search_path = public as $$
  select item_id from public.share_slugs where type = p_type and slug = lower(p_slug);
$$;
revoke all on function public.share_resolve(text, text) from public, anon, authenticated;
grant execute on function public.share_resolve(text, text) to service_role;
