-- Hot-path indexes for app load/navigation performance.
-- These match the most common filters used by dashboard, player, admin, and dispute inbox screens.

create index if not exists tournaments_status_created_at_idx
  on public.tournaments (status, created_at desc);

create index if not exists groups_tournament_order_idx
  on public.groups (tournament_id, order_index, name);

create index if not exists group_players_user_group_idx
  on public.group_players (user_id, group_id);

create index if not exists group_players_group_seed_idx
  on public.group_players (group_id, seed_order, id);

create index if not exists matches_tournament_status_updated_idx
  on public.matches (tournament_id, status, updated_at desc);

create index if not exists matches_status_disputed_updated_idx
  on public.matches (status, disputed_at desc, updated_at desc);

create index if not exists matches_player_a_user_status_idx
  on public.matches (player_a_user_id, status);

create index if not exists matches_player_b_user_status_idx
  on public.matches (player_b_user_id, status);
