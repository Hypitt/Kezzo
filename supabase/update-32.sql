-- Update 32: battle highlights can be up to 10 minutes (was 90 seconds).
-- Safe to run more than once. Contains no secrets.
create or replace function public.set_battle_highlight(p_battle uuid, p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
declare b public.battles; p public.posts;
begin
  select * into b from public.battles where id = p_battle for update;
  if not found then raise exception 'not_found'; end if;
  if b.host_id is distinct from auth.uid() then raise exception 'not_host'; end if;
  if b.status <> 'ended' then raise exception 'bad_status'; end if;
  if p_post is not null then
    select * into p from public.posts where id = p_post;
    if not found or p.author_id <> b.host_id or p.kind <> 'video' or p.media_bucket is distinct from 'media-public' then
      raise exception 'invalid_highlight';
    end if;
    if p.duration_seconds is null or p.duration_seconds > 600 then raise exception 'highlight_too_long'; end if;
  end if;
  update public.battles set highlight_post_id = p_post where id = p_battle;
end $$;
revoke all on function public.set_battle_highlight(uuid, uuid) from public, anon;
grant execute on function public.set_battle_highlight(uuid, uuid) to authenticated;
