-- El negocio deja de asumir exactamente 2 personas fijas (Mama/Yo). Los
-- perfiles pasan a crearse dinámicamente para cualquier cuenta autorizada
-- que entre por primera vez: elige su propio nombre y un color de una
-- lista corta tomada de la paleta de la app. Nada del historial de los 2
-- perfiles existentes se toca (ventas, stock, préstamos siguen apuntando
-- a los mismos profiles.id de siempre).

-- 'slot' era el mecanismo que limitaba el sistema a exactamente 2 filas
-- (constraint unique + check en ('mama','yo')). Ya no hace falta: ahora
-- cualquier cantidad de perfiles conviven libremente.
alter table profiles drop column slot;

-- El check de color se amplía de 2 valores fijos a una paleta corta de 4
-- (ver src/lib/utils/identity-colors.ts para la correspondencia visual).
-- 'turquoise' era el color de quien hoy tiene slot='yo' — se remapea 1:1
-- a 'teal' (mismo tono, solo cambia el nombre de la clave). 'coral' sigue
-- igual.
alter table profiles drop constraint profiles_color_check;

update profiles set color = 'teal' where color = 'turquoise';

alter table profiles add constraint profiles_color_check
  check (color in ('teal', 'coral', 'gold', 'sage'));

-- Ya no existen filas "vacías" (user_id null) para reclamar: cada perfil
-- nuevo se crea directamente CON su user_id vía create_own_profile() de
-- abajo. La política vieja de "reclamar un slot libre" queda sin uso.
drop policy if exists profiles_claim_update on profiles;

-- Limpieza de los 2 perfiles semilla de 0002_profiles.sql SOLO si nunca
-- fueron reclamados (user_id null) — o sea, en un despliegue nuevo que
-- todavía no tuvo usuarias reales. Si este proyecto ya venía en uso, esas
-- 2 filas ya tienen user_id seteado y este delete no les toca ni un dato:
-- siguen ahí con su historial intacto, como pide la consigna. Sin este
-- paso, un despliegue nuevo quedaría con 2 perfiles fantasma ("Mamá"/"Yo"
-- sin cuenta vinculada) apareciendo sueltos en los selectores de la app.
delete from profiles where user_id is null;

-- Crea el perfil propio la primera vez que una cuenta autorizada entra:
-- valida que el correo esté autorizado, que la cuenta no tenga ya un
-- perfil, y que el color elegido sea uno de los predefinidos. Marca el
-- correo como 'activo' en el mismo paso.
create or replace function create_own_profile(p_display_name text, p_color text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_status text;
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  if exists (select 1 from profiles where user_id = auth.uid()) then
    raise exception 'Ya tenés un perfil creado';
  end if;

  if nullif(trim(p_display_name), '') is null then
    raise exception 'Ingresá un nombre para mostrar';
  end if;

  if p_color not in ('teal', 'coral', 'gold', 'sage') then
    raise exception 'Elegí un color de la lista';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select status into v_status from authorized_emails where email = v_email;

  if v_status is null or v_status = 'revocado' then
    raise exception 'Este correo no está autorizado';
  end if;

  insert into profiles (display_name, color, user_id, claimed_at)
  values (trim(p_display_name), p_color, auth.uid(), now())
  returning id into v_profile_id;

  update authorized_emails set status = 'activo' where email = v_email and status = 'pendiente';

  return v_profile_id;
end;
$$;

grant execute on function create_own_profile(text, text) to authenticated;

-- Ya no hay "lugares" que liberar (eso era del modelo de 2 slots fijos):
-- revocar un correo ahora solo le cierra la puerta a futuro. El chequeo
-- de autorización en el callback de login ya bloquea el reingreso antes
-- de llegar a tocar ningún perfil, así que desvincular profiles.user_id
-- no aporta nada en el modelo N — se saca esa parte.
create or replace function revoke_authorized_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_admin boolean;
begin
  select is_admin into v_actor_admin from profiles where user_id = auth.uid();

  if not coalesce(v_actor_admin, false) then
    raise exception 'No autorizado';
  end if;

  update authorized_emails set status = 'revocado' where email = lower(trim(p_email));
end;
$$;

-- Roster para el panel de Equipo: junta cada correo autorizado con el
-- nombre de quien lo invitó y, si ya tiene perfil, su nombre y color.
-- Security definer porque necesita leer auth.users para encontrar el
-- perfil vinculado a cada correo (RLS de profiles/authorized_emails no
-- expone eso a un cliente comun).
create or replace function list_authorized_emails()
returns table (
  id uuid,
  email text,
  status text,
  invited_at timestamptz,
  invited_by_name text,
  profile_display_name text,
  profile_color text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not coalesce((select is_admin from profiles where user_id = auth.uid()), false) then
    raise exception 'No autorizado';
  end if;

  return query
  select
    ae.id,
    ae.email,
    ae.status,
    ae.invited_at,
    inviter.display_name as invited_by_name,
    p.display_name as profile_display_name,
    p.color as profile_color
  from authorized_emails ae
  left join profiles inviter on inviter.id = ae.invited_by
  left join auth.users au on lower(au.email) = ae.email
  left join profiles p on p.user_id = au.id
  order by ae.invited_at desc;
end;
$$;

grant execute on function list_authorized_emails() to authenticated;
