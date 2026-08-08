-- Dos temas de Préstamos:
--
-- 1. Tercera opción de valoración "promoción": algunos productos (ej.
--    protectores solares) se compran en promo, a un precio distinto tanto
--    del costo registrado como del PVP normal — ninguno de los dos
--    calculados automáticamente sirve ahí, hace falta un precio manual.
-- 2. Al liquidar un préstamo 'vendido', ahora también se registra CUÁNTO
--    se pagó (puede diferir del calculado si hubo un ajuste manual entre
--    las dos), no solo cómo.

alter table loans drop constraint loans_valuation_type_check;
alter table loans add constraint loans_valuation_type_check
  check (valuation_type in ('costo', 'pvp', 'promocion'));

-- Precio unitario manual — solo tiene sentido (y solo se usa) cuando
-- valuation_type = 'promocion'; para 'costo'/'pvp' queda null.
alter table loans add column custom_price numeric(12, 2);
alter table loans add constraint loans_custom_price_check
  check (valuation_type <> 'promocion' or custom_price is not null);

-- Monto realmente pagado al liquidar una deuda 'vendido' — puede diferir
-- del calculado (loanDebtAmount) si hubo un ajuste manual entre las dos.
alter table loans add column settlement_amount numeric(12, 2);

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

-- update_loan se redeclara con el mismo agregado (p_custom_price al
-- final, con default, para no romper la firma existente) — resto del
-- cuerpo idéntico al de 0027_loan_valuation_edit_and_more.sql.
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

-- update_loan_settlement se redeclara agregando p_settlement_amount
-- (cuánto se pagó de verdad — puede diferir del calculado por
-- loanDebtAmount si hubo un ajuste manual). Va ANTES de
-- p_settlement_bank_note en la firma porque en Postgres, una vez que un
-- parámetro tiene default, todos los que siguen también necesitan uno —
-- y p_settlement_bank_note ya tenía default null desde 0027. Insertar un
-- parámetro en el medio cambia la firma completa (uuid,text,text) a
-- (uuid,text,numeric,text) — Postgres lo trataría como una función
-- DISTINTA (overload) en vez de reemplazar la vieja, así que primero se
-- borra la versión de 3 parámetros para no dejar las dos conviviendo.
drop function if exists update_loan_settlement(uuid, text, text);

create or replace function update_loan_settlement(
  p_loan_id uuid,
  p_settlement_method text,
  p_settlement_amount numeric,
  p_settlement_bank_note text default null
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
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select is_admin into v_is_admin from profiles where id = v_profile_id;

  select * into v_loan from loans where id = p_loan_id;
  if v_loan is null then
    raise exception 'Préstamo no encontrado';
  end if;

  if v_loan.from_profile_id <> v_profile_id
     and v_loan.to_profile_id <> v_profile_id
     and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  if v_loan.status = 'pendiente' then
    raise exception 'Este préstamo todavía está pendiente — marcalo como devuelto o vendido primero.';
  end if;

  if p_settlement_method not in ('efectivo', 'transferencia', 'producto') then
    raise exception 'Método inválido';
  end if;

  if p_settlement_amount is null or p_settlement_amount < 0 then
    raise exception 'El monto pagado tiene que ser mayor o igual a 0';
  end if;

  update loans
  set settlement_method = p_settlement_method,
      settlement_amount = p_settlement_amount,
      settlement_bank_note = case
        when p_settlement_method = 'transferencia' then nullif(trim(coalesce(p_settlement_bank_note, '')), '')
        else null
      end
  where id = p_loan_id;
end;
$$;

grant execute on function create_loan(uuid, int, uuid, uuid, text, text, numeric) to authenticated;
grant execute on function update_loan(uuid, uuid, int, text, text, numeric) to authenticated;
grant execute on function update_loan_settlement(uuid, text, numeric, text) to authenticated;
