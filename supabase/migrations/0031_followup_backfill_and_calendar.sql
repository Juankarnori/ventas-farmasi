-- "Aplicar a ventas anteriores": generar tareas 'despues_de_venta' de una
-- regla también para ventas que ya existían antes de crearla/activarla.
--
-- Primero se extrae a una función aparte la lógica de armar el mensaje
-- (lista de productos + placeholders) que hoy vive inline dentro de
-- create_follow_up_tasks_for_sale (ver 0029) — así el backfill la
-- reutiliza tal cual en vez de duplicarla.

create or replace function follow_up_message_for_sale(
  p_sale_id uuid,
  p_customer_name text,
  p_message_template text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_names text[];
  v_product_count int;
  v_product_list text;
begin
  select array_agg(distinct p.name order by p.name)
  into v_product_names
  from sale_items si
  join products p on p.id = si.product_id
  where si.sale_id = p_sale_id;

  v_product_count := coalesce(array_length(v_product_names, 1), 0);

  if v_product_count = 0 then
    v_product_list := 'tu compra';
  elsif v_product_count = 1 then
    v_product_list := v_product_names[1];
  else
    v_product_list := array_to_string(v_product_names[1 : v_product_count - 1], ', ')
      || ' y ' || v_product_names[v_product_count];
  end if;

  return replace(replace(p_message_template, '{nombre}', p_customer_name), '{producto}', v_product_list);
end;
$$;

-- create_follow_up_tasks_for_sale se redeclara para usar el helper de
-- arriba en vez de tener la misma cuenta duplicada — mismo comportamiento
-- que en 0029, p_product_name se sigue sin usar por compatibilidad de
-- firma con create_sale/create_apartado.
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
begin
  if p_customer_id is null then
    return;
  end if;

  select name into v_customer_name from customers where id = p_customer_id;

  if v_customer_name is null then
    return;
  end if;

  for r in
    select id, message_template, days_after
    from follow_up_rules
    where trigger_type = 'despues_de_venta' and active = true
  loop
    v_message := follow_up_message_for_sale(p_sale_id, v_customer_name, r.message_template);

    insert into follow_up_tasks (customer_id, rule_id, due_date, sale_id, message_preview)
    values (p_customer_id, r.id, p_sale_date + r.days_after, p_sale_id, v_message);
  end loop;
end;
$$;

-- Cuántas tareas generaría aplicar la regla p_rule_id a ventas
-- anteriores — para mostrar el número antes de confirmar. Misma
-- condición de elegibilidad que backfill_follow_up_tasks_for_rule de
-- abajo: ventas con clienta vinculada, no canceladas, que todavía no
-- tengan una tarea de ESTA regla puntual (así aplicar dos veces no
-- duplica nada).
create or replace function count_backfill_follow_up_tasks(p_rule_id uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int
  from sales sa
  where sa.customer_id is not null
    and sa.payment_status <> 'cancelado'
    and exists (select 1 from follow_up_rules where id = p_rule_id and trigger_type = 'despues_de_venta')
    and not exists (
      select 1 from follow_up_tasks where sale_id = sa.id and rule_id = p_rule_id
    );
$$;

-- Aplica de verdad la regla a las ventas elegibles: due_date = fecha de
-- la venta + days_after de la regla, aunque ya haya pasado (esas quedan
-- directamente atrasadas en "Hoy toca contactar", que ya contempla
-- fechas vencidas). Devuelve cuántas se crearon.
create or replace function backfill_follow_up_tasks_for_rule(p_rule_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule record;
  s record;
  v_message text;
  v_count int := 0;
begin
  if current_profile_id() is null then
    raise exception 'No autorizado';
  end if;

  select * into v_rule from follow_up_rules where id = p_rule_id and trigger_type = 'despues_de_venta';
  if v_rule is null then
    raise exception 'Regla no encontrada o no es de tipo "después de la venta"';
  end if;

  for s in
    select sa.id, sa.customer_id, sa.sale_date, c.name as customer_name
    from sales sa
    join customers c on c.id = sa.customer_id
    where sa.customer_id is not null
      and sa.payment_status <> 'cancelado'
      and not exists (
        select 1 from follow_up_tasks where sale_id = sa.id and rule_id = p_rule_id
      )
  loop
    v_message := follow_up_message_for_sale(s.id, s.customer_name, v_rule.message_template);

    insert into follow_up_tasks (customer_id, rule_id, due_date, sale_id, message_preview)
    values (s.customer_id, p_rule_id, s.sale_date + v_rule.days_after, s.id, v_message);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function follow_up_message_for_sale(uuid, text, text) to authenticated;
grant execute on function count_backfill_follow_up_tasks(uuid) to authenticated;
grant execute on function backfill_follow_up_tasks_for_rule(uuid) to authenticated;
