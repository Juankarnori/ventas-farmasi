-- Dos perfiles fijos (Mama / Yo). user_id queda null hasta que alguien
-- lo reclama con su cuenta de Google (ver 0010_rls_policies.sql).
create table profiles (
  id uuid primary key default gen_random_uuid(),
  slot text not null unique check (slot in ('mama', 'yo')),
  display_name text not null,
  color text not null check (color in ('turquoise', 'coral')),
  user_id uuid unique references auth.users (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

insert into profiles (slot, display_name, color)
values
  ('mama', 'Mamá', 'turquoise'),
  ('yo', 'Yo', 'coral')
on conflict (slot) do nothing;
