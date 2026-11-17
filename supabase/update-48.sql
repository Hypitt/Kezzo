-- Kezzo update 48: admins can add co-admins (and the owner can remove them).
-- Run once in the Supabase SQL editor. Safe to run again.
-- The About Us text needs no SQL: admins edit it in Admin > Site > Edit the public homepage.

alter table public.admins add column if not exists added_by uuid references auth.users (id) on delete set null;
alter table public.admins add column if not exists is_owner boolean not null default false;

-- The oldest admin is the owner (only if nobody is marked yet).
update public.admins set is_owner = true
 where user_id = (select user_id from public.admins order by created_at, user_id limit 1)
   and not exists (select 1 from public.admins where is_owner);

create or replace function public.admin_team()
returns table (user_id uuid, display_name text, handle text, avatar_url text, is_owner boolean, added_by_name text, created_at timestamptz, can_remove boolean)
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); me_owner boolean;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select a.is_owner into me_owner from public.admins a where a.user_id = me;
  return query
    select a.user_id, p.display_name, p.handle, p.avatar_url, a.is_owner, b.display_name, a.created_at,
           (a.user_id <> me and not a.is_owner and (coalesce(me_owner, false) or a.added_by = me))
      from public.admins a
      left join public.profiles p on p.id = a.user_id
      left join public.profiles b on b.id = a.added_by
     order by a.is_owner desc, a.created_at;
end; $$;
revoke all on function public.admin_team() from public, anon;
grant execute on function public.admin_team() to authenticated;

-- p_who: the member's e-mail address, or their @handle
create or replace function public.admin_add(p_who text)
returns uuid language plpgsql security definer set search_path = public as $$
declare w text := btrim(coalesce(p_who, '')); uid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if w = '' or length(w) > 120 then raise exception 'not found'; end if;
  if position('@' in w) > 1 then
    select id into uid from auth.users where lower(email) = lower(w) limit 1;
  else
    select id into uid from public.profiles where lower(handle) = lower(regexp_replace(w, '^@', '')) limit 1;
  end if;
  if uid is null then raise exception 'not found'; end if;
  insert into public.admins (user_id, added_by) values (uid, auth.uid()) on conflict (user_id) do nothing;
  perform public.log_admin('admin_add', 'profile', uid, '');
  return uid;
end; $$;
revoke all on function public.admin_add(text) from public, anon;
grant execute on function public.admin_add(text) to authenticated;

create or replace function public.admin_remove(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t record; me_owner boolean;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into t from public.admins where user_id = p_user;
  if not found then return; end if;
  select is_owner into me_owner from public.admins where user_id = me;
  if p_user = me then raise exception 'cannot remove yourself'; end if;
  if t.is_owner then raise exception 'cannot remove the owner'; end if;
  if not (coalesce(me_owner, false) or t.added_by = me) then raise exception 'forbidden'; end if;
  delete from public.admins where user_id = p_user;
  perform public.log_admin('admin_remove', 'profile', p_user, '');
end; $$;
revoke all on function public.admin_remove(uuid) from public, anon;
grant execute on function public.admin_remove(uuid) to authenticated;
