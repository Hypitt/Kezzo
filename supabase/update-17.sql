-- =====================================================================
-- Kezzo update 17: public media wall on the landing page
--   * landing_media(): a random selection of free, public photos and videos, readable before sign-in
--   * guest likes: visitors can like without an account (counted on the landing page only);
--     when they sign up, claim_guest_likes() turns their likes into real likes
--   * profiles.show_on_home: people can keep their media off the public landing page
-- Run this in the Supabase SQL Editor AFTER schema.sql and update-2 to update-16. Safe to run more than once.
-- =====================================================================

alter table public.profiles add column if not exists show_on_home boolean not null default true;
grant update (show_on_home) on public.profiles to authenticated;

create table if not exists public.post_guest_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, visitor_id)
);
create index if not exists post_guest_likes_visitor_idx on public.post_guest_likes (visitor_id, created_at desc);
alter table public.post_guest_likes enable row level security;
revoke all on public.post_guest_likes from anon, authenticated;   -- only the functions below touch it

-- Random free public photos and videos for the landing page (no sign-in needed)
create or replace function public.landing_media(p_limit integer default 12)
returns table (
  id uuid, kind text, title text, media_path text, author_name text, author_avatar text,
  likes integer, comments integer, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select p.id, p.kind, p.title, p.media_path, a.display_name, a.avatar_url,
         ((select count(*) from public.post_likes l where l.post_id = p.id)
          + (select count(*) from public.post_guest_likes g where g.post_id = p.id))::int,
         (select count(*) from public.post_comments c where c.post_id = p.id)::int,
         p.created_at
    from public.posts p
    join public.profiles a on a.id = p.author_id
   where p.kind in ('photo', 'video')
     and p.media_bucket = 'media-public'
     and p.download_price = 0
     and p.media_path is not null
     and a.show_on_home
   order by random()
   limit least(greatest(coalesce(p_limit, 12), 1), 24);
$$;
revoke all on function public.landing_media(integer) from public;
grant execute on function public.landing_media(integer) to anon, authenticated;

-- A visitor likes (or un-likes) a public post. Returns that post's new like total.
-- Limits: free public photos/videos only, and at most 60 changes per visitor per hour.
create or replace function public.guest_like(p_post uuid, p_visitor uuid, p_like boolean default true)
returns integer language plpgsql security definer set search_path = public as $$
declare total integer;
begin
  if p_post is null or p_visitor is null then raise exception 'invalid'; end if;
  if not exists (select 1 from public.posts p join public.profiles a on a.id = p.author_id
                  where p.id = p_post and p.media_bucket = 'media-public' and p.download_price = 0 and a.show_on_home) then
    raise exception 'not_found';
  end if;
  if (select count(*) from public.post_guest_likes where visitor_id = p_visitor and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'rate_limited';
  end if;
  if p_like then
    insert into public.post_guest_likes (post_id, visitor_id) values (p_post, p_visitor) on conflict do nothing;
  else
    delete from public.post_guest_likes where post_id = p_post and visitor_id = p_visitor;
  end if;
  select ((select count(*) from public.post_likes where post_id = p_post)
        + (select count(*) from public.post_guest_likes where post_id = p_post))::int into total;
  return total;
end; $$;
revoke all on function public.guest_like(uuid, uuid, boolean) from public;
grant execute on function public.guest_like(uuid, uuid, boolean) to anon, authenticated;

-- After sign-up or sign-in: the likes this browser gave as a visitor become real likes of the account.
create or replace function public.claim_guest_likes(p_visitor uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n integer;
begin
  if me is null or p_visitor is null then return 0; end if;
  if not exists (select 1 from public.profiles where id = me) then return 0; end if;
  insert into public.post_likes (post_id, user_id)
  select g.post_id, me from public.post_guest_likes g where g.visitor_id = p_visitor
  on conflict do nothing;
  get diagnostics n = row_count;
  delete from public.post_guest_likes where visitor_id = p_visitor;
  return n;
end; $$;
revoke all on function public.claim_guest_likes(uuid) from public, anon;
grant execute on function public.claim_guest_likes(uuid) to authenticated;
