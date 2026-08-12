-- Ventas/apartados con stock insuficiente: en vez de bloquear la
-- operación, se completa igual — se descuenta lo que sí haya disponible
-- (nunca en negativo) y la diferencia queda registrada como "pendiente de
-- comprar" en el propio renglón. Se resuelve sola cuando se recibe un
-- pedido que cubra esa misma variante (ver mark_order_received más
-- abajo), o manualmente si se prefiere resolverlo de otra forma
-- (préstamo, ajuste manual).
--
-- Decisión de prioridad cuando varias ventas de la misma usuaria tienen
-- pendiente la misma variante y el pedido recibido no alcanza para
-- todas: se resuelve por orden de `sale_date` ascendente (la venta más
-- antigua primero). Es el mismo criterio que ya usa "Hoy toca
-- contactar"/reglas de seguimiento (lo más viejo es lo más urgente) y
-- evita que una venta quede eternamente pendiente mientras se van
-- resolviendo siempre las más nuevas.
alter table sale_items
  add column pending_purchase_quantity int not null default 0
  check (pending_purchase_quantity >= 0 and pending_purchase_quantity <= quantity);

-- create_sale / create_apartado -----------------------------------------
-- Firma sin cambios, pero el cuerpo sí: ya no rechazan la venta por falta
-- de stock.

drop function if exists create_sale(text, date, jsonb, uuid, text, text);
drop function if exists create_apartado(text, text, date, jsonb, uuid, text, text);

