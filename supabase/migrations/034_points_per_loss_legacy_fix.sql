-- Torneos con points_per_loss = 0 mostraban 9 pts por 3V-1L en lugar de 10 (+1 por derrota jugada).

update public.tournament_rules
set points_per_loss = 1
where points_per_loss = 0;
