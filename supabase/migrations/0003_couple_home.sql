-- A couple shares one house: it is kept in the home row of the couple's user_a, under data.couple (each player's
-- own one-room home stays under data.solo, so a breakup gives everyone their own home back). Both partners may
-- write that row. Partners see each other's home changes live.

create policy "partners update the couple home" on public.homes for update to authenticated
  using (exists (select 1 from public.couples c where c.user_a = homes.user_id and c.user_b = (select auth.uid())))
  with check (exists (select 1 from public.couples c where c.user_a = homes.user_id and c.user_b = (select auth.uid())));

alter publication supabase_realtime add table public.homes;
