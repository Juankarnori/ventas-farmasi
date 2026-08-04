-- El inventario deja de ser una bolsa compartida: cada usuaria compra con
-- su propia plata, asi que el stock de cada variante se trackea por
-- usuaria. Los prestamos ahora mueven stock de verdad entre las dos (antes
-- eran solo trazabilidad) y ganan un tercer estado de resolucion
-- ('vendido') que genera una deuda monetaria en vez de mover stock de
-- nuevo. Usamos "profile_id" (no "user_id") para nombrar la columna que
-- apunta a `profiles`, siguiendo la convencion ya usada en el resto del
-- esquema (seller_profile_id, from_profile_id, to_profile_id, etc.) —
-- `profiles.id` es el perfil de negocio (Mama/Yo), distinto de
-- `profiles.user_id` que apunta a auth.users.

create table variant_stock (
  variant_id uuid not null references product_variants (id) on delete cascade,
  profile_id uuid not null references profiles (id),
  stock int not null default 0,
  min_stock int,
  primary key (variant_id, profile_id)
);

create index variant_stock_profile_idx on variant_stock (profile_id);

alter table variant_stock enable row level security;

-- Cualquier usuaria reclamada puede leer el stock de las dos (para ver el
-- panorama del negocio), pero solo puede escribir/ajustar directamente su
-- propia fila. Los movimientos sobre la fila ajena (pedido recibido a
-- nombre de la otra, venta de la otra, prestamo) pasan siempre por las
-- funciones `security definer` de abajo, que se saltan RLS.
create policy variant_stock_select on variant_stock
  for select to authenticated
  using (is_claimed_user());

create policy variant_stock_insert on variant_stock
  for insert to authenticated
  with check (profile_id = current_profile_id());

create policy variant_stock_update on variant_stock
  for update to authenticated
  using (profile_id = current_profile_id())
  with check (profile_id = current_profile_id());

create policy variant_stock_delete on variant_stock
  for delete to authenticated
  using (profile_id = current_profile_id());

-- product_variants.stock pasa a ser un espejo (mantenido por trigger) de
-- la suma de variant_stock de las dos usuarias — sigue sirviendo como
-- "total combinado" para todo lo que ya lo usaba asi (products.stock, que
-- a su vez ya sumaba product_variants.stock desde 0014, sigue en cascada
-- sin cambios).
create or replace function sync_variant_stock()
returns trigger
language plpgsql
as $$
declare
  v_variant_id uuid := coalesce(new.variant_id, old.variant_id);
begin
  update product_variants
  set stock = (select coalesce(sum(stock), 0) from variant_stock where variant_id = v_variant_id)
  where id = v_variant_id;
  return null;
end;
$$;

create trigger variant_stock_sync
after insert or update of stock or delete on variant_stock
for each row execute function sync_variant_stock();

-- Migra el stock existente de cada variante a una fila de variant_stock.
--
-- *** IMPORTANTE ***: el split real por usuaria de lo que YA HABIA en
-- stock no se puede reconstruir — el sistema no tiene forma de saber
-- cuanto de ese stock era de Mama y cuanto de Yo. Como default arbitrario,
-- se le asigna TODO el stock existente al primer perfil creado (el que
-- quede primero por created_at, en la práctica 'mama' por el orden del
-- seed). Después de desplegar esta migración, entren a la app y corrijan
-- a mano — desde el Catálogo (editar cada variante) o Inventario
-- (ajustar) — cuánto es realmente de cada una.
insert into variant_stock (variant_id, profile_id, stock)
select pv.id, (select id from profiles order by created_at asc limit 1), pv.stock
from product_variants pv;

-- stock_movements: se agrega profile_id (de quién era el stock que se
-- movio) y se amplian los tipos para distinguir las dos puntas de un
-- prestamo/devolucion. Los movimientos viejos de tipo 'prestamo' quedan
-- como estaban (no tenían dueño de stock porque antes el prestamo no
-- tocaba stock) — se les asigna el mismo perfil default por defecto solo
-- para que la columna no quede nula, pero no representan un movimiento de
-- stock real.
alter table stock_movements add column profile_id uuid references profiles (id);

