-- The order of the homes along a world's street: the creator drags them into place in the World tab.
alter table public.world_members add column if not exists slot int;

create or replace function public.world_arrange(p_world uuid, p_order uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); i int;
begin
  if (select creator from worlds where id = p_world) is distinct from uid then raise exception 'only the world''s creator can arrange the homes'; end if;
  for i in 1 .. coalesce(array_length(p_order, 1), 0) loop
    update world_members set slot = i where world_id = p_world and user_id = p_order[i];
  end loop;
end $$;
revoke execute on function public.world_arrange(uuid, uuid[]) from public, anon;
grant execute on function public.world_arrange(uuid, uuid[]) to authenticated;
