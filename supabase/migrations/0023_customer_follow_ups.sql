-- Seguimiento de clientas: fecha de nacimiento + reglas configurables de
-- recordatorio (post-venta y cumpleaños) + las tareas concretas que esas
-- reglas van generando. Nada de esto manda mensajes solo — WhatsApp no
-- permite envío automático sin la API de negocios de Meta (paga, con
-- verificación) — así que el flujo real es: la app arma el mensaje y deja
-- la tarea lista, la usuaria hace clic y lo manda ella misma desde su
-- WhatsApp.
--
-- follow_up_rules / follow_up_tasks quedan compartidas entre todas las
-- usuarias (mismo criterio que `customers`, no el de `sales`/`orders`):
-- las reglas de seguimiento y el "hoy toca contactar" le sirven al equipo
-- entero, no tiene sentido partirlas por usuaria.

alter table customers add column birth_date date;

create table follow_up_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null check (trigger_type in ('despues_de_venta', 'cumpleanos')),
  -- Solo aplica (y es obligatorio) para trigger_type = 'despues_de_venta';
  -- para 'cumpleanos' tiene que quedar null (el "día" ya lo da la fecha de
  -- nacimiento, no hay nada que contar).
  days_after int,
  message_template text not null,
  active boolean not null default true,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  constraint follow_up_rules_days_after_check check (
    (trigger_type = 'despues_de_venta' and days_after is not null and days_after > 0)
    or (trigger_type = 'cumpleanos' and days_after is null)
  )
);

alter table follow_up_rules enable row level security;

create policy follow_up_rules_all on follow_up_rules
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

create table follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  rule_id uuid not null references follow_up_rules (id) on delete cascade,
  due_date date not null,
  status text not null default 'pendiente' check (status in ('pendiente', 'hecho', 'omitido')),
  -- Solo se completa cuando la tarea vino de una venta puntual (reglas
  -- 'despues_de_venta'); las de cumpleaños no tienen venta de origen.
  -- `on delete set null` porque la tarea de seguimiento sigue teniendo
  -- sentido aunque la venta que la originó se borre (no debería pasar,
  -- pero no hay motivo para arrastrar la tarea con ella).
  sale_id uuid references sales (id) on delete set null,
  -- El mensaje ya armado (placeholders {nombre}/{producto} resueltos) se
  -- guarda en el momento de crear la tarea — así el historial no cambia
  -- si después se edita la plantilla de la regla o el nombre de la
  -- clienta.
  message_preview text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references profiles (id)
);

create index follow_up_tasks_customer_idx on follow_up_tasks (customer_id);
create index follow_up_tasks_pending_due_idx on follow_up_tasks (due_date) where status = 'pendiente';

alter table follow_up_tasks enable row level security;

create policy follow_up_tasks_all on follow_up_tasks
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

-- Genera, para una venta recién confirmada, una follow_up_task por cada
-- regla activa de tipo 'despues_de_venta' — llamada desde create_sale y
-- create_apartado. No hace nada si la venta no tiene clienta vinculada
-- (customer_id null): no hay a quién contactar.
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
    v_message := replace(
      replace(r.message_template, '{nombre}', v_customer_name),
      '{producto}', coalesce(p_product_name, 'tu compra')
    );

    insert into follow_up_tasks (customer_id, rule_id, due_date, sale_id, message_preview)
    values (p_customer_id, r.id, p_sale_date + r.days_after, p_sale_id, v_message);
  end loop;
end;
$$;

-- create_sale y create_apartado se redeclaran con dos agregados mínimos:
-- 1) capturan el nombre del primer producto de la venta (para el
--    placeholder {producto}); 2) al final, generan las tareas de
--    seguimiento correspondientes. El resto del cuerpo es idéntico al de
--    0020_customers.sql.

