-- Eliminar una venta ya registrada (de contado o apartado) por completo
-- — por si se cargó por error o duplicada.
--
-- Orden:
--   1. Revierte el stock: cada renglón vuelve al variant_stock de quien
--      vendió (mismo criterio que cancel_apartado/delete_loan).
--   2. Borra las follow_up_tasks que esta venta haya generado — el FK
--      (sale_id references sales on delete set null) NO las borra solo,
--      las dejaría huérfanas con sale_id en null pero igual visibles en
--      "Hoy toca contactar"; acá se borran de verdad.
--   3. Borra la venta — sale_items y sale_payments caen solos por
--      "on delete cascade", no hace falta un delete aparte para esos dos.
--
-- No bloquea nada por tener abonos ya registrados (sale_payments): esa
-- advertencia se resuelve del lado del cliente (confirmación antes de
-- llamar a esta función, mostrando cuánto se pierde) — acá no se
-- pregunta nada, es decisión de la usuaria.
create or replace function delete_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_is_admin boolean;
  v_sale record;
  r record;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select is_admin into v_is_admin from profiles where id = v_profile_id;

  select * into v_sale from sales where id = p_sale_id for update;
  if v_sale is null then
    raise exception 'Venta no encontrada';
  end if;

  -- Mismo criterio de permiso que update_sale_items: solo quien la
  -- vendió, o una admin.
  if v_sale.seller_profile_id <> v_profile_id and not coalesce(v_is_admin, false) then
    raise exception 'No autorizado';
  end if;

  for r in select variant_id, product_id, quantity from sale_items where sale_id = p_sale_id loop
    insert into variant_stock (variant_id, profile_id, stock)
    values (r.variant_id, v_sale.seller_profile_id, r.quantity)
    on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, note, created_by)
    values (r.variant_id, r.product_id, v_sale.seller_profile_id, 'ajuste_manual', r.quantity, 'sales', p_sale_id, 'Venta eliminada', v_profile_id);
  end loop;

  delete from follow_up_tasks where sale_id = p_sale_id;

  delete from sales where id = p_sale_id;
end;
$$;

grant execute on function delete_sale(uuid) to authenticated;

notify pgrst, 'reload schema';
