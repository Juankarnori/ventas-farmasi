-- Bug recurrente (reportado dos veces): "el valor del préstamo no se
-- actualiza según cómo se pagó" y "el total no multiplica por la
-- cantidad". La causa real encontrada tras auditar todo el flujo de
-- punta a punta: `update_loan_settlement` (LoanSettlementEditor) siempre
-- guardó `settlement_amount`/`settlement_method` correctamente en la
-- base — pero eso nunca marcaba el préstamo como liquidado
-- (`debt_settled_at` seguía en null), y ningún lugar de la UI leía
-- `settlement_amount` para mostrarlo: `LoanList` ("Debe $X"/columna
-- Total), la ficha de un préstamo ("le debe a X $Y") y `MonetaryDebtCard`
-- siempre mostraban el valor TEÓRICO (unit_value × quantity), sin
-- importar qué se hubiera registrado como realmente pagado. Registrar el
-- pago quedaba completamente desconectado de "cuánto debe" en pantalla —
-- la única forma de que un préstamo dejara de figurar como deuda era el
-- botón aparte "Liquidar todas las deudas" (settle_loan_debts), que
-- tampoco usa el monto registrado.
--
-- Esto no era un bug de multiplicación (unit_value × quantity ya estaba
-- bien calculado en los 3 lugares desde una sesión anterior) sino de qué
-- número se elegía mostrar: el estimado en vez del real una vez que el
-- real ya se conocía.
--
-- Fix: registrar el pago de UN préstamo puntual (vía
-- LoanSettlementEditor) ahora también lo marca liquidado — tiene sentido
-- que "cómo se pagó" y "está pagado" sean la misma acción, no dos botones
-- separados sin relación. El botón "Liquidar todas las deudas" (bulk,
-- sin detalle de monto/método) se mantiene intacto para cerrar de una
-- varias deudas sin necesidad de registrar el detalle de cada una.
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
      end,
      debt_settled_at = coalesce(debt_settled_at, now())
  where id = p_loan_id;
end;
$$;

grant execute on function update_loan_settlement(uuid, text, numeric, text) to authenticated;

notify pgrst, 'reload schema';
