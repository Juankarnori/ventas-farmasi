-- Método de pago por venta + edición de una venta ya registrada.
--
-- payment_method/bank_note: default 'efectivo' para no romper las ventas
-- que ya existen (todas quedan marcadas como efectivo, que es lo que
-- eran de hecho antes de que este campo existiera). bank_note solo tiene
-- sentido con 'transferencia' — las funciones de abajo lo fuerzan a null
-- si el método es 'efectivo', para que nunca quede una nota de banco
-- "colgada" en una venta en efectivo.
alter table sales add column payment_method text not null default 'efectivo'
  check (payment_method in ('efectivo', 'transferencia'));
alter table sales add column bank_note text;

-- Nuevo tipo de movimiento para distinguir en el historial de Inventario
-- un ajuste de stock que vino de corregir una venta (update_sale_items)
-- de uno manual de verdad (ajuste_manual) o de una venta nueva
-- (salida_venta).
alter table stock_movements drop constraint stock_movements_type_check;
alter table stock_movements add constraint stock_movements_type_check check (
  type in (
    'entrada_pedido',
    'salida_venta',
    'ajuste_manual',
    'prestamo',
    'prestamo_salida',
    'prestamo_entrada',
    'devolucion_salida',
    'devolucion_entrada',
    'apartado_cancelado',
    'ajuste_venta'
  )
);

-- create_sale / create_apartado: se agregan p_payment_method/p_bank_note
-- al final, con default, así que `create or replace` alcanza sin romper
-- ninguna llamada existente. El resto del cuerpo es idéntico al de
-- 0024_fix_sale_total_price.sql.

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

    if coalesce(v_owned_stock, 0) < v_qty then
      raise exception 'No tenés suficiente stock propio de este color. ¿Es un producto prestado? Registrá el préstamo primero.';
    end if;

    insert into sale_items (sale_id, variant_id, product_id, quantity, sale_price, cost_price)
    values (v_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost);

    update variant_stock set stock = stock - v_qty
    where variant_id = v_variant_id and profile_id = v_profile_id;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
    values (v_variant_id, v_product_id, v_profile_id, 'salida_venta', v_qty, 'sales', v_sale_id, v_profile_id);
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

    if coalesce(v_owned_stock, 0) < v_qty then
      raise exception 'No tenés suficiente stock propio de este color. ¿Es un producto prestado? Registrá el préstamo primero.';
    end if;

    insert into sale_items (sale_id, variant_id, product_id, quantity, sale_price, cost_price, delivered)
    values (v_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost, false);

    update variant_stock set stock = stock - v_qty
    where variant_id = v_variant_id and profile_id = v_profile_id;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
    values (v_variant_id, v_product_id, v_profile_id, 'salida_venta', v_qty, 'sales', v_sale_id, v_profile_id);
  end loop;

  perform create_follow_up_tasks_for_sale(
    v_sale_id, p_customer_id, coalesce(p_sale_date, current_date), v_first_product_name
  );

  return v_sale_id;
end;
$$;

