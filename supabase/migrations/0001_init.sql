-- NeighBoxed: accounts, homes, the economy, friends, worlds, couples and chat.
--
-- Rules of the road:
--  * Every table has row level security. Players read what is theirs or shared with them.
--  * Money and ownership (wallets, inventory, earnings, claims) are never written by the client: only the
--    security definer functions below change them, after checking the rules (they mirror src/game/economy.js).
--  * A player's home layout (homes.data) is written directly by its owner: it moves furniture, not money.
--  * Live play runs on private Realtime channels named 'world:<id>', open only to that world's members.

-- ============================================================ tables

create table public.catalog (
  id text primary key,
  cat text not null,
  tier int not null check (tier between 1 and 10),
  price int not null check (price > 0),
  kind text not null check (kind in ('placeable', 'unique'))
);
create table public.starter_items (item_id text primary key references public.catalog, count int not null check (count > 0));
create table public.milestones (day int primary key, item_id text not null references public.catalog);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 16),
  tag text not null unique, -- name#1234, how friends find you
  house_name text not null default '' check (char_length(house_name) <= 24),
  tz text not null default 'UTC',
  joined date not null default current_date,
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

create table public.wallets (
  user_id uuid primary key references public.profiles on delete cascade,
  boxets int not null default 1500 check (boxets >= 0)
);

create table public.inventory (
  user_id uuid not null references public.profiles on delete cascade,
  item_id text not null references public.catalog,
  count int not null check (count > 0),
  primary key (user_id, item_id)
);

create table public.homes (
  user_id uuid primary key references public.profiles on delete cascade,
  data jsonb not null default '{}'::jsonb, -- { layout, style, switches, equipped }
  updated_at timestamptz not null default now(),
  check (octet_length(data::text) < 200000)
);

create table public.earnings (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  source text not null,
  amount int not null default 0,
  primary key (user_id, day, source)
);

create table public.claims (
  user_id uuid not null references public.profiles on delete cascade,
  day int not null,
  primary key (user_id, day)
);

-- active play, counted on the server from heartbeats (see heartbeat())
create table public.activity (
  user_id uuid primary key references public.profiles on delete cascade,
  window_sec int not null default 0,
  last_beat timestamptz,
  world_id uuid,
  last_game_at timestamptz,
  last_message_at timestamptz
);

create table public.friendships (
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  requested_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table public.blocks (
  blocker uuid not null references public.profiles on delete cascade,
  blocked uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table public.worlds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 24),
  creator uuid not null references public.profiles on delete cascade,
  slots int not null default 4 check (slots between 4 and 6),
  fund int not null default 0 check (fund >= 0),
  created_at timestamptz not null default now()
);

create table public.world_members (
  world_id uuid not null references public.worlds on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (world_id, user_id)
);
create index on public.world_members (user_id);

create table public.world_invites (
  code text primary key,
  world_id uuid not null references public.worlds on delete cascade,
  created_by uuid not null references public.profiles on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles on delete cascade,
  user_b uuid not null references public.profiles on delete cascade,
  world_id uuid references public.worlds on delete set null,
  since date not null default current_date,
  ends_at timestamptz, -- a breakup was asked for; it happens at this time unless cancelled
  check (user_a < user_b)
);
create unique index couples_a on public.couples (user_a);
create unique index couples_b on public.couples (user_b);

create table public.couple_requests (
  from_user uuid not null references public.profiles on delete cascade,
  to_user uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user)
);

create table public.messages (
  id bigint generated always as identity primary key,
  world_id uuid references public.worlds on delete cascade,
  to_user uuid references public.profiles on delete cascade,
  from_user uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  check ((world_id is null) <> (to_user is null))
);
create index on public.messages (world_id, created_at desc);
create index on public.messages (to_user, created_at desc);
create index on public.messages (from_user, created_at desc);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null references public.profiles on delete cascade,
  reported uuid not null references public.profiles on delete cascade,
  message_id bigint references public.messages on delete set null,
  reason text not null check (char_length(reason) between 1 and 300),
  created_at timestamptz not null default now()
);

-- ============================================================ helpers

create or replace function public.is_member(w uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from world_members where world_id = w and user_id = auth.uid())
$$;

-- do two players share a world?
create or replace function public.shares_world(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from world_members a join world_members b on a.world_id = b.world_id
    where a.user_id = auth.uid() and b.user_id = other)
$$;

create or replace function public.is_blocked_between(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker = x and blocked = y) or (blocker = y and blocked = x))
$$;

