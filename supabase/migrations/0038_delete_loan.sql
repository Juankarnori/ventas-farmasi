-- Eliminar un préstamo directamente desde Pendientes/Vendidos/Devueltos.
--
-- Comportamiento según estado (el stock nunca queda inconsistente):
--   * pendiente: el stock ya se movió de quien prestó a quien recibió al
--     crearlo — se revierte (mismo criterio que cancel_apartado) antes
--     de borrar el registro.
--   * devuelto: el stock ya se revirtió cuando se marcó como devuelto
--     (mark_loan_returned) — borrar el registro acá no debe tocarlo de
--     nuevo.
--   * vendido: el producto quedó para siempre con quien lo recibió (se
--     vendió) — tampoco se toca el stock. Si tiene una deuda monetaria
--     pendiente sin liquidar, esa advertencia se resuelve del lado del
--     cliente (confirmación antes de llamar a esta función); acá no se
--     bloquea nada, es decisión de la usuaria si igual quiere borrarlo.
create or replace function delete_loan(p_loan_id uuid)
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

  select * into v_loan from loans where id = p_loan_id for update;
  if v_loan is null then
    raise exception 'Préstamo no encontrado';
  end if;

  -- Mismo criterio de permiso que update_loan/update_loan_settlement:
  -- cualquiera de las dos partes del préstamo, o una admin.
  if v_loan.from_profile_id <> v_profile_id
     and v_loan.to_profile_id <> v_profile_id
     and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  if v_loan.status = 'pendiente' then
    update variant_stock set stock = stock - v_loan.quantity
    where variant_id = v_loan.variant_id and profile_id = v_loan.to_profile_id;

    insert into variant_stock (variant_id, profile_id, stock)
    values (v_loan.variant_id, v_loan.from_profile_id, v_loan.quantity)
    on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by)
    values (v_loan.variant_id, v_loan.product_id, v_loan.from_profile_id, 'ajuste_manual', v_loan.quantity, 'loans', p_loan_id, 'Préstamo eliminado', v_profile_id);
  end if;

  delete from loans where id = p_loan_id;
end;
$$;

grant execute on function delete_loan(uuid) to authenticated;

-- Lección de 0033/0037: cualquier migración que cree una función nueva
-- expuesta como RPC debe terminar refrescando el caché de esquema de
-- PostgREST, o queda sirviendo su caché viejo (que no conoce esta
-- función) hasta que algo más lo dispare.
notify pgrst, 'reload schema';
