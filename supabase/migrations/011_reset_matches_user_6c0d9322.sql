-- Libera (vuelve a pending sin marcador) todos los partidos donde participa el usuario 6c0d9322-048c-4426-84d8-1a8312b23edf.

update public.matches m
set
  score_raw = null,
  winner_id = null,
  status = 'pending',
  result_type = 'normal',
  scheduled_date = null,
  scheduled_start_at = null,
  scheduled_end_at = null,
  locked_at = null,
  confirmed_at = null,
  confirmed_by = null,
  updated_at = now()
where m.player_a_user_id = '6c0d9322-048c-4426-84d8-1a8312b23edf'::uuid
   or m.player_b_user_id = '6c0d9322-048c-4426-84d8-1a8312b23edf'::uuid;
