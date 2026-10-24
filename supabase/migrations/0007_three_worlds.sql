-- You can be in three worlds: your own and two friends'.
create or replace function public.world_join(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); w worlds; inv world_invites;
begin
  select * into inv from world_invites where code = upper(trim(p_code)) and expires_at > now();
  if not found then raise exception 'that invite has expired'; end if;
  select * into w from worlds where id = inv.world_id for update;
  if exists (select 1 from world_members where world_id = w.id and user_id = uid) then return w.id; end if;
  if (select count(*) from world_members where user_id = uid) >= 3 then raise exception 'you can be in three worlds at most: leave one first'; end if;
  if (select count(*) from world_members where world_id = w.id) >= w.slots then raise exception 'that world is full'; end if;
  if exists (select 1 from world_members m where m.world_id = w.id and is_blocked_between(uid, m.user_id)) then raise exception 'cannot join this world'; end if;
  insert into world_members (world_id, user_id) values (w.id, uid);
  return w.id;
end $$;

create or replace function public.world_create(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); w uuid;
begin
  if (select count(*) from world_members where user_id = uid) >= 3 then raise exception 'you can be in three worlds at most'; end if;
  insert into worlds (name, creator) values (left(coalesce(nullif(trim(p_name), ''), 'Our block'), 24), uid) returning id into w;
  insert into world_members (world_id, user_id) values (w, uid);
  return w;
end $$;
