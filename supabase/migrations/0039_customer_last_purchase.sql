-- Fecha de última compra por clienta, para el listado de Clientes.
-- Función nueva y separada de list_customer_totals a propósito: esa
-- cuenta solo lo YA COBRADO (pagado/completado) para el total gastado,
-- pero acá la fecha tiene que reflejar cuándo eligió productos por
-- última vez sea que ya haya terminado de pagar o no (un apartado en
-- curso también es "una compra" a efectos de saber a quién le toca
-- seguimiento) — mismo criterio que ya usa la ficha de la clienta para
-- "lo que más compra". Solo se excluyen las canceladas.
create or replace function list_customer_last_purchase()
returns table (
  customer_id uuid,
  last_purchase_date date
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_claimed_user() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    s.customer_id,
    max(s.sale_date) as last_purchase_date
  from sales s
  where s.customer_id is not null
    and s.payment_status <> 'cancelado'
  group by s.customer_id;
end;
$$;

grant execute on function list_customer_last_purchase() to authenticated;

notify pgrst, 'reload schema';
