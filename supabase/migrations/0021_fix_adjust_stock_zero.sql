-- Bug reportado en producción: bajar el stock de 1 a 0 con el stepper
-- fallaba con "Ajuste inválido: dejaría el stock en negativo".
--
-- Revisando el historial de migraciones (0011, 0014, 0015 — cada una
-- redefine adjust_stock, la última gana), la condición que corta el
-- ajuste SIEMPRE fue `< 0` / `>= 0` en este repo — nunca hubo un `<=` de
-- más, y 0 nunca estuvo bloqueado por lo que quedó escrito en el código.
-- Lo más probable es que la base de datos desplegada tenga corriendo una
-- versión de esta función que no coincide con la que hay en el repo en
-- este momento (por ejemplo, si en algún despliegue no se corrieron
-- todas las migraciones en orden — ver el fix al README en este mismo
-- commit). Esta migración vuelve a declarar la función tal cual debe
-- quedar, así que correrla deja la base al día sin importar qué versión
-- tuviera antes.
create or replace function adjust_stock(
  p_variant_id uuid,
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
  v_product_id uuid;
  v_current_stock int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select product_id into v_product_id from product_variants where id = p_variant_id;

  if v_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  select stock into v_current_stock
  from variant_stock
  where variant_id = p_variant_id and profile_id = v_profile_id
  for update;

  -- Estrictamente menor a 0: el resultado puede llegar a exactamente 0
  -- ("sin stock" es un valor válido, no un error).
  if coalesce(v_current_stock, 0) + p_delta < 0 then
    raise exception 'Ajuste invalido: dejaria el stock en negativo';
  end if;

  insert into variant_stock (variant_id, profile_id, stock)
  values (p_variant_id, v_profile_id, p_delta)
  on conflict (variant_id, profile_id) do update
  set stock = variant_stock.stock + p_delta;

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, note, created_by)
  values (p_variant_id, v_product_id, v_profile_id, 'ajuste_manual', abs(p_delta), p_note, v_profile_id);
end;
$$;

grant execute on function adjust_stock(uuid, int, text) to authenticated;
