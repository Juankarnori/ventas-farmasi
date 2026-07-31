-- Mutaciones de negocio que deben ser atomicas (insert + ajuste de stock +
-- log de movimiento en una sola transaccion implicita de Postgres). Las
-- Server Actions llaman a estas funciones via supabase.rpc(...) en vez de
-- hacer varios updates sueltos desde el cliente.
--
-- Estas funciones son `security definer`, o sea que se ejecutan saltandose
-- RLS. Por eso NUNCA reciben el profile_id "actor" como parametro del
-- cliente (se podria spoofear); lo resuelven siempre desde auth.uid() con
-- current_profile_id(), que ademas actua como el chequeo de autorizacion
-- (falla si quien llama no es una de las dos usuarias reclamadas).

create or replace function current_profile_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from profiles where user_id = auth.uid();
$$;

grant execute on function current_profile_id() to authenticated;

-- 1. Marcar un pedido como recibido: suma stock por cada order_item,
--    loguea el movimiento y cambia el estado del pedido.
create or replace function mark_order_received(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  r record;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if not exists (select 1 from orders where id = p_order_id and status = 'pendiente') then
    raise exception 'Pedido no encontrado o ya recibido';
  end if;

  for r in select product_id, quantity from order_items where order_id = p_order_id loop
    update products set stock = stock + r.quantity, updated_at = now() where id = r.product_id;

    insert into stock_movements (product_id, type, quantity, reference_table, reference_id, created_by)
    values (r.product_id, 'entrada_pedido', r.quantity, 'orders', p_order_id, v_profile_id);
  end loop;

  update orders set status = 'recibido', received_at = now() where id = p_order_id;
end;
$$;

grant execute on function mark_order_received(uuid) to authenticated;

-- 2. Registrar una venta con uno o mas items. p_items es un jsonb array:
--    [{product_id, quantity, sale_price}, ...]. Descuenta stock con
--    `for update` para evitar condiciones de carrera, valida stock
--    suficiente, y guarda un snapshot del costo actual en cada item.
create or replace function create_sale(
  p_customer_name text,
  p_sale_date date,
  p_items jsonb
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
  v_product_id uuid;
  v_qty int;
  v_sale_price numeric(12, 2);
  v_cost numeric(12, 2);
  v_current_stock int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto';
  end if;

  insert into sales (sale_date, customer_name, seller_profile_id)
  values (coalesce(p_sale_date, current_date), nullif(p_customer_name, ''), v_profile_id)
  returning id into v_sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_sale_price := (item ->> 'sale_price')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para producto %', v_product_id;
    end if;

    select stock, cost_price into v_current_stock, v_cost
    from products where id = v_product_id
    for update;

    if v_current_stock is null then
      raise exception 'Producto % no encontrado', v_product_id;
    end if;

    if v_current_stock < v_qty then
      raise exception 'Stock insuficiente para producto %', v_product_id;
    end if;

    insert into sale_items (sale_id, product_id, quantity, sale_price, cost_price)
    values (v_sale_id, v_product_id, v_qty, v_sale_price, v_cost);

    update products set stock = stock - v_qty, updated_at = now() where id = v_product_id;

    insert into stock_movements (product_id, type, quantity, reference_table, reference_id, created_by)
    values (v_product_id, 'salida_venta', v_qty, 'sales', v_sale_id, v_profile_id);
  end loop;

  return v_sale_id;
end;
$$;

grant execute on function create_sale(text, date, jsonb) to authenticated;

-- 3. Ajuste manual de stock (positivo o negativo). Nunca deja el stock
--    en negativo.
create or replace function adjust_stock(
  p_product_id uuid,
  p_delta int,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  update products
  set stock = stock + p_delta, updated_at = now()
  where id = p_product_id and stock + p_delta >= 0;

  if not found then
    raise exception 'Ajuste invalido: dejaria el stock en negativo';
  end if;

  insert into stock_movements (product_id, type, quantity, note, created_by)
  values (p_product_id, 'ajuste_manual', abs(p_delta), p_note, v_profile_id);
end;
$$;

grant execute on function adjust_stock(uuid, int, text) to authenticated;

-- 4. Crear un prestamo entre las dos usuarias. No toca products.stock;
--    solo deja un movimiento tipo 'prestamo' para trazabilidad.
create or replace function create_loan(
  p_product_id uuid,
  p_quantity int,
  p_from_profile_id uuid,
  p_to_profile_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_loan_id uuid;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad prestada debe ser mayor a 0';
  end if;

  insert into loans (product_id, quantity, from_profile_id, to_profile_id, note, created_by)
  values (p_product_id, p_quantity, p_from_profile_id, p_to_profile_id, p_note, v_profile_id)
  returning id into v_loan_id;

  insert into stock_movements (product_id, type, quantity, reference_table, reference_id, created_by)
  values (p_product_id, 'prestamo', p_quantity, 'loans', v_loan_id, v_profile_id);

  return v_loan_id;
end;
$$;

grant execute on function create_loan(uuid, int, uuid, uuid, text) to authenticated;

-- 5. Marcar un prestamo como devuelto.
create or replace function mark_loan_returned(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_profile_id() is null then
    raise exception 'No autorizado';
  end if;

  update loans set status = 'devuelto', returned_at = now() where id = p_loan_id;
end;
$$;

grant execute on function mark_loan_returned(uuid) to authenticated;
