-- Prestamos de producto entre las dos usuarias. No tocan products.stock
-- (el stock total del negocio no cambia), solo trazan quien tiene que
-- devolverle que a quien.
create table loans (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete restrict,
  quantity int not null check (quantity > 0),
  from_profile_id uuid not null references profiles (id),
  to_profile_id uuid not null references profiles (id) check (to_profile_id <> from_profile_id),
  loan_date date not null default current_date,
  note text,
  status text not null default 'pendiente' check (status in ('pendiente', 'devuelto')),
  returned_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index loans_status_idx on loans (status);
create index loans_product_idx on loans (product_id);