create or replace function public.my_today() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select tz from profiles where id = auth.uid()), 'UTC'))::date
$$;

create or replace function public.me() returns uuid
language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  return auth.uid();
end $$;

-- ============================================================ row level security

alter table public.catalog enable row level security;
alter table public.starter_items enable row level security;
alter table public.milestones enable row level security;
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.inventory enable row level security;
alter table public.homes enable row level security;
alter table public.earnings enable row level security;
alter table public.claims enable row level security;
alter table public.activity enable row level security;
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.worlds enable row level security;
alter table public.world_members enable row level security;
alter table public.world_invites enable row level security;
alter table public.couples enable row level security;
alter table public.couple_requests enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

create policy "anyone reads the catalog" on public.catalog for select using (true);
create policy "anyone reads the starter items" on public.starter_items for select using (true);
create policy "anyone reads the milestones" on public.milestones for select using (true);

-- profiles hold only a name, a tag and a house name: signed-in players can look each other up (to add friends)
create policy "signed in players read profiles" on public.profiles for select to authenticated using (true);

create policy "own wallet" on public.wallets for select to authenticated using (user_id = (select auth.uid()));
create policy "own inventory, and a partner's" on public.inventory for select to authenticated using (
  user_id = (select auth.uid())
  or exists (select 1 from couples c where (c.user_a = (select auth.uid()) and c.user_b = inventory.user_id) or (c.user_b = (select auth.uid()) and c.user_a = inventory.user_id)));
create policy "own earnings" on public.earnings for select to authenticated using (user_id = (select auth.uid()));
create policy "own claims" on public.claims for select to authenticated using (user_id = (select auth.uid()));
create policy "own activity" on public.activity for select to authenticated using (user_id = (select auth.uid()));

-- a home is seen by its owner and by anyone sharing a world with them (to visit), and written only by its owner
create policy "read homes in my worlds" on public.homes for select to authenticated using (user_id = (select auth.uid()) or public.shares_world(user_id));
create policy "write own home" on public.homes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "update own home" on public.homes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "my friendships" on public.friendships for select to authenticated using ((select auth.uid()) in (user_a, user_b));
create policy "my blocks" on public.blocks for select to authenticated using (blocker = (select auth.uid()));
create policy "worlds I am in" on public.worlds for select to authenticated using (public.is_member(id));
create policy "members of my worlds" on public.world_members for select to authenticated using (public.is_member(world_id));
create policy "invites I made" on public.world_invites for select to authenticated using (created_by = (select auth.uid()));
create policy "couples in my worlds" on public.couples for select to authenticated using (
  (select auth.uid()) in (user_a, user_b) or (world_id is not null and public.is_member(world_id)));
create policy "my couple requests" on public.couple_requests for select to authenticated using ((select auth.uid()) in (from_user, to_user));
create policy "messages I can see" on public.messages for select to authenticated using (
  ((world_id is not null and public.is_member(world_id)) or (select auth.uid()) in (from_user, to_user))
  and not public.is_blocked_between((select auth.uid()), from_user));

-- live play: the 'world:<id>' channels are open to that world's members only
create policy "members hear their world" on realtime.messages for select to authenticated using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select realtime.topic()) like 'world:%'
  and public.is_member(nullif(split_part((select realtime.topic()), ':', 2), '')::uuid));
create policy "members talk in their world" on realtime.messages for insert to authenticated with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select realtime.topic()) like 'world:%'
  and public.is_member(nullif(split_part((select realtime.topic()), ':', 2), '')::uuid));

-- ============================================================ getting started

-- called once after the first sign-in: makes the profile, the wallet, the starter furniture, an empty home and
-- the player's own world. Safe to call again (returns the existing profile).
create or replace function public.start_player(p_name text, p_tz text default 'UTC') returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := me();
  clean text := left(trim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] _.-]', '', 'g')), 16);
  t text;
  p profiles;
  w uuid;
