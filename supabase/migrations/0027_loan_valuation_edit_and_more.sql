-- Migración grande, cuatro temas independientes agrupados en un solo
-- archivo para no fragmentar de más — cada sección tiene su propio
-- comentario y se puede leer por separado.

-- =========================================================================
-- 1. Uso personal: valor al costo (informativo, nunca resta de la
--    ganancia — es solo "cuánto representa en dinero lo que se consumió
--    internamente").
-- =========================================================================

alter table personal_use add column unit_cost numeric(12, 2);

-- register_personal_use se redeclara para calcular y guardar el costo
-- unitario de la variante en el momento del registro (mismo criterio que
-- sale_items.cost_price: un snapshot, no un valor que cambie después si
-- se edita el costo del producto).
create or replace function register_personal_use(
  p_variant_id uuid,
  p_quantity int,
  p_note text,
  p_used_at date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_product_id uuid;
  v_cost numeric(12, 2);
  v_current_stock int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad tiene que ser mayor a 0';
  end if;

  select pv.product_id, coalesce(pv.cost_override, p.cost_price)
  into v_product_id, v_cost
  from product_variants pv
  join products p on p.id = pv.product_id
  where pv.id = p_variant_id;

  if v_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  select stock into v_current_stock
  from variant_stock
  where variant_id = p_variant_id and profile_id = v_profile_id
  for update;

  if coalesce(v_current_stock, 0) < p_quantity then
    raise exception 'No tenés suficiente stock propio de este color';
  end if;

  update variant_stock set stock = stock - p_quantity
  where variant_id = p_variant_id and profile_id = v_profile_id;

  insert into personal_use (variant_id, product_id, profile_id, quantity, unit_cost, note, used_at)
  values (
    p_variant_id, v_product_id, v_profile_id, p_quantity, v_cost,
    nullif(trim(coalesce(p_note, '')), ''), coalesce(p_used_at, current_date)
  );

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, note, created_by)
  values (p_variant_id, v_product_id, v_profile_id, 'uso_personal', p_quantity, p_note, v_profile_id);
end;
$$;

-- =========================================================================
-- 2. Préstamos: valorar al costo o a PVP (a qué se pierde si el préstamo
--    termina "vendido" en vez de devuelto) + edición completa de un
--    préstamo (variante/cantidad/valoración mientras está pendiente,
--    método de pago/devolución una vez resuelto).
-- =========================================================================

alter table loans add column valuation_type text not null default 'costo'
  check (valuation_type in ('costo', 'pvp'));
-- unit_cost ya existía (snapshot del costo); unit_price es su par para
-- PVP, capturado siempre en el momento del préstamo (no solo cuando
-- valuation_type='pvp') — así, si más adelante se edita el préstamo y se
-- cambia de tipo de valoración, ya está disponible sin tener que volver a
-- consultar products/product_variants.
alter table loans add column unit_price numeric(12, 2);
alter table loans add column settlement_method text
  check (settlement_method in ('efectivo', 'transferencia', 'producto'));
alter table loans add column settlement_bank_note text;

-- Los préstamos que ya existen no tienen un PVP guardado — mismo criterio
-- que cuando se backfilleó unit_cost en 0015_per_user_stock.sql: se usa
-- el precio de venta actual de la variante como mejor aproximación.
update loans l
set unit_price = coalesce(pv.price_override, p.sale_price)
from product_variants pv
join products p on p.id = pv.product_id
where pv.id = l.variant_id and l.unit_price is null;

alter table loans alter column unit_price set not null;

create or replace function create_loan(
  p_variant_id uuid,
  p_quantity int,
  p_from_profile_id uuid,
  p_to_profile_id uuid,
  p_note text,
  p_valuation_type text default 'costo'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_loan_id uuid;
  v_product_id uuid;
  v_cost numeric(12, 2);
  v_price numeric(12, 2);
  v_owned_stock int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad prestada debe ser mayor a 0';
  end if;

  if p_valuation_type not in ('costo', 'pvp') then
    raise exception 'Tipo de valoración inválido';
  end if;

  select pv.product_id, coalesce(pv.cost_override, p.cost_price), coalesce(pv.price_override, p.sale_price)
  into v_product_id, v_cost, v_price
  from product_variants pv
  join products p on p.id = pv.product_id
  where pv.id = p_variant_id;

  if v_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  select stock into v_owned_stock
  from variant_stock
  where variant_id = p_variant_id and profile_id = p_from_profile_id
  for update;

  if coalesce(v_owned_stock, 0) < p_quantity then
    raise exception 'No podés prestar más de lo que tenés de ese color';
  end if;

  update variant_stock set stock = stock - p_quantity
  where variant_id = p_variant_id and profile_id = p_from_profile_id;

  insert into variant_stock (variant_id, profile_id, stock)
  values (p_variant_id, p_to_profile_id, p_quantity)
  on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

  insert into loans (
    variant_id, product_id, quantity, from_profile_id, to_profile_id, note,
    unit_cost, unit_price, valuation_type, created_by
  )
  values (
    p_variant_id, v_product_id, p_quantity, p_from_profile_id, p_to_profile_id, p_note,
    v_cost, v_price, p_valuation_type, v_profile_id
  )
  returning id into v_loan_id;

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
  values (p_variant_id, v_product_id, p_from_profile_id, 'prestamo_salida', p_quantity, 'loans', v_loan_id, v_profile_id);

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
  values (p_variant_id, v_product_id, p_to_profile_id, 'prestamo_entrada', p_quantity, 'loans', v_loan_id, v_profile_id);

  return v_loan_id;
end;
$$;

-- Edita variante/cantidad/valoración/nota de un préstamo mientras sigue
-- 'pendiente' — el stock ya se movió al crearlo (a diferencia de un
-- pedido pendiente), así que esto revierte el movimiento viejo por
-- completo (le devuelve el stock a quien prestó, se lo saca a quien
-- recibió) y aplica el movimiento nuevo desde cero — funciona igual haya
-- cambiado solo la cantidad o también la variante. Si no alcanza el stock
-- para el cambio nuevo, se revierte también lo ya deshecho antes de
-- fallar, para no dejar el stock a mitad de camino.
create or replace function update_loan(
  p_loan_id uuid,
  p_variant_id uuid,
  p_quantity int,
  p_valuation_type text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_is_admin boolean;
  v_loan record;
  v_new_product_id uuid;
  v_new_cost numeric(12, 2);
  v_new_price numeric(12, 2);
  v_from_stock int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select is_admin into v_is_admin from profiles where id = v_profile_id;

  select * into v_loan from loans where id = p_loan_id for update;
  if v_loan is null then
    raise exception 'Préstamo no encontrado';
  end if;

  if v_loan.from_profile_id <> v_profile_id
     and v_loan.to_profile_id <> v_profile_id
     and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  if v_loan.status <> 'pendiente' then
    raise exception 'Solo se puede editar la variante o la cantidad mientras el préstamo está pendiente. Para uno ya resuelto, podés cambiar cómo se pagó desde acá mismo.';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad prestada debe ser mayor a 0';
  end if;

  if p_valuation_type not in ('costo', 'pvp') then
    raise exception 'Tipo de valoración inválido';
  end if;

  select pv.product_id, coalesce(pv.cost_override, p.cost_price), coalesce(pv.price_override, p.sale_price)
  into v_new_product_id, v_new_cost, v_new_price
  from product_variants pv
  join products p on p.id = pv.product_id
  where pv.id = p_variant_id;

  if v_new_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  -- Revierte el movimiento viejo por completo.
  update variant_stock set stock = stock + v_loan.quantity
  where variant_id = v_loan.variant_id and profile_id = v_loan.from_profile_id;

  update variant_stock set stock = stock - v_loan.quantity
  where variant_id = v_loan.variant_id and profile_id = v_loan.to_profile_id;

  -- Aplica el movimiento nuevo, con el mismo chequeo de stock que
  -- create_loan.
  select stock into v_from_stock
  from variant_stock
  where variant_id = p_variant_id and profile_id = v_loan.from_profile_id
  for update;

  if coalesce(v_from_stock, 0) < p_quantity then
    -- No alcanza: se deshace lo revertido arriba antes de fallar, para
    -- que el stock quede exactamente como estaba antes de este intento.
    update variant_stock set stock = stock - v_loan.quantity
    where variant_id = v_loan.variant_id and profile_id = v_loan.from_profile_id;

    update variant_stock set stock = stock + v_loan.quantity
    where variant_id = v_loan.variant_id and profile_id = v_loan.to_profile_id;

    raise exception 'Quien presta no tiene suficiente stock propio de este color para este cambio.';
  end if;

  insert into variant_stock (variant_id, profile_id, stock)
  values (p_variant_id, v_loan.from_profile_id, -p_quantity)
  on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

  insert into variant_stock (variant_id, profile_id, stock)
  values (p_variant_id, v_loan.to_profile_id, p_quantity)
  on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

  update loans
  set variant_id = p_variant_id,
      product_id = v_new_product_id,
      quantity = p_quantity,
      valuation_type = p_valuation_type,
      unit_cost = v_new_cost,
      unit_price = v_new_price,
      note = p_note
  where id = p_loan_id;

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by)
  values (p_variant_id, v_new_product_id, v_loan.from_profile_id, 'ajuste_manual', p_quantity, 'loans', p_loan_id, 'Edición de préstamo', v_profile_id);
end;
$$;

-- Registra cómo se pagó/devolvió un préstamo ya resuelto (devuelto o
-- vendido) — no toca stock ni cantidades, así que no tiene las
-- restricciones de update_loan.
create or replace function update_loan_settlement(
  p_loan_id uuid,
  p_settlement_method text,
  p_settlement_bank_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_is_admin boolean;
  v_loan record;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select is_admin into v_is_admin from profiles where id = v_profile_id;

  select * into v_loan from loans where id = p_loan_id;
  if v_loan is null then
    raise exception 'Préstamo no encontrado';
  end if;

  if v_loan.from_profile_id <> v_profile_id
     and v_loan.to_profile_id <> v_profile_id
     and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  if v_loan.status = 'pendiente' then
    raise exception 'Este préstamo todavía está pendiente — marcalo como devuelto o vendido primero.';
  end if;

  if p_settlement_method not in ('efectivo', 'transferencia', 'producto') then
    raise exception 'Método inválido';
  end if;

  update loans
  set settlement_method = p_settlement_method,
      settlement_bank_note = case
        when p_settlement_method = 'transferencia' then nullif(trim(coalesce(p_settlement_bank_note, '')), '')
        else null
      end
  where id = p_loan_id;
end;
$$;

grant execute on function update_loan(uuid, uuid, int, text, text) to authenticated;
grant execute on function update_loan_settlement(uuid, text, text) to authenticated;

-- =========================================================================
-- 3. Clientes: borrar (o archivar si tiene historial que no es seguro
--    perder silenciosamente).
-- =========================================================================

alter table customers add column archived_at timestamptz;

-- sales.customer_id ya es "on delete set null" y follow_up_tasks.customer_id
-- ya es "on delete cascade" — un DELETE directo sobre customers NUNCA
-- rompería por una foreign key. El problema no es que falle, es que sea
-- silencioso: borrar a una clienta con ventas le desvincula el historial
-- sin avisar, y borrar a una con seguimientos pendientes se los borra sin
-- que quede rastro. Por eso, en vez de dejar que el DELETE directo pase
-- de largo, esta función solo borra de verdad cuando no hay nada que
-- perder — si hay ventas o seguimientos asociados, archiva en su lugar
-- (deja de aparecer en el listado, pero se conserva todo tal cual).
create or replace function delete_customer(p_customer_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_history boolean;
begin
  if not is_claimed_user() then
    raise exception 'No autorizado';
  end if;

  select exists (
    select 1 from sales where customer_id = p_customer_id
    union all
    select 1 from follow_up_tasks where customer_id = p_customer_id
  ) into v_has_history;

  if v_has_history then
    update customers set archived_at = now() where id = p_customer_id;
    return 'archived';
  end if;

  delete from customers where id = p_customer_id;
  return 'deleted';
end;
$$;

grant execute on function delete_customer(uuid) to authenticated;