create or replace function create_sale(
  p_customer_name text,
  p_sale_date date,
  p_items jsonb,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_sale_id uuid;
  item jsonb;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty int;
  v_sale_price numeric(12, 2);
  v_cost numeric(12, 2);
  v_owned_stock int;
  v_first_product_name text;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto';
  end if;

  insert into sales (sale_date, customer_name, customer_id, seller_profile_id)
  values (coalesce(p_sale_date, current_date), nullif(p_customer_name, ''), p_customer_id, v_profile_id)
  returning id into v_sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (item ->> 'variant_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_sale_price := (item ->> 'sale_price')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para variante %', v_variant_id;
    end if;

    select pv.product_id, coalesce(pv.cost_override, p.cost_price)
    into v_product_id, v_cost
    from product_variants pv
    join products p on p.id = pv.product_id
    where pv.id = v_variant_id;

    if v_product_id is null then
      raise exception 'Variante % no encontrada', v_variant_id;
    end if;

    if v_first_product_name is null then
      select name into v_first_product_name from products where id = v_product_id;
    end if;

    select stock into v_owned_stock
    from variant_stock
    where variant_id = v_variant_id and profile_id = v_profile_id
    for update;

    if coalesce(v_owned_stock, 0) < v_qty then
      raise exception 'No tenés suficiente stock propio de este color. ¿Es un producto prestado? Registrá el préstamo primero.';
    end if;

    insert into sale_items (sale_id, variant_id, product_id, quantity, sale_price, cost_price)
    values (v_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost);

    update variant_stock set stock = stock - v_qty
    where variant_id = v_variant_id and profile_id = v_profile_id;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
    values (v_variant_id, v_product_id, v_profile_id, 'salida_venta', v_qty, 'sales', v_sale_id, v_profile_id);
  end loop;

  perform create_follow_up_tasks_for_sale(
    v_sale_id, p_customer_id, coalesce(p_sale_date, current_date), v_first_product_name
  );

  return v_sale_id;
end;
$$;

create or replace function create_apartado(
  p_customer_name text,
  p_customer_phone text,
  p_sale_date date,
  p_items jsonb,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_sale_id uuid;
  item jsonb;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty int;
  v_sale_price numeric(12, 2);
  v_cost numeric(12, 2);
  v_owned_stock int;
  v_total numeric(12, 2) := 0;
  v_first_product_name text;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'El apartado necesita al menos un producto';
  end if;

  if nullif(trim(p_customer_name), '') is null then
    raise exception 'El apartado necesita el nombre de la clienta';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + ((item ->> 'quantity')::int * (item ->> 'sale_price')::numeric);
  end loop;

  insert into sales (
    sale_date, customer_name, customer_phone, customer_id, seller_profile_id, payment_status, total_price
  )
  values (
    coalesce(p_sale_date, current_date),
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''),
    p_customer_id,
    v_profile_id,
    'con_abonos',
    v_total
  )
  returning id into v_sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (item ->> 'variant_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_sale_price := (item ->> 'sale_price')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para variante %', v_variant_id;
    end if;

    select pv.product_id, coalesce(pv.cost_override, p.cost_price)
    into v_product_id, v_cost
    from product_variants pv
    join products p on p.id = pv.product_id
    where pv.id = v_variant_id;

    if v_product_id is null then
      raise exception 'Variante % no encontrada', v_variant_id;
    end if;

    if v_first_product_name is null then
      select name into v_first_product_name from products where id = v_product_id;
    end if;

    select stock into v_owned_stock
    from variant_stock
    where variant_id = v_variant_id and profile_id = v_profile_id
    for update;

    if coalesce(v_owned_stock, 0) < v_qty then
      raise exception 'No tenés suficiente stock propio de este color. ¿Es un producto prestado? Registrá el préstamo primero.';
    end if;

    insert into sale_items (sale_id, variant_id, product_id, quantity, sale_price, cost_price, delivered)
    values (v_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost, false);

    update variant_stock set stock = stock - v_qty
    where variant_id = v_variant_id and profile_id = v_profile_id;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
    values (v_variant_id, v_product_id, v_profile_id, 'salida_venta', v_qty, 'sales', v_sale_id, v_profile_id);
  end loop;

  -- El apartado también dispara seguimiento post-venta: aplica el mismo
  -- criterio que una venta de contado (la clienta ya se llevó — o
  -- reservó — el producto).
  perform create_follow_up_tasks_for_sale(
    v_sale_id, p_customer_id, coalesce(p_sale_date, current_date), v_first_product_name
  );

  return v_sale_id;
end;
$$;

-- Marca una tarea de seguimiento como resuelta ('hecho' tras contactar
-- de verdad, u 'omitido' si esta vez no correspondía). No se puede
-- volver a resolver una tarea ya resuelta.
create or replace function complete_follow_up_task(p_task_id uuid, p_status text)
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

  if p_status not in ('hecho', 'omitido') then
    raise exception 'Estado inválido';
  end if;

  update follow_up_tasks
  set status = p_status, completed_at = now(), completed_by = v_profile_id
  where id = p_task_id and status = 'pendiente';

  if not found then
    raise exception 'Tarea no encontrada o ya resuelta';
  end if;
end;
$$;

-- Revisa cumpleaños de hoy (mes+día de birth_date, sin importar el año) y
-- crea la tarea correspondiente por cada regla activa de tipo
-- 'cumpleanos' — una vez por clienta+regla+día (el `not exists` evita
-- duplicar si el cron corre más de una vez el mismo día). Se llama desde
-- la ruta /api/cron/birthday-check (Vercel Cron, sin sesión de usuaria) y
-- también se puede disparar a mano desde Reglas de seguimiento para
-- probar — por eso está `security definer` y otorgada también a `anon`,
-- no solo a `authenticated`.
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
        v_message := replace(replace(r.message_template, '{nombre}', c.name), '{producto}', '');

        insert into follow_up_tasks (customer_id, rule_id, due_date, message_preview)
        values (c.id, r.id, current_date, v_message);
      end if;
    end loop;
  end loop;
end;
$$;

grant execute on function create_follow_up_tasks_for_sale(uuid, uuid, date, text) to authenticated;
grant execute on function complete_follow_up_task(uuid, text) to authenticated;
grant execute on function run_birthday_check() to authenticated, anon;
