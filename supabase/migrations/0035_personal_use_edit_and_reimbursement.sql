-- Uso personal: editar un registro ya hecho + reembolso parcial.

-- =========================================================================
-- 1. Reembolso: a veces alguien fuera del negocio paga total o
--    parcialmente algo que se registró como uso personal (ej. una crema
--    que usó Betty pero la mitad se la pagó su hermana). Se anota acá
--    para que no cuente como una venta real, pero tampoco se pierda de
--    vista que una parte volvió.
-- =========================================================================

alter table personal_use add column reimbursed_amount numeric(12, 2) not null default 0;
alter table personal_use add column reimbursed_note text;
alter table personal_use add constraint personal_use_reimbursed_amount_check check (reimbursed_amount >= 0);

-- register_personal_use se redeclara agregando los dos campos de
-- reembolso al final (con default, para no romper la firma existente) —
-- se borra la versión vieja de 4 parámetros explícitamente primero:
-- agregar parámetros nuevos cambia la firma completa de la función, y
-- `create or replace` con una firma distinta crea una función ADICIONAL
-- en vez de reemplazar la vieja (mismo problema que causó el bug de
-- create_loan en 0033) — nunca alcanza con confiar en que el default
-- alcanza para "no romper nada", la firma en sí ya es otra.
drop function if exists register_personal_use(uuid, int, text, date);

create or replace function register_personal_use(
  p_variant_id uuid,
  p_quantity int,
  p_note text,
  p_used_at date,
  p_reimbursed_amount numeric default 0,
  p_reimbursed_note text default null
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

  if p_reimbursed_amount is not null and p_reimbursed_amount < 0 then
    raise exception 'El monto reembolsado no puede ser negativo';
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

  insert into personal_use (
    variant_id, product_id, profile_id, quantity, unit_cost, note, used_at,
    reimbursed_amount, reimbursed_note
  )
  values (
    p_variant_id, v_product_id, v_profile_id, p_quantity, v_cost,
    nullif(trim(coalesce(p_note, '')), ''), coalesce(p_used_at, current_date),
    coalesce(p_reimbursed_amount, 0), nullif(trim(coalesce(p_reimbursed_note, '')), '')
  );

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, note, created_by)
  values (p_variant_id, v_product_id, v_profile_id, 'uso_personal', p_quantity, p_note, v_profile_id);
end;
$$;

grant execute on function register_personal_use(uuid, int, text, date, numeric, text) to authenticated;

-- =========================================================================
-- 2. Editar un registro ya hecho: producto/variante, cantidad, fecha,
--    nota y reembolso. El stock ya se descontó al crearlo (a diferencia
--    de un pedido pendiente) — mismo patrón "revierte lo viejo por
--    completo, aplica lo nuevo desde cero" que update_loan/
--    update_sale_items, con rollback si no alcanza el stock nuevo.
-- =========================================================================

create or replace function update_personal_use(
  p_entry_id uuid,
  p_variant_id uuid,
  p_quantity int,
  p_used_at date,
  p_note text,
  p_reimbursed_amount numeric default 0,
  p_reimbursed_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := current_profile_id();
  v_is_admin boolean;
  v_entry record;
  v_new_product_id uuid;
  v_new_cost numeric(12, 2);
  v_current_stock int;
begin
  if v_actor_id is null then
    raise exception 'No autorizado';
  end if;

  select is_admin into v_is_admin from profiles where id = v_actor_id;

  select * into v_entry from personal_use where id = p_entry_id for update;
  if v_entry is null then
    raise exception 'Registro no encontrado';
  end if;

  -- Solo quien registró el uso personal (o una admin) puede editarlo —
  -- el stock que se ajusta es el suyo, no el de quien esté mirando.
  if v_entry.profile_id <> v_actor_id and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad tiene que ser mayor a 0';
  end if;

  if p_reimbursed_amount is not null and p_reimbursed_amount < 0 then
    raise exception 'El monto reembolsado no puede ser negativo';
  end if;

  select pv.product_id, coalesce(pv.cost_override, p.cost_price)
  into v_new_product_id, v_new_cost
  from product_variants pv
  join products p on p.id = pv.product_id
  where pv.id = p_variant_id;

  if v_new_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  -- Revierte el descuento de stock viejo por completo.
  update variant_stock set stock = stock + v_entry.quantity
  where variant_id = v_entry.variant_id and profile_id = v_entry.profile_id;

  select stock into v_current_stock
  from variant_stock
  where variant_id = p_variant_id and profile_id = v_entry.profile_id
  for update;

  if coalesce(v_current_stock, 0) < p_quantity then
    -- No alcanza: se deshace lo revertido arriba antes de fallar, para
    -- que el stock quede exactamente como estaba antes de este intento.
    update variant_stock set stock = stock - v_entry.quantity
    where variant_id = v_entry.variant_id and profile_id = v_entry.profile_id;

    raise exception 'No tenés suficiente stock propio de este color para este cambio.';
  end if;

  update variant_stock set stock = stock - p_quantity
  where variant_id = p_variant_id and profile_id = v_entry.profile_id;

  update personal_use
  set variant_id = p_variant_id,
      product_id = v_new_product_id,
      quantity = p_quantity,
      unit_cost = v_new_cost,
      used_at = coalesce(p_used_at, used_at),
      note = nullif(trim(coalesce(p_note, '')), ''),
      reimbursed_amount = coalesce(p_reimbursed_amount, 0),
      reimbursed_note = nullif(trim(coalesce(p_reimbursed_note, '')), '')
  where id = p_entry_id;

  -- Mismo criterio que update_loan: se registra la cantidad nueva (no un
  -- delta) bajo el tipo 'ajuste_manual', y solo si de verdad cambió algo
  -- que mueva stock.
  if p_variant_id <> v_entry.variant_id or p_quantity <> v_entry.quantity then
    insert into stock_movements (
      variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by
    )
    values (
      p_variant_id, v_new_product_id, v_entry.profile_id, 'ajuste_manual', p_quantity,
      'personal_use', p_entry_id, 'Edición de uso personal', v_actor_id
    );
  end if;
end;
$$;

grant execute on function update_personal_use(uuid, uuid, int, date, text, numeric, text) to authenticated;
