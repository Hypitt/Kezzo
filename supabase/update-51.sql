-- Kezzo update 51: readable share links for shops and listings, and better names for posts without a title.
-- Run once in the Supabase SQL editor, after update-50. Safe to run again.

alter table public.share_slugs drop constraint if exists share_slugs_type_check;
alter table public.share_slugs add constraint share_slugs_type_check
  check (type in ('post','profile','battle','live','group','event','poll','opportunity','shop','listing'));

create or replace function public.share_slug(p_type text, p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare title text; base text; cand text; n int := 1; got text;
begin
  if auth.uid() is null then raise exception 'sign in'; end if;
  select slug into got from public.share_slugs where type = p_type and item_id = p_id;
  if got is not null then return got; end if;

  if p_type = 'post' then
    select coalesce(nullif(trim(p.title), ''), nullif(trim(left(p.body, 50)), ''), pr.handle) into title
      from public.posts p join public.profiles pr on pr.id = p.author_id where p.id = p_id;
  elsif p_type = 'profile' then select handle into title from public.profiles where id = p_id;
  elsif p_type = 'battle' then select b.title into title from public.battles b where b.id = p_id;
  elsif p_type = 'live' then select l.title into title from public.live_streams l where l.id = p_id;
  elsif p_type = 'group' then select g.name into title from public.groups g where g.id = p_id;
  elsif p_type = 'event' then select e.title into title from public.events e where e.id = p_id;
  elsif p_type = 'poll' then select q.question into title from public.polls q where q.id = p_id;
  elsif p_type = 'opportunity' then select o.title into title from public.opportunities o where o.id = p_id;
  elsif p_type = 'listing' then select m.title into title from public.market_listings m where m.id = p_id;
  elsif p_type = 'shop' then
    -- a shop is identified by its owner
    select coalesce(nullif(trim(s.name), ''), pr.handle || ' shop') into title
      from public.profiles pr left join public.market_shops s on s.owner_id = pr.id where pr.id = p_id;
  else raise exception 'bad type';
  end if;
  if title is null then raise exception 'not found'; end if;

  base := regexp_replace(translate(lower(title), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœ', 'aaaaaaceeeeiiiinooooouuuuyyo'), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  base := trim(both '-' from left(base, 50));
  if base = '' then base := p_type; end if;
  cand := base;
  loop
    insert into public.share_slugs (type, slug, item_id) values (p_type, cand, p_id) on conflict do nothing;
    select slug into got from public.share_slugs where type = p_type and item_id = p_id;
    if got is not null then return got; end if;
    n := n + 1;
    cand := left(base, 50) || '-' || n;
    if n > 500 then raise exception 'no free name'; end if;
  end loop;
end; $$;
revoke all on function public.share_slug(text, uuid) from public, anon;
grant execute on function public.share_slug(text, uuid) to authenticated;
