-- Visiting a neighbour's home pays a little, once per home per day (10 Boxets, at most 30 a day: see pay()).

create table public.visits (
  user_id uuid not null references public.profiles on delete cascade,
  host uuid not null references public.profiles on delete cascade,
  day date not null,
  primary key (user_id, host, day)
);
alter table public.visits enable row level security;
create policy "own visits" on public.visits for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.visit_home(p_host uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := me(); given int := 0;
begin
  if p_host = uid or not shares_world(p_host) then raise exception 'you can only visit neighbours'; end if;
  insert into visits (user_id, host, day) values (uid, p_host, my_today()) on conflict do nothing;
  if found then given := pay(uid, 'visit', 10); end if;
  return jsonb_build_object('given', given, 'boxets', (select boxets from wallets where user_id = uid));
end $$;
revoke execute on function public.visit_home(uuid) from public, anon;
grant execute on function public.visit_home(uuid) to authenticated;
