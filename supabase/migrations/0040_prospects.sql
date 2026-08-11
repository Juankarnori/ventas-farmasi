-- Prospectos: posibles clientas (todavía no compraron), separado de
-- `customers` — un prospecto puede terminar convirtiéndose en clienta
-- real (convertProspectToCustomer del lado de la app crea el registro
-- en `customers` y marca este como 'convertido') o quedar descartado.
-- Compartido entre usuarias, mismo criterio que `customers`: el
-- seguimiento le sirve al equipo entero, no tiene sentido partirlo por
-- usuaria.
create table prospects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  -- 'ingreso' = interesada en sumarse como vendedora; 'venta' =
  -- interesada en comprar.
  type text not null check (type in ('ingreso', 'venta')),
  note text,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'contactado', 'convertido', 'descartado')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index prospects_status_idx on prospects (status);

alter table prospects enable row level security;

create policy prospects_all on prospects
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

-- Citas de seguimiento con un prospecto (ej. llamada agendada). Un
-- prospecto puede tener varias a lo largo del tiempo.
create table prospect_appointments (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects (id) on delete cascade,
  scheduled_at timestamptz not null,
  note text,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'completada', 'cancelada')),
  -- Pensado para la versión de recordatorio por push (cron cada 1-5 min
  -- que busca citas entre 10 y 5 minutos en el futuro): evita mandar el
  -- mismo aviso dos veces. La versión actualmente implementada es un
  -- banner dentro de la app (no hay infraestructura de push todavía),
  -- que no necesita este campo para funcionar — queda ya preparado en el
  -- esquema para cuando se agregue push más adelante, sin otra migración.
  reminder_sent boolean not null default false,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index prospect_appointments_prospect_idx on prospect_appointments (prospect_id);
create index prospect_appointments_pending_idx on prospect_appointments (scheduled_at)
  where status = 'pendiente';

alter table prospect_appointments enable row level security;

create policy prospect_appointments_all on prospect_appointments
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());
