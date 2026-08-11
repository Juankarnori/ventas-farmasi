-- Investigando el bug "una regla de seguimiento recién creada no usa su
-- propio texto" (create_follow_up_tasks_for_sale / follow_up_message_for_sale):
-- esas dos funciones están bien — leen message_template en vivo de
-- follow_up_rules en el momento de crear cada tarea, nunca un valor
-- cacheado, y su firma nunca cambió de tamaño entre migraciones así que
-- `create or replace` siempre las reemplazó in-place sin dejar
-- versiones viejas colgando.
--
-- Lo que SÍ se encontró, con el mismo patrón que ya causó el bug de
-- create_loan (0033/0037): create_sale y create_apartado — las dos
-- funciones que llaman a create_follow_up_tasks_for_sale al final —
-- fueron ganando parámetros nuevos con default a lo largo de varias
-- migraciones (0011→0020→0025 para create_sale; 0016→0020→0025 para
-- create_apartado) y NINGUNA de esas migraciones dropeó la firma
-- anterior. Resultado: hoy coexisten 3 versiones de cada una en la base
-- (create_sale de 3, 4 y 6 parámetros; create_apartado de 4, 5 y 7).
--
-- En la práctica esto no se manifestó como el mismo error de
-- "ambigüedad" que create_loan porque el único código que llama a estas
-- dos funciones (ventas/actions.ts) siempre manda los 6/7 parámetros
-- completos por nombre, así que PostgREST solo puede resolverlo contra
-- la versión más nueva — pero es exactamente el mismo riesgo latente que
-- ya mordió dos veces este proyecto, así que se limpia acá con el mismo
-- patrón: se dropean todas las firmas conocidas y se recrea la vigente
-- desde cero, en vez de confiar en que "las viejas no molestan".
drop function if exists create_sale(text, date, jsonb);
drop function if exists create_sale(text, date, jsonb, uuid);
drop function if exists create_sale(text, date, jsonb, uuid, text, text);

drop function if exists create_apartado(text, text, date, jsonb);
drop function if exists create_apartado(text, text, date, jsonb, uuid);
drop function if exists create_apartado(text, text, date, jsonb, uuid, text, text);

create or replace function create_sale(
  p_customer_name text,
  p_sale_date date,
  p_items jsonb,
  p_customer_id uuid default null,
  p_payment_method text default 'efectivo',
  p_bank_note text default null
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
  v_total numeric(12, 2) := 0;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if p_payment_method not in ('efectivo', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + ((item ->> 'quantity')::int * (item ->> 'sale_price')::numeric);
  end loop;

  insert into sales (
    sale_date, customer_name, customer_id, seller_profile_id, total_price, payment_method, bank_note
  )
  values (
    coalesce(p_sale_date, current_date),
    nullif(p_customer_name, ''),
    p_customer_id,
    v_profile_id,
    v_total,
    p_payment_method,
    case when p_payment_method = 'transferencia' then nullif(trim(coalesce(p_bank_note, '')), '') else null end
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
  p_customer_id uuid default null,
  p_payment_method text default 'efectivo',
  p_bank_note text default null
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

  if p_payment_method not in ('efectivo', 'transferencia') then
    raise exception 'Método de pago inválido';
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
    sale_date, customer_name, customer_phone, customer_id, seller_profile_id, payment_status, total_price,
    payment_method, bank_note
  )
  values (
    coalesce(p_sale_date, current_date),
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''),
    p_customer_id,
    v_profile_id,
    'con_abonos',
    v_total,
    p_payment_method,
    case when p_payment_method = 'transferencia' then nullif(trim(coalesce(p_bank_note, '')), '') else null end
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

  perform create_follow_up_tasks_for_sale(
    v_sale_id, p_customer_id, coalesce(p_sale_date, current_date), v_first_product_name
  );

  return v_sale_id;
end;
$$;

grant execute on function create_sale(text, date, jsonb, uuid, text, text) to authenticated;
grant execute on function create_apartado(text, text, date, jsonb, uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
