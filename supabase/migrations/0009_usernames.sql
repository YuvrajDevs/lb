-- Usernames: players choose their own (3 to 16 of a-z, 0-9 and _), unique, instead of an automatic name#1234.
-- The column is still called tag; friends find each other by it.

create or replace function public.tag_available(p_tag text) returns boolean
language sql stable security definer set search_path = public as $$
  select lower(trim(p_tag)) ~ '^[a-z0-9_]{3,16}$'
    and not exists (select 1 from profiles where tag = lower(trim(p_tag)) and id <> auth.uid())
$$;

create or replace function public.set_tag(p_tag text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); t text := lower(trim(p_tag));
begin
  if t !~ '^[a-z0-9_]{3,16}$' then raise exception 'a username is 3 to 16 letters, numbers or _'; end if;
  if exists (select 1 from profiles where tag = t and id <> uid) then raise exception 'that username is taken'; end if;
  update profiles set tag = t where id = uid;
  return t;
end $$;

revoke execute on function public.tag_available(text), public.set_tag(text) from public, anon;
grant execute on function public.tag_available(text), public.set_tag(text) to authenticated;
