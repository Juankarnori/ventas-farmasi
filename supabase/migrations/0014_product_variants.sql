-- Modelo de producto padre + variantes de color. Cada producto pasa a
-- tener 1 o mas variantes (color_name, stock, y overrides opcionales de
-- precio/costo/imagen). El stock, las ventas, los pedidos y los prestamos
-- se registran siempre a nivel de variante, nunca a nivel de producto.

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  color_name text not null,
  color_hex text,
  sku text,
  stock int not null default 0,
  min_stock int,
  price_override numeric(12, 2),
  cost_override numeric(12, 2),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx on product_variants (product_id);

alter table product_variants enable row level security;

create policy product_variants_all on product_variants
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

-- products.stock pasa a ser un espejo (mantenido por trigger) de la suma
-- del stock de todas las variantes del producto. Se deja la columna para
-- no romper las vistas/paginas que ya la usan como agregado a nivel de
-- producto (catalogo, alertas de Finanzas).
create or replace function sync_product_stock()
returns trigger
language plpgsql
as $$
declare
  v_product_id uuid := coalesce(new.product_id, old.product_id);
begin
  update products
  set stock = (select coalesce(sum(stock), 0) from product_variants where product_id = v_product_id)
  where id = v_product_id;
  return null;
end;
$$;

create trigger product_variants_sync_stock
after insert or update of stock or delete on product_variants
for each row execute function sync_product_stock();

-- Migra cada producto existente a una unica variante "Unico", copiando su
-- stock actual. Ningun producto queda sin variante. Como la variante nace
-- con el mismo stock que ya tenia el producto, el trigger de arriba
-- recalcula products.stock al mismo valor (no-op en la practica).
insert into product_variants (product_id, color_name, stock)
select id, 'Único', stock from products;

-- order_items: cada item ahora apunta a una variante especifica. Se deja
-- product_id ademas de variant_id (no se dropea) para no romper joins ni
-- filtros existentes que ya usan product_id; el stock se calcula siempre
-- desde variant_id.
alter table order_items add column variant_id uuid references product_variants (id) on delete restrict;

update order_items oi
set variant_id = pv.id
from product_variants pv
where pv.product_id = oi.product_id and pv.color_name = 'Único';

alter table order_items alter column variant_id set not null;
create index order_items_variant_idx on order_items (variant_id);

-- sale_items: idem.
alter table sale_items add column variant_id uuid references product_variants (id) on delete restrict;

update sale_items si
set variant_id = pv.id
from product_variants pv
where pv.product_id = si.product_id and pv.color_name = 'Único';

alter table sale_items alter column variant_id set not null;
create index sale_items_variant_idx on sale_items (variant_id);

-- loans: idem.
alter table loans add column variant_id uuid references product_variants (id) on delete restrict;

update loans l
set variant_id = pv.id
from product_variants pv
where pv.product_id = l.product_id and pv.color_name = 'Único';

alter table loans alter column variant_id set not null;
create index loans_variant_idx on loans (variant_id);

-- stock_movements: idem, pero on delete cascade (es solo un log, no hace
-- falta bloquear el borrado de una variante por sus movimientos viejos;
-- de todos modos order_items/sale_items/loans ya lo bloquean antes).
alter table stock_movements add column variant_id uuid references product_variants (id) on delete cascade;

update stock_movements sm
set variant_id = pv.id
from product_variants pv
where pv.product_id = sm.product_id and pv.color_name = 'Único';

alter table stock_movements alter column variant_id set not null;
create index stock_movements_variant_idx on stock_movements (variant_id);

-- Recrea las funciones atomicas para operar sobre product_variants.stock
-- en vez de products.stock. Las firmas (nombre + tipos de argumentos) se
-- mantienen identicas donde es posible, asi que `create or replace`
-- alcanza sin necesidad de dropear nada.

