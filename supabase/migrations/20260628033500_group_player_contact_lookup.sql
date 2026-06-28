create or replace function public.get_group_player_contacts(p_group_id uuid)
returns table (
  user_id uuid,
  phone text
)
language sql
security definer
set search_path = ''
as $$
  select gp.user_id, p.phone
  from public.group_players gp
  join public.profiles p on p.id = gp.user_id
  join public.groups g on g.id = gp.group_id
  where gp.group_id = p_group_id
    and auth.uid() is not null
    and (
      public.is_admin()
      or public.can_read_tournament(g.tournament_id)
    );
$$;

revoke all on function public.get_group_player_contacts(uuid) from public, anon;
grant execute on function public.get_group_player_contacts(uuid) to authenticated;
