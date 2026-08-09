-- BUG DE PRODUCCIÓN: create_loan no existe en absoluto (0 filas en
-- pg_proc). "Pedir prestado" sigue fallando después de 0036 (el NOTIFY
-- de refresco de caché) porque el problema real no era el caché: la
-- función fue borrada por completo.
--
-- Qué pasó en 0033: asumió que, para el momento en que corriera, ya
-- existían coexistiendo 3 versiones de create_loan (5, 6 y 7 parámetros
-- — de 0011/0014/0015, 0027 y 0030 respectivamente) y se limitó a
-- `drop function if exists` las dos viejas (5 y 6 parámetros), dejando
-- la de 7 "tal cual estaba" sin volver a crearla — es decir, dependía
-- por completo de que la migración 0030 (la que la creó) ya hubiera
-- corrido en esta base exactamente como está en el repo. Si por lo que
-- sea 0030 nunca llegó a aplicarse acá (migración saltada, orden
-- distinto al del repo, fallo silencioso, etc.), en producción solo
-- existían las versiones de 5 y 6 parámetros — y 0033 las borró LAS
-- DOS, sin dejar ninguna viva. Resultado: create_loan desaparece por
-- completo, tal cual lo confirma la consulta a pg_proc.
--
-- Arreglo (y patrón correcto a futuro, según quedó pedido): en vez de
-- tratar de borrar selectivamente solo "las viejas" confiando en qué
-- firma quedó de qué migración anterior, acá se borran TODAS las firmas
-- conocidas de create_loan/update_loan que existieron alguna vez en el
-- historial de migraciones (si alguna ya no existe, el `if exists` la
-- ignora sin error) y se recrea la versión correcta desde cero en la
-- misma migración — nunca queda un "supongo que ya está creada en otro
-- lado" pendiente de otra migración.

-- =========================================================================
-- create_loan: se borran las 3 firmas que existieron en el historial
-- (0011/0014/0015 con 5 parámetros, 0027 con 6, 0030 con 7) y se recrea
-- la de 7 parámetros con el cuerpo completo de 0030 (mover stock entre
-- las dos usuarias, crear el registro en loans con su valoración,
-- registrar los dos movimientos de stock_movements).
-- =========================================================================

drop function if exists create_loan(uuid, int, uuid, uuid, text);
drop function if exists create_loan(uuid, int, uuid, uuid, text, text);
drop function if exists create_loan(uuid, int, uuid, uuid, text, text, numeric);

create or replace function create_loan(
  p_variant_id uuid,
  p_quantity int,
  p_from_profile_id uuid,
  p_to_profile_id uuid,
  p_note text,
  p_valuation_type text default 'costo',
  p_custom_price numeric default null
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

  if p_valuation_type not in ('costo', 'pvp', 'promocion') then
    raise exception 'Tipo de valoración inválido';
  end if;

  if p_valuation_type = 'promocion' and (p_custom_price is null or p_custom_price <= 0) then
    raise exception 'Ingresá el precio de promoción de esta unidad';
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
    unit_cost, unit_price, valuation_type, custom_price, created_by
  )
  values (
    p_variant_id, v_product_id, p_quantity, p_from_profile_id, p_to_profile_id, p_note,
    v_cost, v_price, p_valuation_type,
    case when p_valuation_type = 'promocion' then p_custom_price else null end,
    v_profile_id
  )
  returning id into v_loan_id;

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
  values (p_variant_id, v_product_id, p_from_profile_id, 'prestamo_salida', p_quantity, 'loans', v_loan_id, v_profile_id);

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
  values (p_variant_id, v_product_id, p_to_profile_id, 'prestamo_entrada', p_quantity, 'loans', v_loan_id, v_profile_id);

  return v_loan_id;
end;
$$;

grant execute on function create_loan(uuid, int, uuid, uuid, text, text, numeric) to authenticated;

-- =========================================================================
-- update_loan: mismo riesgo, mismo arreglo. Se borran las 2 firmas que
-- existieron (0027 con 5 parámetros, 0030 con 6) y se recrea la de 6 con
-- el cuerpo completo de 0030 (revierte el movimiento viejo entre las dos
-- usuarias por completo, valida stock del nuevo, aplica el movimiento
-- nuevo, actualiza el préstamo).
-- =========================================================================

drop function if exists update_loan(uuid, uuid, int, text, text);
drop function if exists update_loan(uuid, uuid, int, text, text, numeric);

create or replace function update_loan(
  p_loan_id uuid,
  p_variant_id uuid,
  p_quantity int,
  p_valuation_type text,
  p_note text,
  p_custom_price numeric default null
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

  if p_valuation_type not in ('costo', 'pvp', 'promocion') then
    raise exception 'Tipo de valoración inválido';
  end if;

  if p_valuation_type = 'promocion' and (p_custom_price is null or p_custom_price <= 0) then
    raise exception 'Ingresá el precio de promoción de esta unidad';
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
      custom_price = case when p_valuation_type = 'promocion' then p_custom_price else null end,
      note = p_note
  where id = p_loan_id;

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by)
  values (p_variant_id, v_new_product_id, v_loan.from_profile_id, 'ajuste_manual', p_quantity, 'loans', p_loan_id, 'Edición de préstamo', v_profile_id);
end;
$$;

grant execute on function update_loan(uuid, uuid, int, text, text, numeric) to authenticated;

notify pgrst, 'reload schema';
