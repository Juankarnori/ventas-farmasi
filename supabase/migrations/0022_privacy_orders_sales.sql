-- Privacidad de Pedidos y Ventas: hoy cualquier usuaria reclamada puede
-- leer (y escribir directamente) los pedidos y ventas de cualquier otra,
-- porque las policies `orders_all` / `sales_all` (0010) solo chequean
-- `is_claimed_user()` sin mirar de quién es la fila. A partir de acá, cada
-- usuaria no-admin solo puede ver/tocar sus propios pedidos y ventas; la
-- administradora (is_admin = true) sigue viendo todo, sin restricción.
--
-- Lo que NO se toca a propósito (ya era compartido de antes por diseño):
-- catálogo, product_variants, variant_stock (inventario combinado) y
-- loans (los préstamos necesariamente involucran a las dos partes). El
-- dashboard de Finanzas también queda alcanzado por este cambio: al leer
-- `sales`/`orders`/`expenses` con el cliente normal (nunca una service key
-- — no existe ninguna en este proyecto, ver createClient() en
-- src/lib/supabase/server.ts), una no-admin pasa a ver ahí solo sus
-- propios números y la administradora sigue viendo el negocio completo
-- (decisión confirmada: Finanzas también queda "por usuaria").
--
-- order_items/sale_items/sale_payments no tienen su propia columna de
-- dueño (no tendría sentido duplicarla) — la visibilidad se resuelve
-- siempre mirando el dueño de la fila padre (orders.created_by /
-- sales.seller_profile_id) via EXISTS.

drop policy if exists orders_all on orders;
drop policy if exists order_items_all on order_items;
drop policy if exists sales_all on sales;
drop policy if exists sale_items_all on sale_items;
drop policy if exists sale_payments_all on sale_payments;

-- orders --------------------------------------------------------------

create policy orders_select on orders
  for select to authenticated
  using (created_by = current_profile_id() or is_admin_user());

create policy orders_insert on orders
  for insert to authenticated
  with check (created_by = current_profile_id());

create policy orders_update on orders
  for update to authenticated
  using (created_by = current_profile_id() or is_admin_user())
  with check (created_by = current_profile_id() or is_admin_user());

create policy orders_delete on orders
  for delete to authenticated
  using (created_by = current_profile_id() or is_admin_user());

-- order_items -----------------------------------------------------------

create policy order_items_select on order_items
  for select to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.created_by = current_profile_id() or is_admin_user())
    )
  );

create policy order_items_insert on order_items
  for insert to authenticated
  with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.created_by = current_profile_id() or is_admin_user())
    )
  );

create policy order_items_update on order_items
  for update to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.created_by = current_profile_id() or is_admin_user())
    )
  )
  with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.created_by = current_profile_id() or is_admin_user())
    )
  );

create policy order_items_delete on order_items
  for delete to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.created_by = current_profile_id() or is_admin_user())
    )
  );

-- sales -----------------------------------------------------------------

create policy sales_select on sales
  for select to authenticated
  using (seller_profile_id = current_profile_id() or is_admin_user());

create policy sales_insert on sales
  for insert to authenticated
  with check (seller_profile_id = current_profile_id());

create policy sales_update on sales
  for update to authenticated
  using (seller_profile_id = current_profile_id() or is_admin_user())
  with check (seller_profile_id = current_profile_id() or is_admin_user());

create policy sales_delete on sales
  for delete to authenticated
  using (seller_profile_id = current_profile_id() or is_admin_user());

-- sale_items --------------------------------------------------------------

create policy sale_items_select on sale_items
  for select to authenticated
  using (
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  );

create policy sale_items_insert on sale_items
  for insert to authenticated
  with check (
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  );

create policy sale_items_update on sale_items
  for update to authenticated
  using (
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  )
  with check (
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  );

