-- Indexes for the foreign keys that lookups and cascading deletes go through, and one update policy on homes
-- instead of two (the performance advisor's notes).

create index if not exists blocks_blocked_idx on public.blocks (blocked);
create index if not exists couple_requests_to_idx on public.couple_requests (to_user);
create index if not exists couples_world_idx on public.couples (world_id);
create index if not exists friendships_b_idx on public.friendships (user_b);
create index if not exists inventory_item_idx on public.inventory (item_id);
create index if not exists milestones_item_idx on public.milestones (item_id);
create index if not exists reports_message_idx on public.reports (message_id);
create index if not exists reports_reported_idx on public.reports (reported);
create index if not exists reports_reporter_idx on public.reports (reporter);
create index if not exists visits_host_idx on public.visits (host);
create index if not exists world_invites_by_idx on public.world_invites (created_by);
create index if not exists world_invites_world_idx on public.world_invites (world_id);
create index if not exists worlds_creator_idx on public.worlds (creator);

drop policy "update own home" on public.homes;
drop policy "partners update the couple home" on public.homes;
create policy "update own home, or the couple home" on public.homes for update to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.couples c where c.user_a = homes.user_id and c.user_b = (select auth.uid())))
  with check (user_id = (select auth.uid()) or exists (select 1 from public.couples c where c.user_a = homes.user_id and c.user_b = (select auth.uid())));
