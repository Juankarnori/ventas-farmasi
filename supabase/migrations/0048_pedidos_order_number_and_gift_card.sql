-- Mejoras en Pedidos:
-- 1. N° de orden Farmasi (opcional) — referencia que da Farmasi a esa
--    compra, para poder ubicarla después.
-- 2. Tarjeta de regalo / bono aplicado al pedido — un monto que se resta
--    del total calculado para saber cuánto queda realmente por pagar.
--    Se guarda como columna aparte (no se resta directo de total_cost)
--    para no perder de vista el total real de mercadería pedida — el
--    desglose "Total − Bono = Total a pagar" se arma en la UI.
alter table orders add column farmasi_order_number text;
alter table orders add column gift_card_amount numeric(12, 2) not null default 0 check (gift_card_amount >= 0);

drop function if exists create_order(date, jsonb);

create or replace function create_order(
  p_order_date date,
  p_items jsonb,
  p_farmasi_order_number text default null,
  p_gift_card_amount numeric default 0
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
  v_variant_id uuid;
  v_product_id uuid;
  v_qty int;
  v_unit_cost numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_gift_card_amount numeric(12, 2) := coalesce(p_gift_card_amount, 0);
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido necesita al menos un producto';
  end if;

  if v_gift_card_amount < 0 then
    raise exception 'El bono no puede ser negativo';
  end if;

  insert into orders (order_date, created_by, status, farmasi_order_number, gift_card_amount)
  values (
    coalesce(p_order_date, current_date),
    v_profile_id,
    'pendiente',
    nullif(trim(coalesce(p_farmasi_order_number, '')), ''),
    v_gift_card_amount
  )
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (item ->> 'variant_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_unit_cost := (item ->> 'unit_cost')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para variante %', v_variant_id;
    end if;

    select product_id into v_product_id from product_variants where id = v_variant_id;
    if v_product_id is null then
      raise exception 'Variante % no encontrada', v_variant_id;
    end if;

    insert into order_items (order_id, variant_id, product_id, quantity, unit_cost)
    values (v_order_id, v_variant_id, v_product_id, v_qty, v_unit_cost);

    v_total := v_total + (v_qty * v_unit_cost);
  end loop;

  if v_gift_card_amount > v_total then
    raise exception 'El bono no puede ser mayor al total del pedido';
  end if;

  update orders set total_cost = v_total where id = v_order_id;

  return v_order_id;
end;
$$;

grant execute on function create_order(date, jsonb, text, numeric) to authenticated;

notify pgrst, 'reload schema';
