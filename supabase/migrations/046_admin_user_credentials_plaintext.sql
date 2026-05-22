-- Credenciales visibles para exportacion administrativa.
-- Supabase Auth no permite recuperar contrasenas en texto claro; esta tabla
-- conserva la contrasena temporal indicada por administracion para exports.

create table if not exists public.admin_user_credentials (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  password_plain text not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

alter table public.admin_user_credentials enable row level security;

drop policy if exists admin_user_credentials_select_admin on public.admin_user_credentials;
create policy admin_user_credentials_select_admin
  on public.admin_user_credentials
  for select
  using (public.is_admin());

comment on table public.admin_user_credentials is
  'Contrasenas temporales visibles solo para administracion/exportaciones. Mantener alineado desde Edge Functions al crear, importar o cambiar password.';