create policy sale_items_delete on sale_items
  for delete to authenticated
  using (
    exists (
      select 1 from sales s
      where s.id = sale_items.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  );

-- sale_payments -----------------------------------------------------------
-- La visibilidad de un abono sigue a la venta que paga, no a quién lo
-- tipeó (profile_id acá es "quién registró el abono", no "de quién es la
-- venta" — dos ventas de distintas vendedoras pueden tener abonos
-- cargados por cualquiera de las dos si atendió a la clienta ese día).

create policy sale_payments_select on sale_payments
  for select to authenticated
  using (
    exists (
      select 1 from sales s
      where s.id = sale_payments.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  );

create policy sale_payments_insert on sale_payments
  for insert to authenticated
  with check (
    exists (
      select 1 from sales s
      where s.id = sale_payments.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  );

create policy sale_payments_update on sale_payments
  for update to authenticated
  using (
    exists (
      select 1 from sales s
      where s.id = sale_payments.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  )
  with check (
    exists (
      select 1 from sales s
      where s.id = sale_payments.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  );

create policy sale_payments_delete on sale_payments
  for delete to authenticated
  using (
    exists (
      select 1 from sales s
      where s.id = sale_payments.sale_id
        and (s.seller_profile_id = current_profile_id() or is_admin_user())
    )
  );

-- Clientes es un registro compartido de seguimiento (como Catálogo,
-- Inventario combinado o Préstamos) y NO debe quedar partido por la
-- privacidad nueva de arriba: si Mamá y Yo le vendemos ambas a la misma
-- clienta, las dos necesitamos ver su historial completo, no una mitad
-- cada una. La tabla `customers` en sí ya sigue con su policy
-- `customers_all` (0020, sin filtro de dueño) sin tocar — pero sus
-- estadísticas (historial, total gastado, "lo que más compra", ranking de
-- clientas) se calculan a partir de `sales`/`sale_items`, que sí acaban de
-- quedar restringidas más arriba en este mismo archivo. Por eso hacen
-- falta estas dos funciones `security definer` para saltarse esa
-- restricción únicamente en el contexto acotado de "el historial de una
-- clienta puntual" o "el total agregado por clienta" — nunca "todas las
-- ventas de la usuaria X".
--
-- *** Chequeo de fuga de privacidad ***: ninguna de las dos acepta ni
-- devuelve algo que permita reconstruir el detalle de ventas ajenas fuera
-- de ese contexto. Sí se expone `seller_profile_id` en el historial de una
-- clienta puntual — a propósito: saber quién le vendió cada cosa es
-- información de seguimiento útil (quién conoce mejor sus gustos), no el
-- tipo de dato que la privacidad nueva buscaba esconder.

create or replace function get_customer_purchase_history(p_customer_id uuid)
returns table (
  sale_item_id uuid,
  sale_id uuid,
  sale_date date,
  payment_status text,
  seller_profile_id uuid,
  variant_id uuid,
  product_id uuid,
  quantity int,
  sale_price numeric(12, 2),
  cost_price numeric(12, 2),
  profit numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_claimed_user() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    si.id,
    si.sale_id,
    s.sale_date,
    s.payment_status,
    s.seller_profile_id,
    si.variant_id,
    si.product_id,
    si.quantity,
    si.sale_price,
    si.cost_price,
    si.profit
  from sale_items si
  join sales s on s.id = si.sale_id
  where s.customer_id = p_customer_id
  order by s.sale_date desc;
end;
$$;

grant execute on function get_customer_purchase_history(uuid) to authenticated;

-- Ranking de Clientes por total gastado (lista de /ventas/clientes): mismo
-- motivo — agregado del negocio entero, sin desglosar por usuaria.
create or replace function list_customer_totals()
returns table (
  customer_id uuid,
  total_spent numeric(12, 2),
  purchase_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_claimed_user() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    s.customer_id,
    coalesce(sum(si.sale_price * si.quantity), 0) as total_spent,
    count(distinct s.id) as purchase_count
  from sales s
  join sale_items si on si.sale_id = s.id
  where s.customer_id is not null
    and s.payment_status in ('pagado', 'completado')
  group by s.customer_id;
end;
$$;

grant execute on function list_customer_totals() to authenticated;
