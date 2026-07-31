-- Crear un pedido con sus items de forma atomica, calculando total_cost.
-- No toca products.stock (eso pasa recien en mark_order_received, ver
-- 0011_functions_triggers.sql, cuando el pedido pasa a "recibido").
create or replace function create_order(
  p_order_date date,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_order_id uuid;
  item jsonb;
  v_product_id uuid;
  v_qty int;
  v_unit_cost numeric(12, 2);
  v_total numeric(12, 2) := 0;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido necesita al menos un producto';
  end if;

  insert into orders (order_date, created_by, status)
  values (coalesce(p_order_date, current_date), v_profile_id, 'pendiente')
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_product_id := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_unit_cost := (item ->> 'unit_cost')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para producto %', v_product_id;
    end if;

    insert into order_items (order_id, product_id, quantity, unit_cost)
    values (v_order_id, v_product_id, v_qty, v_unit_cost);

    v_total := v_total + (v_qty * v_unit_cost);
  end loop;

  update orders set total_cost = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

grant execute on function create_order(date, jsonb) to authenticated;
