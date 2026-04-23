-- Operador: asignar super_admin a un usuario concreto (requiere migración 004 para el check de role).
update public.profiles
set role = 'super_admin'
where id = '6c0d9322-048c-4426-84d8-1a8312b23edf';
