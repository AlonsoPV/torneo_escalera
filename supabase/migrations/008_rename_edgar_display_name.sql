-- Nombre mostrado: Edgar Alonso Pérez Vázquez → Alonso Vazquez (perfil + inscripción en grupo demo).
update public.profiles
set full_name = 'Alonso Vazquez'
where id = 'de10029f-061d-48c2-8aeb-cd43f4c437a3'
   or full_name = 'Edgar Alonso Pérez Vázquez';

update public.group_players
set display_name = 'Alonso Vazquez'
where user_id = 'de10029f-061d-48c2-8aeb-cd43f4c437a3'
   or display_name = 'Edgar Alonso Pérez Vázquez';