create or replace function create_sale(
  p_customer_name text,
  p_sale_date date,
  p_items jsonb,
  p_customer_id uuid default null,
  p_payment_method text default 'efectivo',
  p_bank_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_sale_id uuid;
  item jsonb;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty int;
  v_sale_price numeric(12, 2);
  v_cost numeric(12, 2);
  v_owned_stock int;
  v_to_subtract int;
  v_pending int;
  v_first_product_name text;
  v_total numeric(12, 2) := 0;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if p_payment_method not in ('efectivo', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + ((item ->> 'quantity')::int * (item ->> 'sale_price')::numeric);
  end loop;

  insert into sales (
    sale_date, customer_name, customer_id, seller_profile_id, total_price, payment_method, bank_note
  )
  values (
    coalesce(p_sale_date, current_date),
    nullif(p_customer_name, ''),
    p_customer_id,
    v_profile_id,
    v_total,
    p_payment_method,
    case when p_payment_method = 'transferencia' then nullif(trim(coalesce(p_bank_note, '')), '') else null end
  )
  returning id into v_sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (item ->> 'variant_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_sale_price := (item ->> 'sale_price')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para variante %', v_variant_id;
    end if;

    select pv.product_id, coalesce(pv.cost_override, p.cost_price)
    into v_product_id, v_cost
    from product_variants pv
    join products p on p.id = pv.product_id
    where pv.id = v_variant_id;

    if v_product_id is null then
      raise exception 'Variante % no encontrada', v_variant_id;
    end if;

    if v_first_product_name is null then
      select name into v_first_product_name from products where id = v_product_id;
    end if;

    select stock into v_owned_stock
    from variant_stock
    where variant_id = v_variant_id and profile_id = v_profile_id
    for update;

    -- Ya no bloquea por falta de stock propio: descuenta hasta donde
    -- alcance (nunca negativo) y lo que falte queda registrado como
    -- pendiente de comprar en este mismo renglón — ver
    -- pending_purchase_quantity / list_purchase_needed().
    v_to_subtract := least(coalesce(v_owned_stock, 0), v_qty);
    v_pending := v_qty - v_to_subtract;

    insert into sale_items (
      sale_id, variant_id, product_id, quantity, sale_price, cost_price, pending_purchase_quantity
    )
    values (v_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost, v_pending);

    if v_to_subtract > 0 then
      update variant_stock set stock = stock - v_to_subtract
      where variant_id = v_variant_id and profile_id = v_profile_id;

      insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
      values (v_variant_id, v_product_id, v_profile_id, 'salida_venta', v_to_subtract, 'sales', v_sale_id, v_profile_id);
    end if;
  end loop;

  perform create_follow_up_tasks_for_sale(
    v_sale_id, p_customer_id, coalesce(p_sale_date, current_date), v_first_product_name
  );

  return v_sale_id;
end;
$$;

create or replace function create_apartado(
  p_customer_name text,
  p_customer_phone text,
  p_sale_date date,
  p_items jsonb,
  p_customer_id uuid default null,
  p_payment_method text default 'efectivo',
  p_bank_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_sale_id uuid;
  item jsonb;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty int;
  v_sale_price numeric(12, 2);
  v_cost numeric(12, 2);
  v_owned_stock int;
  v_to_subtract int;
  v_pending int;
  v_total numeric(12, 2) := 0;
  v_first_product_name text;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if p_payment_method not in ('efectivo', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'El apartado necesita al menos un producto';
  end if;

  if nullif(trim(p_customer_name), '') is null then
    raise exception 'El apartado necesita el nombre de la clienta';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + ((item ->> 'quantity')::int * (item ->> 'sale_price')::numeric);
  end loop;

  insert into sales (
    sale_date, customer_name, customer_phone, customer_id, seller_profile_id, payment_status, total_price,
    payment_method, bank_note
  )
  values (
    coalesce(p_sale_date, current_date),
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''),
    p_customer_id,
    v_profile_id,
    'con_abonos',
    v_total,
    p_payment_method,
    case when p_payment_method = 'transferencia' then nullif(trim(coalesce(p_bank_note, '')), '') else null end
  )
  returning id into v_sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (item ->> 'variant_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_sale_price := (item ->> 'sale_price')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para variante %', v_variant_id;
    end if;

    select pv.product_id, coalesce(pv.cost_override, p.cost_price)
    into v_product_id, v_cost
    from product_variants pv
    join products p on p.id = pv.product_id
    where pv.id = v_variant_id;

    if v_product_id is null then
      raise exception 'Variante % no encontrada', v_variant_id;
    end if;

    if v_first_product_name is null then
      select name into v_first_product_name from products where id = v_product_id;
    end if;

    select stock into v_owned_stock
    from variant_stock
    where variant_id = v_variant_id and profile_id = v_profile_id
    for update;

    v_to_subtract := least(coalesce(v_owned_stock, 0), v_qty);
    v_pending := v_qty - v_to_subtract;

    insert into sale_items (
      sale_id, variant_id, product_id, quantity, sale_price, cost_price, delivered, pending_purchase_quantity
    )
    values (v_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost, false, v_pending);

    if v_to_subtract > 0 then
      update variant_stock set stock = stock - v_to_subtract
      where variant_id = v_variant_id and profile_id = v_profile_id;

      insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
      values (v_variant_id, v_product_id, v_profile_id, 'salida_venta', v_to_subtract, 'sales', v_sale_id, v_profile_id);
    end if;
  end loop;

  perform create_follow_up_tasks_for_sale(
    v_sale_id, p_customer_id, coalesce(p_sale_date, current_date), v_first_product_name
  );

  return v_sale_id;
end;
$$;

grant execute on function create_sale(text, date, jsonb, uuid, text, text) to authenticated;
grant execute on function create_apartado(text, text, date, jsonb, uuid, text, text) to authenticated;

-- list_purchase_needed() -------------------------------------------------
-- Agregado de todo lo pendiente de comprar en el negocio, sumado entre
-- todas las ventas/apartados que necesiten la misma variante — data de la
-- pestaña "Comprar". Compartido para todo el equipo (mismo criterio que
-- Catálogo/Inventario combinado): no importa quién vendió, si hace falta
-- reponerlo es información del negocio entero.
create or replace function list_purchase_needed()
returns table (
  variant_id uuid,
  product_id uuid,
  product_name text,
  color_name text,
  sku text,
  quantity_needed bigint,
  oldest_pending_since date
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
    si.variant_id,
    si.product_id,
    p.name,
    pv.color_name,
    pv.sku,
    sum(si.pending_purchase_quantity) as quantity_needed,
    min(s.sale_date) as oldest_pending_since
  from sale_items si
  join sales s on s.id = si.sale_id
  join products p on p.id = si.product_id
  join product_variants pv on pv.id = si.variant_id
  where si.pending_purchase_quantity > 0
  group by si.variant_id, si.product_id, p.name, pv.color_name, pv.sku
  order by min(s.sale_date) asc;
end;
$$;

grant execute on function list_purchase_needed() to authenticated;

-- mark_order_received: reconciliación automática ------------------------
-- Firma sin cambios (p_order_id uuid) — se agrega el paso de
-- reconciliación al final de cada renglón recibido, sin tocar lo demás.
create or replace function mark_order_received(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_order_owner uuid;
  r record;
  v_pending_item record;
  v_remaining int;
  v_resolved int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select created_by into v_order_owner from orders where id = p_order_id and status = 'pendiente';

  if v_order_owner is null then
    raise exception 'Pedido no encontrado o ya recibido';
  end if;

  for r in select variant_id, product_id, quantity from order_items where order_id = p_order_id loop
    insert into variant_stock (variant_id, profile_id, stock)
    values (r.variant_id, v_order_owner, r.quantity)
    on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
    values (r.variant_id, r.product_id, v_order_owner, 'entrada_pedido', r.quantity, 'orders', p_order_id, v_profile_id);

    -- Reconciliación automática: de lo que se acaba de recibir de esta
    -- variante, resuelve primero las ventas más antiguas (por
    -- sale_date, ver nota arriba) de la MISMA usuaria que tengan
    -- pendiente de comprar esa variante — el stock recién sumado arriba
    -- queda "reservado" para esas ventas en vez de quedar libre como si
    -- nada le debiera a nadie. Nunca cruza stock entre usuarias: solo
    -- mira ventas de v_order_owner (si el pendiente es de la otra
    -- persona, ella lo resuelve con su propio pedido o pidiendo
    -- prestado — mismo criterio de separación de cuentas que ya rige el
    -- resto del sistema).
    v_remaining := r.quantity;

    for v_pending_item in
      select si.id, si.pending_purchase_quantity
      from sale_items si
      join sales s on s.id = si.sale_id
      where si.variant_id = r.variant_id
        and si.pending_purchase_quantity > 0
        and s.seller_profile_id = v_order_owner
      order by s.sale_date asc, si.id asc
    loop
      exit when v_remaining <= 0;

      v_resolved := least(v_remaining, v_pending_item.pending_purchase_quantity);

      update sale_items
      set pending_purchase_quantity = pending_purchase_quantity - v_resolved
      where id = v_pending_item.id;

      v_remaining := v_remaining - v_resolved;
    end loop;

    if v_remaining < r.quantity then
      update variant_stock set stock = stock - (r.quantity - v_remaining)
      where variant_id = r.variant_id and profile_id = v_order_owner;

      insert into stock_movements (
        variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by
      )
      values (
        r.variant_id, r.product_id, v_order_owner, 'ajuste_manual', (r.quantity - v_remaining), 'orders', p_order_id,
        'Reservado automáticamente: había venta(s) con esta variante pendiente de comprar',
        v_profile_id
      );
    end if;
  end loop;

  update orders set status = 'recibido', received_at = now() where id = p_order_id;
end;
$$;

-- delete_sale: fix necesario ----------------------------------------------
-- Antes revertía la cantidad COMPLETA de cada renglón al stock. Si el
-- renglón tenía pending_purchase_quantity > 0 (venta con compra
-- pendiente), esa porción nunca había salido del inventario para
-- empezar — devolverla igual habría creado stock fantasma. Ahora solo
-- revierte lo que de verdad se descontó (quantity - pending_purchase_quantity).
create or replace function delete_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_is_admin boolean;
  v_sale record;
  r record;
  v_to_return int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select is_admin into v_is_admin from profiles where id = v_profile_id;

  select * into v_sale from sales where id = p_sale_id for update;
  if v_sale is null then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale.seller_profile_id <> v_profile_id and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  for r in select variant_id, product_id, quantity, pending_purchase_quantity from sale_items where sale_id = p_sale_id loop
    v_to_return := r.quantity - r.pending_purchase_quantity;
    if v_to_return <= 0 then
      continue;
    end if;

    insert into variant_stock (variant_id, profile_id, stock)
    values (r.variant_id, v_sale.seller_profile_id, v_to_return)
    on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by)
    values (r.variant_id, r.product_id, v_sale.seller_profile_id, 'ajuste_manual', v_to_return, 'sales', p_sale_id, 'Venta eliminada', v_profile_id);
  end loop;

  delete from follow_up_tasks where sale_id = p_sale_id;

  delete from sales where id = p_sale_id;
end;
$$;

-- update_sale_items / update_apartado_items ------------------------------
-- Mismo criterio que create_sale/create_apartado (ya no bloquean por
-- falta de stock) + mismo fix que delete_sale (no asumir que la cantidad
-- vieja completa había sido descontada del stock: si tenía pendiente de
-- comprar, esa porción nunca salió del inventario).
--
-- En vez del modelo de "delta" anterior (positivo = sacar más, negativo =
-- devolver, asumiendo que TODO lo viejo estaba en el stock), ahora cada
-- variante afectada se resuelve en dos pasos: (1) devolver exactamente lo
-- que el renglón viejo sí había descontado, (2) volver a descontar según
-- la cantidad nueva, hasta donde alcance — igual que una venta nueva. El
-- pendiente resultante por variante se guarda en dos arrays paralelos
-- (variant_id / cantidad pendiente) y se reparte entre los renglones
-- nuevos al reinsertarlos, en el orden en que vienen (normal: uno solo
-- por variante).

create or replace function update_sale_items(
  p_sale_id uuid,
  p_items jsonb,
  p_payment_method text default 'efectivo',
  p_bank_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_is_admin boolean;
  v_sale record;
  d record;
  item jsonb;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty int;
  v_sale_price numeric(12, 2);
  v_cost numeric(12, 2);
  v_owned_stock int;
  v_new_subtract int;
  v_new_pending int;
  v_total numeric(12, 2) := 0;
  v_pending_variant_ids uuid[] := '{}';
  v_pending_amounts int[] := '{}';
  v_idx int;
  v_row_pending int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select is_admin into v_is_admin from profiles where id = v_profile_id;

  select * into v_sale from sales where id = p_sale_id for update;
  if v_sale is null then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale.seller_profile_id <> v_profile_id and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  if v_sale.payment_status <> 'pagado' then
    raise exception 'Solo se pueden editar los productos de una venta de contado. Para un apartado, editá el método de pago desde su ficha.';
  end if;

  if p_payment_method not in ('efectivo', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto';
  end if;

  for d in
    with old_qty as (
      select variant_id, sum(quantity) as quantity, sum(pending_purchase_quantity) as pending
      from sale_items
      where sale_id = p_sale_id
      group by variant_id
    ),
    new_qty as (
      select (i ->> 'variant_id')::uuid as variant_id,
             sum((i ->> 'quantity')::int) as quantity
      from jsonb_array_elements(p_items) as i
      group by (i ->> 'variant_id')::uuid
    )
    select
      coalesce(o.variant_id, n.variant_id) as variant_id,
      coalesce(o.quantity, 0) - coalesce(o.pending, 0) as old_subtracted,
      coalesce(n.quantity, 0) as new_quantity
    from old_qty o
    full outer join new_qty n on n.variant_id = o.variant_id
  loop
    if d.old_subtracted = 0 and d.new_quantity = 0 then
      continue;
    end if;

    select product_id into v_product_id from product_variants where id = d.variant_id;
    if v_product_id is null then
      raise exception 'Variante % no encontrada', d.variant_id;
    end if;

    -- El stock que se ajusta es el de la VENDEDORA original de la venta
    -- (v_sale.seller_profile_id), no el de quien está editando.
    if d.old_subtracted > 0 then
      insert into variant_stock (variant_id, profile_id, stock)
      values (d.variant_id, v_sale.seller_profile_id, d.old_subtracted)
      on conflict (variant_id, profile_id) do update
      set stock = variant_stock.stock + excluded.stock;
    end if;

    if d.new_quantity > 0 then
      select stock into v_owned_stock
      from variant_stock
      where variant_id = d.variant_id and profile_id = v_sale.seller_profile_id
      for update;

      v_new_subtract := least(coalesce(v_owned_stock, 0), d.new_quantity);
      v_new_pending := d.new_quantity - v_new_subtract;

      if v_new_subtract > 0 then
        update variant_stock set stock = stock - v_new_subtract
        where variant_id = d.variant_id and profile_id = v_sale.seller_profile_id;
      end if;
    else
      v_new_subtract := 0;
      v_new_pending := 0;
    end if;

    v_pending_variant_ids := array_append(v_pending_variant_ids, d.variant_id);
    v_pending_amounts := array_append(v_pending_amounts, v_new_pending);

    if d.old_subtracted <> v_new_subtract then
      insert into stock_movements (
        variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by
      )
      values (
        d.variant_id, v_product_id, v_sale.seller_profile_id, 'ajuste_venta',
        abs(d.old_subtracted - v_new_subtract), 'sales', p_sale_id,
        case
          when v_new_subtract > d.old_subtracted then 'Edición de venta: se aumentó la cantidad'
          else 'Edición de venta: se redujo la cantidad o se quitó el producto'
        end,
        v_profile_id
      );
    end if;
  end loop;

  delete from sale_items where sale_id = p_sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (item ->> 'variant_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_sale_price := (item ->> 'sale_price')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para variante %', v_variant_id;
    end if;

    select pv.product_id, coalesce(pv.cost_override, p.cost_price)
    into v_product_id, v_cost
    from product_variants pv
    join products p on p.id = pv.product_id
    where pv.id = v_variant_id;

    if v_product_id is null then
      raise exception 'Variante % no encontrada', v_variant_id;
    end if;

    select array_position(v_pending_variant_ids, v_variant_id) into v_idx;
    if v_idx is not null then
      v_row_pending := least(v_qty, v_pending_amounts[v_idx]);
      v_pending_amounts[v_idx] := v_pending_amounts[v_idx] - v_row_pending;
    else
      v_row_pending := 0;
    end if;

    insert into sale_items (sale_id, variant_id, product_id, quantity, sale_price, cost_price, pending_purchase_quantity)
    values (p_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost, v_row_pending);

    v_total := v_total + (v_qty * v_sale_price);
  end loop;

  update sales
  set total_price = v_total,
      payment_method = p_payment_method,
      bank_note = case when p_payment_method = 'transferencia' then nullif(trim(coalesce(p_bank_note, '')), '') else null end
  where id = p_sale_id;
end;
$$;

create or replace function update_apartado_items(
  p_sale_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_is_admin boolean;
  v_sale record;
  v_amount_paid numeric(12, 2);
  d record;
  item jsonb;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty int;
  v_sale_price numeric(12, 2);
  v_cost numeric(12, 2);
  v_owned_stock int;
  v_new_subtract int;
  v_new_pending int;
  v_total numeric(12, 2) := 0;
  v_pending_variant_ids uuid[] := '{}';
  v_pending_amounts int[] := '{}';
  v_idx int;
  v_row_pending int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select is_admin into v_is_admin from profiles where id = v_profile_id;

  select * into v_sale from sales where id = p_sale_id for update;
  if v_sale is null then
    raise exception 'Apartado no encontrado';
  end if;

  if v_sale.seller_profile_id <> v_profile_id and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  if v_sale.payment_status not in ('con_abonos', 'completado') then
    raise exception 'Solo se pueden editar los productos de un apartado que sigue abierto';
  end if;

  if exists (select 1 from sale_items where sale_id = p_sale_id and delivered = true) then
    raise exception 'Ya entregaste productos de este apartado, así que no se pueden editar. Si hace falta corregirlo, cancelalo en su lugar.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'El apartado necesita al menos un producto';
  end if;

  select coalesce(sum(amount), 0) into v_amount_paid from sale_payments where sale_id = p_sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + ((item ->> 'quantity')::int * (item ->> 'sale_price')::numeric);
  end loop;

  if v_total < v_amount_paid then
    raise exception 'El nuevo total no puede ser menor a lo ya abonado ($%). Ajustá los productos o revisá los abonos primero.',
      trim(to_char(v_amount_paid, 'FM999999990.00'));
  end if;

  for d in
    with old_qty as (
      select variant_id, sum(quantity) as quantity, sum(pending_purchase_quantity) as pending
      from sale_items
      where sale_id = p_sale_id
      group by variant_id
    ),
    new_qty as (
      select (i ->> 'variant_id')::uuid as variant_id,
             sum((i ->> 'quantity')::int) as quantity
      from jsonb_array_elements(p_items) as i
      group by (i ->> 'variant_id')::uuid
    )
    select
      coalesce(o.variant_id, n.variant_id) as variant_id,
      coalesce(o.quantity, 0) - coalesce(o.pending, 0) as old_subtracted,
      coalesce(n.quantity, 0) as new_quantity
    from old_qty o
    full outer join new_qty n on n.variant_id = o.variant_id
  loop
    if d.old_subtracted = 0 and d.new_quantity = 0 then
      continue;
    end if;

    select product_id into v_product_id from product_variants where id = d.variant_id;
    if v_product_id is null then
      raise exception 'Variante % no encontrada', d.variant_id;
    end if;

    if d.old_subtracted > 0 then
      insert into variant_stock (variant_id, profile_id, stock)
      values (d.variant_id, v_sale.seller_profile_id, d.old_subtracted)
      on conflict (variant_id, profile_id) do update
      set stock = variant_stock.stock + excluded.stock;
    end if;

    if d.new_quantity > 0 then
      select stock into v_owned_stock
      from variant_stock
      where variant_id = d.variant_id and profile_id = v_sale.seller_profile_id
      for update;

      v_new_subtract := least(coalesce(v_owned_stock, 0), d.new_quantity);
      v_new_pending := d.new_quantity - v_new_subtract;

      if v_new_subtract > 0 then
        update variant_stock set stock = stock - v_new_subtract
        where variant_id = d.variant_id and profile_id = v_sale.seller_profile_id;
      end if;
    else
      v_new_subtract := 0;
      v_new_pending := 0;
    end if;

    v_pending_variant_ids := array_append(v_pending_variant_ids, d.variant_id);
    v_pending_amounts := array_append(v_pending_amounts, v_new_pending);

    if d.old_subtracted <> v_new_subtract then
      insert into stock_movements (
        variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by
      )
      values (
        d.variant_id, v_product_id, v_sale.seller_profile_id, 'ajuste_venta',
        abs(d.old_subtracted - v_new_subtract), 'sales', p_sale_id,
        case
          when v_new_subtract > d.old_subtracted then 'Edición de apartado: se aumentó la cantidad'
          else 'Edición de apartado: se redujo la cantidad o se quitó el producto'
        end,
        v_profile_id
      );
    end if;
  end loop;

  delete from sale_items where sale_id = p_sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (item ->> 'variant_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_sale_price := (item ->> 'sale_price')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para variante %', v_variant_id;
    end if;

    select pv.product_id, coalesce(pv.cost_override, p.cost_price)
    into v_product_id, v_cost
    from product_variants pv
    join products p on p.id = pv.product_id
    where pv.id = v_variant_id;

    if v_product_id is null then
      raise exception 'Variante % no encontrada', v_variant_id;
    end if;

    select array_position(v_pending_variant_ids, v_variant_id) into v_idx;
    if v_idx is not null then
      v_row_pending := least(v_qty, v_pending_amounts[v_idx]);
      v_pending_amounts[v_idx] := v_pending_amounts[v_idx] - v_row_pending;
    else
      v_row_pending := 0;
    end if;

    insert into sale_items (sale_id, variant_id, product_id, quantity, sale_price, cost_price, delivered, pending_purchase_quantity)
    values (p_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost, false, v_row_pending);
  end loop;

  update sales
  set total_price = v_total,
      payment_status = case when v_amount_paid >= v_total then 'completado' else 'con_abonos' end
  where id = p_sale_id;
end;
$$;

grant execute on function update_sale_items(uuid, jsonb, text, text) to authenticated;
grant execute on function update_apartado_items(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