-- Edita los productos/cantidades/precios de una venta YA registrada.
-- Solo para ventas de contado (payment_status = 'pagado'): un apartado ya
-- tiene abonos (sale_payments) contados contra su total_price, y algunos
-- de sus items pueden estar marcados `delivered` — tocar productos ahí
-- arriesga dejar un saldo inconsistente (abonado > nuevo total) o perder
-- silenciosamente el registro de qué ya se entregó. Para un apartado, el
-- método de pago se edita aparte con update_sale_payment_method(), sin
-- tocar productos — es el atajo de alcance que se dejó explícito en el
-- pedido original.
--
-- El stock se ajusta por la DIFERENCIA entre lo que había y lo que se
-- está guardando ahora, no reemplazando a ciegas: si una variante baja de
-- cantidad (o se quita del todo), la diferencia vuelve al stock de la
-- vendedora; si sube (o es una variante nueva), se le descuenta esa
-- diferencia — y si no le alcanza el stock propio, se bloquea con el
-- mismo mensaje que ya usa create_sale.
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
  v_total numeric(12, 2) := 0;
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

  -- Delta de stock por variante: positivo = hay que sacarle más stock a
  -- la vendedora; negativo = hay que devolverle. El full outer join entre
  -- lo que había (agrupado, por si el mismo color quedó repetido en más
  -- de un renglón viejo) y lo que se está guardando ahora cubre productos
  -- quitados, agregados, o con la cantidad cambiada, todo en una pasada.
  for d in
    with old_qty as (
      select variant_id, sum(quantity) as quantity
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
      coalesce(n.quantity, 0) - coalesce(o.quantity, 0) as delta
    from old_qty o
    full outer join new_qty n on n.variant_id = o.variant_id
  loop
    if d.delta = 0 then
      continue;
    end if;

    select product_id into v_product_id from product_variants where id = d.variant_id;
    if v_product_id is null then
      raise exception 'Variante % no encontrada', d.variant_id;
    end if;

    -- El stock que se ajusta es el de la VENDEDORA original de la venta
    -- (v_sale.seller_profile_id), no el de quien está editando —
    -- distinción real si una admin corrige la venta de otra usuaria: el
    -- stock tiene que moverse en la cuenta de quien la vendió, no en la
    -- de la admin. `created_by` sigue siendo quien hizo el cambio.
    if d.delta > 0 then
      select stock into v_owned_stock
      from variant_stock
      where variant_id = d.variant_id and profile_id = v_sale.seller_profile_id
      for update;

      if coalesce(v_owned_stock, 0) < d.delta then
        raise exception 'No tenés suficiente stock propio de este color para guardar este cambio. ¿Es un producto prestado? Registrá el préstamo primero.';
      end if;

      update variant_stock set stock = stock - d.delta
      where variant_id = d.variant_id and profile_id = v_sale.seller_profile_id;
    else
      insert into variant_stock (variant_id, profile_id, stock)
      values (d.variant_id, v_sale.seller_profile_id, -d.delta)
      on conflict (variant_id, profile_id) do update
      set stock = variant_stock.stock + excluded.stock;
    end if;

    insert into stock_movements (
      variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by
    )
    values (
      d.variant_id, v_product_id, v_sale.seller_profile_id, 'ajuste_venta', abs(d.delta), 'sales', p_sale_id,
      case
        when d.delta > 0 then 'Edición de venta: se aumentó la cantidad'
        else 'Edición de venta: se redujo la cantidad o se quitó el producto'
      end,
      v_profile_id
    );
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

    insert into sale_items (sale_id, variant_id, product_id, quantity, sale_price, cost_price)
    values (p_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost);

    v_total := v_total + (v_qty * v_sale_price);
  end loop;

  update sales
  set total_price = v_total,
      payment_method = p_payment_method,
      bank_note = case when p_payment_method = 'transferencia' then nullif(trim(coalesce(p_bank_note, '')), '') else null end
  where id = p_sale_id;
end;
$$;

-- Edita solo método de pago / nota de banco — la ruta liviana que sí
-- aplica a cualquier venta, incluidos los apartados (no toca productos
-- ni stock, así que no le hace falta ninguna de las restricciones de
-- arriba).
create or replace function update_sale_payment_method(
  p_sale_id uuid,
  p_payment_method text,
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
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select is_admin into v_is_admin from profiles where id = v_profile_id;

  select * into v_sale from sales where id = p_sale_id;
  if v_sale is null then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale.seller_profile_id <> v_profile_id and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  if p_payment_method not in ('efectivo', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  update sales
  set payment_method = p_payment_method,
      bank_note = case when p_payment_method = 'transferencia' then nullif(trim(coalesce(p_bank_note, '')), '') else null end
  where id = p_sale_id;
end;
$$;

grant execute on function update_sale_items(uuid, jsonb, text, text) to authenticated;
grant execute on function update_sale_payment_method(uuid, text, text) to authenticated;
