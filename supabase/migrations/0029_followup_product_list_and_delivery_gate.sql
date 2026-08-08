-- Dos correcciones al seguimiento post-venta:
--
-- 1. El placeholder {producto} solo tomaba el primer producto de la
--    venta (v_first_product_name, capturado por create_sale/
--    create_apartado). Ahora arma la lista completa de productos
--    distintos de la venta, en formato de lista en español: "A" (1),
--    "A y B" (2), "A, B y C" (3+).
--
-- 2. Una tarea 'despues_de_venta' no debería aparecer en "Hoy toca
--    contactar" si la venta que la originó todavía no se entregó del
--    todo — no tiene sentido preguntar "¿cómo te fue con el producto?"
--    a alguien que no lo tiene en sus manos. Como sale_items ahora es
--    privado por RLS (0022), el chequeo "¿está todo entregado?" no se
--    puede hacer desde el cliente para tareas de OTRAS usuarias (Clientes
--    es compartido) — hace falta una función security definer, mismo
--    criterio que get_customer_apartados/list_customer_pending_balances.

-- p_product_name se deja en la firma (sin usar) para no tener que romper
-- ni redeclarar create_sale/create_apartado, que ya la llaman con 4
-- argumentos — el mensaje ya no depende de ese parámetro, se arma
-- consultando sale_items/products directo.
create or replace function create_follow_up_tasks_for_sale(
  p_sale_id uuid,
  p_customer_id uuid,
  p_sale_date date,
  p_product_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_name text;
  r record;
  v_message text;
  v_product_names text[];
  v_product_count int;
  v_product_list text;
begin
  if p_customer_id is null then
    return;
  end if;

  select name into v_customer_name from customers where id = p_customer_id;

  if v_customer_name is null then
    return;
  end if;

  select array_agg(distinct p.name order by p.name)
  into v_product_names
  from sale_items si
  join products p on p.id = si.product_id
  where si.sale_id = p_sale_id;

  v_product_count := coalesce(array_length(v_product_names, 1), 0);

  if v_product_count = 0 then
    v_product_list := coalesce(p_product_name, 'tu compra');
  elsif v_product_count = 1 then
    v_product_list := v_product_names[1];
  else
    v_product_list := array_to_string(v_product_names[1 : v_product_count - 1], ', ')
      || ' y ' || v_product_names[v_product_count];
  end if;

  for r in
    select id, message_template, days_after
    from follow_up_rules
    where trigger_type = 'despues_de_venta' and active = true
  loop
    v_message := replace(
      replace(r.message_template, '{nombre}', v_customer_name),
      '{producto}', v_product_list
    );

    insert into follow_up_tasks (customer_id, rule_id, due_date, sale_id, message_preview)
    values (p_customer_id, r.id, p_sale_date + r.days_after, p_sale_id, v_message);
  end loop;
end;
$$;

-- Ids de ventas con al menos un sale_item sin entregar. Se usa desde
-- getPendingFollowUps para ocultar tareas 'despues_de_venta' de apartados
-- que todavía no se entregaron del todo — solo aplica a tareas con
-- sale_id (las de cumpleaños no tienen venta asociada). `security
-- definer` a propósito: Clientes es compartido entre todo el equipo, así
-- que este chequeo tiene que ver la entrega de CUALQUIER venta, no solo
-- las propias (sale_items es privado por RLS desde 0022).
create or replace function get_undelivered_sale_ids()
returns table (sale_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select distinct si.sale_id
  from sale_items si
  where si.delivered = false;
$$;

grant execute on function get_undelivered_sale_ids() to authenticated;
