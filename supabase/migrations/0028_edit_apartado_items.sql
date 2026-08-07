-- Editar los productos/cantidades de un apartado ya registrado.
--
-- Mismo patrón de delta de stock que update_sale_items (0025), pero con
-- dos diferencias importantes específicas de un apartado:
--
-- 1. El nuevo total NUNCA puede quedar por debajo de lo ya abonado — un
--    apartado con saldo negativo no tiene sentido (¿le devolvemos plata?).
--    Se bloquea con un mensaje claro que dice cuánto lleva abonado.
-- 2. Si ya se entregó algún producto del apartado, no se puede editar —
--    igual que cancel_apartado ya bloquea la cancelación en ese caso. Acá
--    además evita un problema real: borrar y reinsertar sale_items (para
--    aplicar el delta de stock) resetearía `delivered` a false, perdiendo
--    silenciosamente el registro de qué ya se entregó.
--
-- El total puede subir o bajar: si baja hasta empatar lo abonado, el
-- apartado pasa a 'completado' (misma regla que register_payment); si
-- estaba 'completado' y el total sube por encima de lo abonado, vuelve a
-- 'con_abonos' — el saldo pendiente tiene que reflejar la realidad.
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
  v_total numeric(12, 2) := 0;
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

  -- Delta de stock por variante — misma lógica que update_sale_items:
  -- positivo = hay que sacarle más stock a la vendedora; negativo = hay
  -- que devolverle.
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
        when d.delta > 0 then 'Edición de apartado: se aumentó la cantidad'
        else 'Edición de apartado: se redujo la cantidad o se quitó el producto'
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

    insert into sale_items (sale_id, variant_id, product_id, quantity, sale_price, cost_price, delivered)
    values (p_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost, false);
  end loop;

  update sales
  set total_price = v_total,
      payment_status = case when v_amount_paid >= v_total then 'completado' else 'con_abonos' end
  where id = p_sale_id;
end;
$$;

grant execute on function update_apartado_items(uuid, jsonb) to authenticated;
