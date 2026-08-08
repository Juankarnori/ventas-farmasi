-- Dos correcciones a Reglas de seguimiento:
--
-- 1. El placeholder solo se reconocía como {producto} (singular). Desde
--    que puede representar varios productos a la vez (ver 0029), tiene
--    más sentido documentarlo como {productos} (plural) — pero las
--    reglas ya guardadas en singular (o nuevas que alguien escriba así)
--    tienen que seguir funcionando, así que se aceptan las dos formas.
--
-- 2. Borrado de reglas: si nunca generaron ninguna tarea, se borran
--    directo; si ya generaron alguna (sin importar su estado), se
--    bloquea con un mensaje que explica por qué y sugiere desactivar en
--    su lugar — desactivar ya existía, esto no lo reemplaza, solo dice
--    cuándo conviene usar cada uno.

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

  return replace(
    replace(replace(p_message_template, '{nombre}', p_customer_name), '{productos}', v_product_list),
    '{producto}', v_product_list
  );
end;
$$;

-- run_birthday_check también arma un mensaje con placeholders (sin
-- producto, un cumpleaños no viene de ninguna venta puntual) — mismo
-- ajuste: acepta las dos formas.
create or replace function run_birthday_check()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  r record;
  v_message text;
begin
  for c in
    select id, name
    from customers
    where birth_date is not null
      and extract(month from birth_date) = extract(month from current_date)
      and extract(day from birth_date) = extract(day from current_date)
  loop
    for r in
      select id, message_template
      from follow_up_rules
      where trigger_type = 'cumpleanos' and active = true
    loop
      if not exists (
        select 1 from follow_up_tasks
        where customer_id = c.id and rule_id = r.id and due_date = current_date
      ) then
        v_message := replace(
          replace(replace(r.message_template, '{nombre}', c.name), '{productos}', ''),
          '{producto}', ''
        );

        insert into follow_up_tasks (customer_id, rule_id, due_date, message_preview)
        values (c.id, r.id, current_date, v_message);
      end if;
    end loop;
  end loop;
end;
$$;

-- Borra una regla si nunca generó ninguna tarea; si ya generó alguna
-- (pendiente, hecha u omitida — cualquier estado cuenta como historial),
-- rechaza el borrado con un mensaje que dice cuántas y sugiere
-- desactivar en su lugar, en vez de perder ese historial en silencio
-- (mismo espíritu que delete_customer en 0027).
create or replace function delete_follow_up_rule(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_count int;
begin
  if current_profile_id() is null then
    raise exception 'No autorizado';
  end if;

  select count(*) into v_task_count from follow_up_tasks where rule_id = p_rule_id;

  if v_task_count > 0 then
    raise exception 'Esta regla ya generó % tarea% de seguimiento. Para conservar ese historial, desactivala en vez de eliminarla.',
      v_task_count, case when v_task_count = 1 then '' else 's' end;
  end if;

  delete from follow_up_rules where id = p_rule_id;

  if not found then
    raise exception 'Regla no encontrada';
  end if;
end;
$$;

grant execute on function delete_follow_up_rule(uuid) to authenticated;
