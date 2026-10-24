-- Tighten two things the security advisor flagged:
--  * is_blocked_between(x, y) let any signed-in player ask about any two players. Policies now use
--    blocked_with(other), which only answers for the caller; the two-player version stays internal.
--  * me() gets a fixed search_path.

create or replace function public.me() returns uuid
language plpgsql stable set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return auth.uid();
end $$;

create or replace function public.blocked_with(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker = auth.uid() and blocked = other) or (blocker = other and blocked = auth.uid()))
$$;
revoke execute on function public.blocked_with(uuid) from public, anon;
grant execute on function public.blocked_with(uuid) to authenticated;

drop policy "messages I can see" on public.messages;
create policy "messages I can see" on public.messages for select to authenticated using (
  ((world_id is not null and public.is_member(world_id)) or (select auth.uid()) in (from_user, to_user))
  and not public.blocked_with(from_user));

revoke execute on function public.is_blocked_between(uuid, uuid) from authenticated;