begin
  select * into p from profiles where id = uid;
  if found then return p; end if;
  if clean = '' then clean := 'Neighbour'; end if;
  loop
    t := lower(replace(clean, ' ', '')) || '#' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from profiles where tag = t);
  end loop;
  insert into profiles (id, name, tag, house_name, tz, joined)
    values (uid, clean, t, left(clean || '''s home', 24), coalesce(nullif(p_tz, ''), 'UTC'), (now() at time zone coalesce(nullif(p_tz, ''), 'UTC'))::date)
    returning * into p;
  insert into wallets (user_id) values (uid);
  insert into inventory (user_id, item_id, count) select uid, item_id, count from starter_items;
  insert into homes (user_id) values (uid);
  insert into activity (user_id) values (uid);
  insert into worlds (name, creator) values (left(clean || '''s block', 24), uid) returning id into w;
  insert into world_members (world_id, user_id) values (w, uid);
  return p;
end $$;

create or replace function public.set_profile(p_name text, p_house text, p_tz text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := me();
begin
  update profiles set
    name = coalesce(nullif(left(trim(regexp_replace(coalesce(p_name, ''), '[^[:alnum:] _.-]', '', 'g')), 16), ''), name),
    house_name = coalesce(nullif(left(trim(coalesce(p_house, '')), 24), ''), house_name),
    tz = coalesce(nullif(p_tz, ''), tz)
  where id = uid;
end $$;

-- ============================================================ money

create or replace function public.buy(p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := me();
  it catalog;
  bal int;
begin
  select * into it from catalog where id = p_item;
  if not found then raise exception 'unknown item'; end if;
  if it.kind = 'unique' and exists (select 1 from inventory where user_id = uid and item_id = p_item) then
    raise exception 'already owned';
  end if;
  update wallets set boxets = boxets - it.price where user_id = uid and boxets >= it.price returning boxets into bal;
  if not found then raise exception 'not enough Boxets'; end if;
  insert into inventory (user_id, item_id, count) values (uid, p_item, 1)
    on conflict (user_id, item_id) do update set count = inventory.count + 1;
  return bal;
end $$;

-- the daily gift: one claim per calendar day (the player's own), counted from the day they joined
create or replace function public.claim_daily() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := me();
  d int;
  amount int;
  gift text;
  bal int;
begin
  select (my_today() - joined) + 1 into d from profiles where id = uid;
  if exists (select 1 from claims where user_id = uid and day = d) then raise exception 'already claimed today'; end if;
  amount := least(20 + 2 * d, 150);
  insert into claims (user_id, day) values (uid, d);
  update wallets set boxets = boxets + amount where user_id = uid returning boxets into bal;
  select item_id into gift from milestones where day = d;
  if gift is not null then
    insert into inventory (user_id, item_id, count) values (uid, gift, 1)
      on conflict (user_id, item_id) do nothing;
  end if;
  return jsonb_build_object('day', d, 'amount', amount, 'gift', gift, 'boxets', bal);
end $$;

-- pay `amount` from `source`, within that source's daily cap and the overall daily cap of 600
create or replace function public.pay(uid uuid, p_source text, p_amount int) returns int
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone coalesce((select tz from profiles where id = uid), 'UTC'))::date;
  cap int := case p_source when 'stars' then 60 when 'quiz' then 30 when 'visit' then 30 else 600 end;
  by_source int;
  total int;
  give int;
begin
  select coalesce(sum(amount), 0) into total from earnings where user_id = uid and day = today;
  select coalesce(amount, 0) into by_source from earnings where user_id = uid and day = today and source = p_source;
  give := greatest(0, least(p_amount, cap - coalesce(by_source, 0), 600 - total));
  if give > 0 then
    insert into earnings (user_id, day, source, amount) values (uid, today, p_source, give)
      on conflict (user_id, day, source) do update set amount = earnings.amount + give;
    update wallets set boxets = boxets + give where user_id = uid;
  end if;
  return give;
end $$;
revoke execute on function public.pay(uuid, text, int) from public, anon, authenticated;

-- active play: the client calls this about once a minute while the player is active (moved, clicked or played in
-- the last two minutes, with the game visible). At most 75 seconds count per beat, and only if the previous beat
-- was recent, so leaving the game open does nothing. Each full 30 minutes pays 15 Boxets, times the number of
-- world-mates active right now (up to 3x), times 3 if your partner is active too.
create or replace function public.heartbeat(p_world uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := me();
  a activity;
  add int := 0;
  together int := 1;
  partner uuid;
  mult int;
  paid int := 0;
begin
  if p_world is not null and not is_member(p_world) then p_world := null; end if;
  select * into a from activity where user_id = uid for update;
  if a.last_beat is not null and now() - a.last_beat < interval '3 minutes' then
    add := least(75, greatest(0, extract(epoch from now() - a.last_beat)::int));
  end if;
  update profiles set last_seen = now() where id = uid;
  a.window_sec := a.window_sec + add;
  if a.window_sec >= 1800 then
    a.window_sec := a.window_sec - 1800;
    if p_world is not null then
      select count(*) into together from world_members m join activity x on x.user_id = m.user_id
        where m.world_id = p_world and x.last_beat > now() - interval '2 minutes' and x.world_id = p_world;
      together := greatest(1, together);
    end if;
    select case when user_a = uid then user_b else user_a end into partner from couples where uid in (user_a, user_b) and ends_at is null;
    mult := least(together, 3) * case when partner is not null and exists (
      select 1 from activity where user_id = partner and last_beat > now() - interval '2 minutes') then 3 else 1 end;
    paid := pay(uid, 'time', 15 * mult);
  end if;
  update activity set window_sec = a.window_sec, last_beat = now(), world_id = p_world where user_id = uid;
  return jsonb_build_object('sec', a.window_sec, 'paid', paid, 'boxets', (select boxets from wallets where user_id = uid));
end $$;

-- a finished minigame round. Scores come from the client, so each game is capped per day and rounds can't be
-- sent faster than a round lasts.
create or replace function public.finish_game(p_game text, p_score int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := me();
  last timestamptz;
  given int := 0;
begin
  if p_game not in ('stars') then raise exception 'unknown game'; end if;
  select last_game_at into last from activity where user_id = uid for update;
  if last is not null and now() - last < interval '40 seconds' then raise exception 'too soon'; end if;
  update activity set last_game_at = now() where user_id = uid;
  given := pay(uid, p_game, least(greatest(p_score, 0), 120) * 2);
  return jsonb_build_object('given', given, 'boxets', (select boxets from wallets where user_id = uid));
end $$;

-- ============================================================ friends, blocks, reports

create or replace function public.friend_request(p_tag text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := me();
  other uuid;
  a uuid; b uuid;
  f friendships;
begin
  select id into other from profiles where tag = lower(trim(p_tag));
  if other is null then raise exception 'nobody with that tag'; end if;
  if other = uid then raise exception 'that is you'; end if;
  if is_blocked_between(uid, other) then raise exception 'cannot add this player'; end if;
  a := least(uid, other); b := greatest(uid, other);
  select * into f from friendships where user_a = a and user_b = b;
  if found then
    -- they had already asked you: this accepts it
    if f.status = 'pending' and f.requested_by = other then update friendships set status = 'accepted' where user_a = a and user_b = b; end if;
    return other;
  end if;
  insert into friendships (user_a, user_b, status, requested_by) values (a, b, 'pending', uid);
  return other;
end $$;

create or replace function public.friend_respond(p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := me();
begin
  if p_accept then
    update friendships set status = 'accepted'
      where user_a = least(uid, p_user) and user_b = greatest(uid, p_user) and status = 'pending' and requested_by = p_user;
  else
    delete from friendships where user_a = least(uid, p_user) and user_b = greatest(uid, p_user) and status = 'pending';
  end if;
end $$;

create or replace function public.friend_remove(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships where user_a = least(auth.uid(), p_user) and user_b = greatest(auth.uid(), p_user)
$$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := me();
begin
  if p_user = uid then raise exception 'that is you'; end if;
  insert into blocks (blocker, blocked) values (uid, p_user) on conflict do nothing;
  delete from friendships where user_a = least(uid, p_user) and user_b = greatest(uid, p_user);
  delete from couple_requests where (from_user = uid and to_user = p_user) or (from_user = p_user and to_user = uid);
end $$;

create or replace function public.unblock_user(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from blocks where blocker = auth.uid() and blocked = p_user
$$;

create or replace function public.report_user(p_user uuid, p_reason text, p_message bigint default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := me();
begin
  if (select count(*) from reports where reporter = uid and created_at > now() - interval '1 hour') >= 10 then raise exception 'too many reports'; end if;
  insert into reports (reporter, reported, message_id, reason) values (uid, p_user, p_message, left(trim(p_reason), 300));
end $$;

-- ============================================================ worlds

create or replace function public.world_create(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); w uuid;
begin
  if (select count(*) from world_members where user_id = uid) >= 2 then raise exception 'you can be in two worlds at most'; end if;
  insert into worlds (name, creator) values (left(coalesce(nullif(trim(p_name), ''), 'Our block'), 24), uid) returning id into w;
  insert into world_members (world_id, user_id) values (w, uid);
  return w;
end $$;

create or replace function public.invite_create(p_world uuid) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); c text;
begin
  if not is_member(p_world) then raise exception 'not your world'; end if;
  loop
    c := upper(substr(translate(encode(extensions.gen_random_bytes(6), 'base64'), '+/=0O1Il', 'XYZ'), 1, 6));
    exit when char_length(c) = 6 and not exists (select 1 from world_invites where code = c);
  end loop;
  insert into world_invites (code, world_id, created_by) values (c, p_world, uid);
  return c;
end $$;

-- what an invite code leads to (shown before you join)
create or replace function public.invite_peek(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('world', w.id, 'name', w.name, 'from', p.name,
    'members', (select count(*) from world_members where world_id = w.id), 'slots', w.slots)
  from world_invites i join worlds w on w.id = i.world_id join profiles p on p.id = i.created_by
  where i.code = upper(trim(p_code)) and i.expires_at > now()
$$;

create or replace function public.world_join(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); w worlds; inv world_invites;
begin
  select * into inv from world_invites where code = upper(trim(p_code)) and expires_at > now();
  if not found then raise exception 'that invite has expired'; end if;
  select * into w from worlds where id = inv.world_id for update;
  if exists (select 1 from world_members where world_id = w.id and user_id = uid) then return w.id; end if;
  if (select count(*) from world_members where user_id = uid) >= 2 then raise exception 'you can be in two worlds at most'; end if;
  if (select count(*) from world_members where world_id = w.id) >= w.slots then raise exception 'that world is full'; end if;
  if exists (select 1 from world_members m where m.world_id = w.id and is_blocked_between(uid, m.user_id)) then raise exception 'cannot join this world'; end if;
  insert into world_members (world_id, user_id) values (w.id, uid);
  return w.id;
end $$;

create or replace function public.world_leave(p_world uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); next_owner uuid;
begin
  delete from world_members where world_id = p_world and user_id = uid;
  -- the creator leaving hands the world to the longest-standing member; the last one out closes it
  if (select creator from worlds where id = p_world) = uid then
    select user_id into next_owner from world_members where world_id = p_world order by joined_at limit 1;
    if next_owner is null then delete from worlds where id = p_world; else update worlds set creator = next_owner where id = p_world; end if;
  end if;
end $$;

create or replace function public.world_remove(p_world uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := me();
begin
  if (select creator from worlds where id = p_world) is distinct from uid then raise exception 'only the world''s creator can remove someone'; end if;
  if p_user = uid then raise exception 'leave the world instead'; end if;
  delete from world_members where world_id = p_world and user_id = p_user;
end $$;

create or replace function public.world_rename(p_world uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_world) then raise exception 'not your world'; end if;
  update worlds set name = left(coalesce(nullif(trim(p_name), ''), name), 24) where id = p_world;
end $$;

create or replace function public.fund_add(p_world uuid, p_amount int) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); f int;
begin
  if not is_member(p_world) then raise exception 'not your world'; end if;
  if p_amount <= 0 then raise exception 'nothing to add'; end if;
  update wallets set boxets = boxets - p_amount where user_id = uid and boxets >= p_amount;
  if not found then raise exception 'not enough Boxets'; end if;
  update worlds set fund = fund + p_amount where id = p_world returning fund into f;
  return f;
end $$;

create or replace function public.slot_buy(p_world uuid) returns int
language plpgsql security definer set search_path = public as $$
declare w worlds; price int;
begin
  if not is_member(p_world) then raise exception 'not your world'; end if;
  select * into w from worlds where id = p_world for update;
  if w.slots >= 6 then raise exception 'this world is at its maximum size'; end if;
  price := case w.slots + 1 when 5 then 500 else 1000 end;
  if w.fund < price then raise exception 'the world fund needs more Boxets'; end if;
  update worlds set fund = fund - price, slots = slots + 1 where id = p_world;
  return w.slots + 1;
end $$;

-- ============================================================ couples

create or replace function public.couple_request(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := me();
begin
  if p_user = uid then raise exception 'that is you'; end if;
  if not exists (select 1 from friendships where user_a = least(uid, p_user) and user_b = greatest(uid, p_user) and status = 'accepted') then
    raise exception 'you need to be friends first';
  end if;
  if not shares_world(p_user) then raise exception 'you need to be in the same world'; end if;
  if exists (select 1 from couples where uid in (user_a, user_b) or p_user in (user_a, user_b)) then raise exception 'one of you is already in a couple'; end if;
  insert into couple_requests (from_user, to_user) values (uid, p_user) on conflict do nothing;
end $$;

create or replace function public.couple_respond(p_user uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); w uuid; c uuid;
begin
  if not exists (select 1 from couple_requests where from_user = p_user and to_user = uid) then raise exception 'no such request'; end if;
  delete from couple_requests where (from_user = p_user and to_user = uid) or (from_user = uid and to_user = p_user);
  if not p_accept then return null; end if;
  if exists (select 1 from couples where uid in (user_a, user_b) or p_user in (user_a, user_b)) then raise exception 'one of you is already in a couple'; end if;
  select a.world_id into w from world_members a join world_members b on a.world_id = b.world_id where a.user_id = uid and b.user_id = p_user limit 1;
  insert into couples (user_a, user_b, world_id) values (least(uid, p_user), greatest(uid, p_user), w) returning id into c;
  return c;
end $$;

create or replace function public.breakup_request() returns timestamptz
language sql security definer set search_path = public as $$
  update couples set ends_at = now() + interval '24 hours' where auth.uid() in (user_a, user_b) and ends_at is null returning ends_at
$$;

create or replace function public.breakup_cancel() returns void
language sql security definer set search_path = public as $$
  update couples set ends_at = null where auth.uid() in (user_a, user_b)
$$;

-- the couple you are in (ending it first, if its 24 hours are up)
create or replace function public.my_couple() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); c couples; partner profiles;
begin
  delete from couples where uid in (user_a, user_b) and ends_at is not null and ends_at < now();
  select * into c from couples where uid in (user_a, user_b);
  if not found then return null; end if;
  select * into partner from profiles where id = case when c.user_a = uid then c.user_b else c.user_a end;
  return jsonb_build_object('id', c.id, 'partner', partner.id, 'partner_name', partner.name, 'since', c.since, 'ends_at', c.ends_at, 'world', c.world_id);
end $$;

-- ============================================================ chat

-- a message to a world (p_world) or to one friend (p_to). At most one a second; blocked players can't reach you.
create or replace function public.send_message(p_body text, p_world uuid default null, p_to uuid default null) returns public.messages
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := me();
  last timestamptz;
  body text := left(trim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g')), 300);
  m messages;
begin
  if body = '' then raise exception 'empty message'; end if;
  if (p_world is null) = (p_to is null) then raise exception 'send to a world or to one friend'; end if;
  if p_world is not null and not is_member(p_world) then raise exception 'not your world'; end if;
  if p_to is not null then
    if is_blocked_between(uid, p_to) then raise exception 'cannot message this player'; end if;
    if not exists (select 1 from friendships where user_a = least(uid, p_to) and user_b = greatest(uid, p_to) and status = 'accepted') then
      raise exception 'you can only message friends';
    end if;
  end if;
  select last_message_at into last from activity where user_id = uid for update;
  if last is not null and now() - last < interval '900 milliseconds' then raise exception 'slow down a little'; end if;
  update activity set last_message_at = now() where user_id = uid;
  insert into messages (world_id, to_user, from_user, body) values (p_world, p_to, uid, body) returning * into m;
  return m;
end $$;

-- ============================================================ leaving for good

create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := me(); w uuid;
begin
  for w in select world_id from world_members where user_id = uid loop perform world_leave(w); end loop;
  delete from auth.users where id = uid; -- everything else goes with it (on delete cascade)
end $$;

-- ============================================================ who may call what

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_member(uuid), public.shares_world(uuid), public.is_blocked_between(uuid, uuid), public.my_today(),
  public.start_player(text, text), public.set_profile(text, text, text), public.buy(text), public.claim_daily(),
  public.heartbeat(uuid), public.finish_game(text, int),
  public.friend_request(text), public.friend_respond(uuid, boolean), public.friend_remove(uuid),
  public.block_user(uuid), public.unblock_user(uuid), public.report_user(uuid, text, bigint),
  public.world_create(text), public.invite_create(uuid), public.invite_peek(text), public.world_join(text),
  public.world_leave(uuid), public.world_remove(uuid, uuid), public.world_rename(uuid, text),
  public.fund_add(uuid, int), public.slot_buy(uuid),
  public.couple_request(uuid), public.couple_respond(uuid, boolean), public.breakup_request(), public.breakup_cancel(), public.my_couple(),
  public.send_message(text, uuid, uuid), public.delete_account()
to authenticated;
revoke execute on function public.pay(uuid, text, int) from authenticated;

-- live updates the client listens to (through RLS)
alter publication supabase_realtime add table public.messages, public.friendships, public.couple_requests, public.world_members, public.wallets;