update stock_movements
set profile_id = (select id from profiles order by created_at asc limit 1)
where profile_id is null;

alter table stock_movements alter column profile_id set not null;

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
    'devolucion_entrada'
  )
);

-- loans: tercer estado de resolucion 'vendido' (B vendio lo prestado en
-- vez de devolverlo), costo snapshot para calcular la deuda, y marca de
-- cuando se liquido esa deuda entre las dos.
alter table loans drop constraint loans_status_check;
alter table loans add constraint loans_status_check check (status in ('pendiente', 'devuelto', 'vendido'));

alter table loans add column unit_cost numeric(12, 2);
alter table loans add column debt_settled_at timestamptz;

-- Para prestamos ya existentes no hay costo guardado: se usa el costo
-- actual de la variante (o del producto si la variante no tiene override)
-- como mejor aproximacion, tal como pide la consigna.
update loans l
set unit_cost = coalesce(pv.cost_override, p.cost_price)
from product_variants pv
join products p on p.id = pv.product_id
where pv.id = l.variant_id and l.unit_cost is null;

alter table loans alter column unit_cost set not null;

-- Recrea las funciones atomicas para operar sobre variant_stock filtrando
-- siempre por profile_id, nunca sobre un total compartido.

create or replace function mark_order_received(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_order_owner uuid;
  r record;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select created_by into v_order_owner from orders where id = p_order_id and status = 'pendiente';

  if v_order_owner is null then
    raise exception 'Pedido no encontrado o ya recibido';
  end if;

  for r in select variant_id, product_id, quantity from order_items where order_id = p_order_id loop
    insert into variant_stock (variant_id, profile_id, stock)
    values (r.variant_id, v_order_owner, r.quantity)
    on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

    insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
    values (r.variant_id, r.product_id, v_order_owner, 'entrada_pedido', r.quantity, 'orders', p_order_id, v_profile_id);
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
  v_owned_stock int;
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

-- Ajuste manual: siempre sobre el stock propio de quien llama (nunca se
-- puede pisar el de la otra usuaria desde acá, ni pasando su id — la
-- funcion ni siquiera lo recibe como parametro).
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
  v_current_stock int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select product_id into v_product_id from product_variants where id = p_variant_id;

  if v_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  select stock into v_current_stock
  from variant_stock
  where variant_id = p_variant_id and profile_id = v_profile_id
  for update;

  if coalesce(v_current_stock, 0) + p_delta < 0 then
    raise exception 'Ajuste invalido: dejaria el stock en negativo';
  end if;

  insert into variant_stock (variant_id, profile_id, stock)
  values (p_variant_id, v_profile_id, p_delta)
  on conflict (variant_id, profile_id) do update
  set stock = variant_stock.stock + p_delta;

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, note, created_by)
  values (p_variant_id, v_product_id, v_profile_id, 'ajuste_manual', abs(p_delta), p_note, v_profile_id);
end;
$$;

