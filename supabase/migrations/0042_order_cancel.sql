-- Tercer estado para Pedidos: 'cancelado'. Solo se puede cancelar
-- mientras está 'pendiente' — uno ya 'recibido' ya sumó stock (revertir
-- eso es un caso distinto, no lo cubre esto). Un pedido pendiente
-- todavía no movió ni un número de stock (eso pasa recién en
-- mark_order_received), así que cancelarlo no tiene nada que revertir.
alter table orders drop constraint orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('pendiente', 'recibido', 'cancelado'));

-- Mismo patrón que received_at: cuándo se canceló, para el historial.
alter table orders add column cancelled_at timestamptz;

create or replace function cancel_order(p_order_id uuid)
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

  if not exists (select 1 from orders where id = p_order_id and status = 'pendiente') then
    raise exception 'Pedido no encontrado o ya no está pendiente';
  end if;

  update orders set status = 'cancelado', cancelled_at = now() where id = p_order_id;
end;
$$;

grant execute on function cancel_order(uuid) to authenticated;

notify pgrst, 'reload schema';
