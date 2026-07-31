-- Devuelve true si auth.uid() ya tiene un perfil reclamado (Mama o Yo).
-- security definer para evitar recursion de RLS cuando otras tablas
-- consultan esta funcion.
create or replace function is_claimed_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where user_id = auth.uid()
  );
$$;

alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table stock_movements enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table loans enable row level security;
alter table expenses enable row level security;

-- profiles: cualquier autenticado puede leer (para saber que slots estan
-- libres en la pantalla de reclamo).
create policy profiles_select_authenticated on profiles
  for select to authenticated
  using (true);

-- profiles: reclamar un slot libre. Solo se puede pisar una fila con
-- user_id null, solo seteando el propio uid, y solo si ese uid no tiene
-- ya otro perfil reclamado (evita reclamar dos slots).
create policy profiles_claim_update on profiles
  for update to authenticated
  using (user_id is null)
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from profiles p2 where p2.user_id = auth.uid()
    )
  );

-- Tablas de negocio compartidas: CRUD completo solo para las 2 usuarias
-- ya reclamadas. Este es el limite de seguridad real de la app.
create policy categories_all on categories
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

create policy products_all on products
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

create policy stock_movements_all on stock_movements
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

create policy orders_all on orders
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

create policy order_items_all on order_items
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

create policy sales_all on sales
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

create policy sale_items_all on sale_items
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

create policy loans_all on loans
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

create policy expenses_all on expenses
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());