-- Prestamo: mueve stock de verdad. Resta de quien presta, suma a quien
-- recibe (asi la que recibe puede venderlo con las reglas normales).
-- Guarda el costo actual como snapshot para poder calcular la deuda si
-- despues se marca 'vendido'.
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
  v_cost numeric(12, 2);
  v_owned_stock int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  if p_quantity <= 0 then
    raise exception 'La cantidad prestada debe ser mayor a 0';
  end if;

  select pv.product_id, coalesce(pv.cost_override, p.cost_price)
  into v_product_id, v_cost
  from product_variants pv
  join products p on p.id = pv.product_id
  where pv.id = p_variant_id;

  if v_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  select stock into v_owned_stock
  from variant_stock
  where variant_id = p_variant_id and profile_id = p_from_profile_id
  for update;

  if coalesce(v_owned_stock, 0) < p_quantity then
    raise exception 'No podés prestar más de lo que tenés de ese color';
  end if;

  update variant_stock set stock = stock - p_quantity
  where variant_id = p_variant_id and profile_id = p_from_profile_id;

  insert into variant_stock (variant_id, profile_id, stock)
  values (p_variant_id, p_to_profile_id, p_quantity)
  on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

  insert into loans (variant_id, product_id, quantity, from_profile_id, to_profile_id, note, unit_cost, created_by)
  values (p_variant_id, v_product_id, p_quantity, p_from_profile_id, p_to_profile_id, p_note, v_cost, v_profile_id)
  returning id into v_loan_id;

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
  values (p_variant_id, v_product_id, p_from_profile_id, 'prestamo_salida', p_quantity, 'loans', v_loan_id, v_profile_id);

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
  values (p_variant_id, v_product_id, p_to_profile_id, 'prestamo_entrada', p_quantity, 'loans', v_loan_id, v_profile_id);

  return v_loan_id;
end;
$$;

-- Devolucion fisica: revierte el movimiento de stock (resta a quien lo
-- tenia prestado, suma de vuelta a la dueña original).
create or replace function mark_loan_returned(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := current_profile_id();
  v_loan record;
  v_owned_stock int;
begin
  if v_profile_id is null then
    raise exception 'No autorizado';
  end if;

  select * into v_loan from loans where id = p_loan_id and status = 'pendiente';

  if v_loan is null then
    raise exception 'Préstamo no encontrado o ya resuelto';
  end if;

  select stock into v_owned_stock
  from variant_stock
  where variant_id = v_loan.variant_id and profile_id = v_loan.to_profile_id
  for update;

  if coalesce(v_owned_stock, 0) < v_loan.quantity then
    raise exception 'No se puede devolver: ya no tiene ese stock disponible';
  end if;

  update variant_stock set stock = stock - v_loan.quantity
  where variant_id = v_loan.variant_id and profile_id = v_loan.to_profile_id;

  insert into variant_stock (variant_id, profile_id, stock)
  values (v_loan.variant_id, v_loan.from_profile_id, v_loan.quantity)
  on conflict (variant_id, profile_id) do update set stock = variant_stock.stock + excluded.stock;

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
  values (v_loan.variant_id, v_loan.product_id, v_loan.to_profile_id, 'devolucion_salida', v_loan.quantity, 'loans', p_loan_id, v_profile_id);

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, reference_table, reference_id, created_by)
  values (v_loan.variant_id, v_loan.product_id, v_loan.from_profile_id, 'devolucion_entrada', v_loan.quantity, 'loans', p_loan_id, v_profile_id);

  update loans set status = 'devuelto', returned_at = now() where id = p_loan_id;
end;
$$;

-- B vendio lo prestado en vez de devolverlo. La venta normal (create_sale)
-- ya bajo el stock de B por su cuenta; acá no se toca stock de nuevo,
-- solo se cierra el prestamo dejando una deuda monetaria pendiente de A
-- hacia... al reves: B le debe a A el costo de lo que le vendio.
create or replace function mark_loan_sold(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_profile_id() is null then
    raise exception 'No autorizado';
  end if;

  update loans set status = 'vendido', returned_at = now()
  where id = p_loan_id and status = 'pendiente';

  if not found then
    raise exception 'Préstamo no encontrado o ya resuelto';
  end if;
end;
$$;

-- Liquida de una todas las deudas monetarias pendientes (prestamos
-- 'vendido' sin liquidar) — no mueve stock, solo cierra la cuenta.
create or replace function settle_loan_debts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_profile_id() is null then
    raise exception 'No autorizado';
  end if;

  update loans set debt_settled_at = now()
  where status = 'vendido' and debt_settled_at is null;
end;
$$;
