-- Bug real de código (no de sincronización): `total_price` se agregó a
-- `sales` como NOT NULL en 0016_apartados.sql, y create_apartado sí lo
-- calcula (suma quantity*sale_price en un loop antes del insert) — pero
-- create_sale (ventas de contado) nunca se actualizó para hacer lo mismo.
-- Quedó así sin corregirse a través de las redefiniciones posteriores de
-- create_sale en 0020_customers.sql (se agregó p_customer_id) y
-- 0023_customer_follow_ups.sql (se agregó el hook de seguimiento): ambas
-- copiaron el insert tal cual venía, sin `total_price`. Toda venta de
-- contado (no apartado) creada a través de create_sale con esta columna
-- ya NOT NULL tuvo que haber fallado con la misma excepción reportada acá
-- — no es un tema de que la base productiva tenga una versión vieja de la
-- función; el repo mismo nunca calculó este valor para create_sale.
--
-- El fix sigue el mismo patrón que ya usa create_apartado: un primer loop
-- sobre p_items solo para sumar el total, y recién ahí el insert en
-- `sales` con `total_price` resuelto.
create or replace function create_sale(
  p_customer_name text,
  p_sale_date date,
  p_items jsonb,
  p_customer_id uuid default null
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

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + ((item ->> 'quantity')::int * (item ->> 'sale_price')::numeric);
  end loop;

  insert into sales (sale_date, customer_name, customer_id, seller_profile_id, total_price)
  values (coalesce(p_sale_date, current_date), nullif(p_customer_name, ''), p_customer_id, v_profile_id, v_total)
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

-- create_apartado ya calculaba total_price correctamente (confirmado al
-- revisar 0023_customer_follow_ups.sql) — se reaplica igual, sin cambios,
-- solo para que quede la definición completa y correcta en un único lugar
-- por si en algún despliegue se corrió 0023 pero no (todavía) esta
-- migración; `create or replace` con el mismo cuerpo es un no-op seguro.
create or replace function create_apartado(
  p_customer_name text,
  p_customer_phone text,
  p_sale_date date,
  p_items jsonb,
  p_customer_id uuid default null
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
    sale_date, customer_name, customer_phone, customer_id, seller_profile_id, payment_status, total_price
  )
  values (
    coalesce(p_sale_date, current_date),
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''),
    p_customer_id,
    v_profile_id,
    'con_abonos',
    v_total
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
