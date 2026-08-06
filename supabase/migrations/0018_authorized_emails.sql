-- Autorización de acceso gestionada por la administradora. Reemplaza el
-- mecanismo implícito de hoy ("hay 2 perfiles, Mama y Yo; quien reclama
-- cada uno primero, entra para siempre") por una lista explícita de
-- correos que la admin agrega/revoca desde la app — sin tocar código ni
-- volver a desplegar.

create table authorized_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  invited_by uuid references profiles (id),
  invited_at timestamptz not null default now(),
  status text not null default 'pendiente' check (status in ('pendiente', 'activo', 'revocado'))
);

create index authorized_emails_email_idx on authorized_emails (email);

alter table profiles add column is_admin boolean not null default false;

update profiles set is_admin = true where slot = 'yo';

-- *** Grandfathering ***: el código actual no tiene los 2 emails de Mama
-- y Yo hardcodeados en ningún lado (el acceso hoy se resuelve solo por
-- "2 perfiles, quien los reclama primero entra"), así que no hay ningún
-- valor real para insertar a mano acá. En cambio, se leen los emails
-- reales de auth.users para cualquier perfil que YA esté reclamado en
-- este momento (si el proyecto todavía no se desplegó y nadie reclamó
-- ningún perfil todavía, esto no inserta nada, y ambas cuentas quedan
-- para autorizar a mano desde el panel de Equipo).
insert into authorized_emails (email, status)
select lower(au.email), 'activo'
from profiles p
join auth.users au on au.id = p.user_id
where p.user_id is not null
on conflict (email) do nothing;

alter table authorized_emails enable row level security;

-- security definer para poder chequear is_admin sin recursion de RLS
-- (misma razon que is_claimed_user() en 0010_rls_policies.sql).
create or replace function is_admin_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from profiles where user_id = auth.uid()), false);
$$;

grant execute on function is_admin_user() to authenticated;

-- Todo el CRUD de la tabla queda admin-only, incluida la lectura: el
-- chequeo de autorización durante el login se resuelve aparte con
-- check_email_authorization() (security definer), que nunca expone la
-- tabla completa al cliente.
create policy authorized_emails_select on authorized_emails
  for select to authenticated
  using (is_admin_user());

create policy authorized_emails_insert on authorized_emails
  for insert to authenticated
  with check (is_admin_user());

create policy authorized_emails_update on authorized_emails
  for update to authenticated
  using (is_admin_user())
  with check (is_admin_user());

create policy authorized_emails_delete on authorized_emails
  for delete to authenticated
  using (is_admin_user());

-- Chequeo de login: se llama justo despues del OAuth de Google, antes de
-- que la cuenta tenga (o pueda tener) un perfil. Devuelve el status
-- ('pendiente' | 'activo' | 'revocado') o null si el correo no esta en
-- la lista.
create or replace function check_email_authorization(p_email text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select status from authorized_emails where email = lower(trim(p_email));
$$;

grant execute on function check_email_authorization(text) to authenticated;

-- Se llama al completar el reclamo de perfil (primera vez que esa cuenta
-- entra): pasa el correo de 'pendiente' a 'activo'. Si ya estaba
-- 'activo' (re-login normal) no hace nada.
create or replace function mark_email_active(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update authorized_emails set status = 'activo'
  where email = lower(trim(p_email)) and status = 'pendiente';
end;
$$;

grant execute on function mark_email_active(text) to authenticated;

-- Agregar un correo desde el panel de Equipo. Si el correo ya existia y
-- estaba 'revocado', lo reactiva como 'pendiente' (re-invitacion); si ya
-- esta 'pendiente' o 'activo', no lo toca.
create or replace function add_authorized_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_admin boolean;
  v_email text := lower(trim(p_email));
begin
  select id, is_admin into v_actor_id, v_actor_admin from profiles where user_id = auth.uid();

  if not coalesce(v_actor_admin, false) then
    raise exception 'No autorizado';
  end if;

  insert into authorized_emails (email, invited_by, status)
  values (v_email, v_actor_id, 'pendiente')
  on conflict (email) do update
  set status = 'pendiente', invited_by = v_actor_id, invited_at = now()
  where authorized_emails.status = 'revocado';
end;
$$;

grant execute on function add_authorized_email(text) to authenticated;

-- Revocar: cambia el status a 'revocado' y, si esa cuenta ya tenia un
-- perfil reclamado, lo desvincula (user_id/claimed_at a null) para que
-- el lugar quede libre para la proxima persona que la admin autorice —
-- el perfil en si (nombre, color) y todo su historial de ventas,
-- pedidos y prestamos NO se tocan ni se borran.
create or replace function revoke_authorized_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_admin boolean;
  v_email text := lower(trim(p_email));
  v_user_id uuid;
begin
  select is_admin into v_actor_admin from profiles where user_id = auth.uid();

  if not coalesce(v_actor_admin, false) then
    raise exception 'No autorizado';
  end if;

  update authorized_emails set status = 'revocado' where email = v_email;

  select id into v_user_id from auth.users where lower(email) = v_email;

  if v_user_id is not null then
    update profiles set user_id = null, claimed_at = null where user_id = v_user_id;
  end if;
end;
$$;

grant execute on function revoke_authorized_email(text) to authenticated;
