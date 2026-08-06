-- Registro de clientas: nombre, teléfono y notas de preferencias, para
-- poder hacerles seguimiento (qué compran, cuánto gastan). No toda venta
-- tiene una clienta formal — sigue siendo válido dejarlo en blanco para
-- una venta anónima de mostrador.

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_name_idx on customers (name);

alter table customers enable row level security;

create policy customers_all on customers
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

-- customer_id es el dato de verdad cuando está presente. customer_name
-- (texto libre, ya existía para apartados) queda como respaldo/legado
-- para ventas viejas o ventas anónimas sin cliente formal vinculado.
--
-- *** Decisión sobre backfill ***: NO se crean customers automáticamente
-- a partir de los customer_name de texto libre que ya existan (de
-- apartados previos a esta migración). Generar registros de clientes a
-- partir de texto sin validar es el tipo de cosa que ensucia un CRM desde
-- el día uno — nombres repetidos con variaciones ("Ana", "Anita"),
-- apodos, errores de tipeo, etc. terminarían como clientes "reales"
-- separados sin que nadie lo haya decidido a conciencia. Se deja que la
-- administradora vincule a mano, desde la ficha de cada venta vieja si
-- quiere, los pocos casos que realmente le importe formalizar — el dato
-- crudo (customer_name) no se pierde ni se toca.
alter table sales add column customer_id uuid references customers (id) on delete set null;

create index sales_customer_idx on sales (customer_id);

-- Se agrega p_customer_id (nullable, al final) a las dos RPCs que crean
-- ventas — create or replace alcanza porque solo se agrega un parámetro
-- nuevo con default al final, no se toca ninguno existente.
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

  return v_sale_id;
end;
$$;
