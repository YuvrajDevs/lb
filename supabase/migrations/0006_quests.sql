-- Daily quests: three small things to do each day, picked for each player from a pool (the same pick on every
-- device, from a hash of the player and the day). Each pays 20 Boxets, and doing all three 30 more (at most 90 a
-- day from quests, inside the overall daily cap). Progress is counted by the game; the rewards are small and
-- capped, and each quest can be claimed once a day.

create table public.quest_claims (
  user_id uuid not null references public.profiles on delete cascade,
  day date not null,
  quest text not null,
  primary key (user_id, day, quest)
);
alter table public.quest_claims enable row level security;
create policy "own quest claims" on public.quest_claims for select to authenticated using (user_id = (select auth.uid()));

-- keep in step with QUESTS in src/game/quests.js
create or replace function public.my_quests() returns text[]
language sql stable security definer set search_path = public as $$
  select array_agg(q order by md5(auth.uid()::text || my_today()::text || q)) from (
    select q from unnest(array['lamp','place','stars','cliff','visit','chat','emote','playground','buy','tryon','time']) q
    order by md5(auth.uid()::text || my_today()::text || q) limit 3
  ) t
$$;

create or replace function public.quest_claim(p_quest text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); today date := my_today(); given int := 0; n int;
begin
  if not (p_quest = any(my_quests())) then raise exception 'that is not one of today''s quests'; end if;
  insert into quest_claims (user_id, day, quest) values (uid, today, p_quest) on conflict do nothing;
  if not found then raise exception 'already done today'; end if;
  given := pay(uid, 'quest', 20);
  select count(*) into n from quest_claims where user_id = uid and day = today;
  if n = 3 then given := given + pay(uid, 'quest', 30); end if;
  return jsonb_build_object('given', given, 'all', n = 3, 'boxets', (select boxets from wallets where user_id = uid));
end $$;

-- quests get their own cap in pay()
create or replace function public.pay(uid uuid, p_source text, p_amount int) returns int
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone coalesce((select tz from profiles where id = uid), 'UTC'))::date;
  cap int := case p_source when 'stars' then 60 when 'quiz' then 30 when 'visit' then 30 when 'quest' then 90 else 600 end;
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
revoke execute on function public.my_quests(), public.quest_claim(text) from public, anon;
grant execute on function public.my_quests(), public.quest_claim(text) to authenticated;
