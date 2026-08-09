-- Detalle de entrega por producto de los apartados de una clienta, para
-- la ficha de Clientes — mismo detalle que ya se ve en la vista de
-- Apartados de Ventas (qué productos, cuáles ya se entregaron), pero
-- sin tener que salir de la ficha a buscarlo.
--
-- Hace falta una función security definer (no alcanza con
-- get_customer_apartados, que solo trae totales) por el mismo motivo que
-- el resto de las funciones de Clientes: sale_items es privado por RLS
-- desde 0022, y Clientes es una vista compartida — una usuaria tiene que
-- poder ver el detalle de un apartado de la clienta aunque lo haya
-- vendido otra.
create or replace function get_customer_apartado_items(p_customer_id uuid)
returns table (
  sale_id uuid,
  product_id uuid,
  variant_id uuid,
  quantity int,
  sale_price numeric(12, 2),
  delivered boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select si.sale_id, si.product_id, si.variant_id, si.quantity, si.sale_price, si.delivered
  from sale_items si
  join sales s on s.id = si.sale_id
  where s.customer_id = p_customer_id
    and s.payment_status in ('con_abonos', 'completado', 'cancelado');
$$;

grant execute on function get_customer_apartado_items(uuid) to authenticated;
