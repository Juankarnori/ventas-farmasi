-- Apartados: la clienta reserva uno o mas productos y los va pagando de a
-- poco (abonos) hasta completar el total. Reglas de negocio confirmadas:
-- 1) el stock se descuenta desde que se crea el apartado, no cuando
--    termina de pagar (para que no se pueda vender dos veces); 2) la
--    ganancia solo entra a Finanzas cuando el saldo llega a $0.

alter table sales add column payment_status text not null default 'pagado' check (
  payment_status in ('pagado', 'con_abonos', 'completado', 'cancelado')
);
alter table sales add column customer_phone text;
alter table sales add column total_price numeric(12, 2);

-- Ventas que ya existían eran todas de contado: snapshot del total a
-- partir de sus items para no dejar la columna en null.
update sales s
set total_price = coalesce(
  (select sum(si.sale_price * si.quantity) from sale_items si where si.sale_id = s.id),
  0
)
where total_price is null;

alter table sales alter column total_price set not null;

-- delivered: default true para que las ventas de contado existentes (y
-- las nuevas) queden "ya entregadas" sin tocarlas; los apartados nuevos
-- lo setean explícitamente en false por item desde create_apartado.
alter table sale_items add column delivered boolean not null default true;

create table sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text,
  profile_id uuid not null references profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create index sale_payments_sale_idx on sale_payments (sale_id);

alter table sale_payments enable row level security;

create policy sale_payments_all on sale_payments
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

-- amount_paid/balance se calculan al vuelo (no se guardan aparte para que
-- no se puedan desincronizar del historial real de abonos).
create view sale_balances
with (security_invoker = true) as
select
  s.id as sale_id,
  s.total_price,
  coalesce(sum(sp.amount), 0) as amount_paid,
  s.total_price - coalesce(sum(sp.amount), 0) as balance
from sales s
left join sale_payments sp on sp.sale_id = s.id
group by s.id, s.total_price;

alter table stock_movements drop constraint stock_movements_type_check;
alter table stock_movements add constraint stock_movements_type_check check (
  type in (
    'entrada_pedido',
    'salida_venta',
    'ajuste_manual',
    'prestamo',
    'prestamo_salida',
    'prestamo_entrada',
    'devolucion_salida',
    'devolucion_entrada',
    'apartado_cancelado'
  )
);

-- Crear un apartado: descuenta el stock propio de inmediato (misma
-- validacion de stock que create_sale), pero la venta queda 'con_abonos'
-- y sus items sin entregar hasta que se marquen uno a uno.
create or replace function create_apartado(
  p_customer_name text,
  p_customer_phone text,
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
    sale_date, customer_name, customer_phone, seller_profile_id, payment_status, total_price
  )
  values (
    coalesce(p_sale_date, current_date),
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''),
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

-- Registrar un abono. Si con este abono el total pagado llega o supera el
-- total del apartado, pasa a 'completado' — recien ahi su ganancia entra
-- a Finanzas.
create or replace function register_payment(
  p_sale_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_method text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_sale record;
  v_amount_paid numeric(12, 2);
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if p_amount <= 0 then
    raise exception 'El monto del abono debe ser mayor a 0';
  end if;

  select * into v_sale from sales where id = p_sale_id and payment_status = 'con_abonos';

  if v_sale is null then
    raise exception 'Apartado no encontrado o ya resuelto';
  end if;

  insert into sale_payments (sale_id, amount, payment_date, method, profile_id, note)
  values (
    p_sale_id,
    p_amount,
    coalesce(p_payment_date, current_date),
    nullif(trim(coalesce(p_method, '')), ''),
    v_profile_id,
    nullif(trim(coalesce(p_note, '')), '')
  );

  select coalesce(sum(amount), 0) into v_amount_paid from sale_payments where sale_id = p_sale_id;

  if v_amount_paid >= v_sale.total_price then
    update sales set payment_status = 'completado' where id = p_sale_id;
  end if;
end;
$$;

-- Marcar un producto puntual del apartado como entregado, independiente
-- de si ya terminó de pagar o no.
create or replace function mark_item_delivered(p_sale_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_profile_id() is null then
    raise exception 'No autorizado';
  end if;

  update sale_items set delivered = true where id = p_sale_item_id;

  if not found then
    raise exception 'Producto no encontrado';
  end if;
end;
$$;

-- Cancelar un apartado antes de que termine de pagar: devuelve el stock
-- reservado al inventario de la vendedora. No se permite si ya se
-- entregó algún producto (ese ya salió físicamente, no se puede "recuperar"
-- solo revirtiendo un número en la base).
create or replace function cancel_apartado(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_seller uuid;
  r record;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select seller_profile_id into v_seller from sales where id = p_sale_id and payment_status = 'con_abonos';

  if v_seller is null then
    raise exception 'Apartado no encontrado o ya resuelto';
  end if;

  if exists (select 1 from sale_items where sale_id = p_sale_id and delivered = true) then
    raise exception 'No se puede cancelar: ya entregaste productos de este apartado';
  end if;

  for r in select variant_id, product_id, quantity from sale_items where sale_id = p_sale_id loop
    insert into variant_stock (variant_id, profile_id, stock)
    values (r.variant_id, v_seller, r.quantity)
    on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
    values (r.variant_id, r.product_id, v_seller, 'apartado_cancelado', r.quantity, 'sales', p_sale_id, v_profile_id);
  end loop;

  update sales set payment_status = 'cancelado' where id = p_sale_id;
end;
$$;

grant execute on function create_apartado(text, text, date, jsonb) to authenticated;
grant execute on function register_payment(uuid, numeric, date, text, text) to authenticated;
grant execute on function mark_item_delivered(uuid) to authenticated;
grant execute on function cancel_apartado(uuid) to authenticated;