create or replace function mark_order_received(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  r record;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if not exists (select 1 from orders where id = p_order_id and status = 'pendiente') then
    raise exception 'Pedido no encontrado o ya recibido';
  end if;

  for r in select variant_id, product_id, quantity from order_items where order_id = p_order_id loop
    update product_variants set stock = stock + r.quantity, updated_at = now() where id = r.variant_id;

    insert into stock_movements (variant_id, product_id, type, quantity, reference_table, reference_id, created_by)
    values (r.variant_id, r.product_id, 'entrada_pedido', r.quantity, 'orders', p_order_id, v_profile_id);
  end loop;

  update orders set status = 'recibido', received_at = now() where id = p_order_id;
end;
$$;

create or replace function create_sale(
  p_customer_name text,
  p_sale_date date,
  p_items jsonb
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
  v_current_stock int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'La venta necesita al menos un producto';
  end if;

  insert into sales (sale_date, customer_name, seller_profile_id)
  values (coalesce(p_sale_date, current_date), nullif(p_customer_name, ''), v_profile_id)
  returning id into v_sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (item ->> 'variant_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_sale_price := (item ->> 'sale_price')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para variante %', v_variant_id;
    end if;

    select pv.product_id, pv.stock, coalesce(pv.cost_override, p.cost_price)
    into v_product_id, v_current_stock, v_cost
    from product_variants pv
    join products p on p.id = pv.product_id
    where pv.id = v_variant_id
    for update of pv;

    if v_current_stock is null then
      raise exception 'Variante % no encontrada', v_variant_id;
    end if;

    if v_current_stock < v_qty then
      raise exception 'Stock insuficiente para variante %', v_variant_id;
    end if;

    insert into sale_items (sale_id, variant_id, product_id, quantity, sale_price, cost_price)
    values (v_sale_id, v_variant_id, v_product_id, v_qty, v_sale_price, v_cost);

    update product_variants set stock = stock - v_qty, updated_at = now() where id = v_variant_id;

    insert into stock_movements (variant_id, product_id, type, quantity, reference_table, reference_id, created_by)
    values (v_variant_id, v_product_id, 'salida_venta', v_qty, 'sales', v_sale_id, v_profile_id);
  end loop;

  return v_sale_id;
end;
$$;

create or replace function adjust_stock(
  p_variant_id uuid,
  p_delta int,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_product_id uuid;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select product_id into v_product_id from product_variants where id = p_variant_id;

  if v_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  update product_variants
  set stock = stock + p_delta, updated_at = now()
  where id = p_variant_id and stock + p_delta >= 0;

  if not found then
    raise exception 'Ajuste invalido: dejaria el stock en negativo';
  end if;

  insert into stock_movements (variant_id, product_id, type, quantity, note, created_by)
  values (p_variant_id, v_product_id, 'ajuste_manual', abs(p_delta), p_note, v_profile_id);
end;
$$;

create or replace function create_loan(
  p_variant_id uuid,
  p_quantity int,
  p_from_profile_id uuid,
  p_to_profile_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_loan_id uuid;
  v_product_id uuid;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad prestada debe ser mayor a 0';
  end if;

  select product_id into v_product_id from product_variants where id = p_variant_id;
  if v_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  insert into loans (variant_id, product_id, quantity, from_profile_id, to_profile_id, note, created_by)
  values (p_variant_id, v_product_id, p_quantity, p_from_profile_id, p_to_profile_id, p_note, v_profile_id)
  returning id into v_loan_id;

  insert into stock_movements (variant_id, product_id, type, quantity, reference_table, reference_id, created_by)
  values (p_variant_id, v_product_id, 'prestamo', p_quantity, 'loans', v_loan_id, v_profile_id);

  return v_loan_id;
end;
$$;

create or replace function create_order(
  p_order_date date,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_order_id uuid;
  item jsonb;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty int;
  v_unit_cost numeric(12, 2);
  v_total numeric(12, 2) := 0;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'El pedido necesita al menos un producto';
  end if;

  insert into orders (order_date, created_by, status)
  values (coalesce(p_order_date, current_date), v_profile_id, 'pendiente')
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(p_items) loop
    v_variant_id := (item ->> 'variant_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    v_unit_cost := (item ->> 'unit_cost')::numeric;

    if v_qty <= 0 then
      raise exception 'Cantidad invalida para variante %', v_variant_id;
    end if;

    select product_id into v_product_id from product_variants where id = v_variant_id;
    if v_product_id is null then
      raise exception 'Variante % no encontrada', v_variant_id;
    end if;

    insert into order_items (order_id, variant_id, product_id, quantity, unit_cost)
    values (v_order_id, v_variant_id, v_product_id, v_qty, v_unit_cost);

    v_total := v_total + (v_qty * v_unit_cost);
  end loop;

  update orders set total_cost = v_total where id = v_order_id;

  return v_order_id;
end;
$$;
