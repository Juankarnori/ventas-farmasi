-- Uso personal: alguien toma un producto para consumo propio, no para
-- vender. Descuenta inventario real, pero nunca debe aparecer como venta
-- ni como ganancia en Finanzas — por eso es una tabla separada de
-- `sales`, no una venta con precio $0 (eso sí ensuciaría el historial de
-- ventas y las métricas).
create table personal_use (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants (id) on delete restrict,
  product_id uuid not null references products (id) on delete restrict,
  profile_id uuid not null references profiles (id),
  quantity int not null check (quantity > 0),
  note text,
  used_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index personal_use_profile_idx on personal_use (profile_id);
create index personal_use_used_at_idx on personal_use (used_at);

alter table personal_use enable row level security;

-- Compartido, mismo criterio que loans/stock_movements: cualquiera del
-- equipo puede ver el historial de uso personal de cualquiera (es
-- información de inventario, no financiera privada), y el filtro por
-- usuaria en la UI es solo para ordenar la vista, no una restricción de
-- acceso.
create policy personal_use_all on personal_use
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

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
    'apartado_cancelado',
    'ajuste_venta',
    'uso_personal'
  )
);

-- Descuenta el stock propio de quien llama y registra el renglón de uso
-- personal — mismo patrón que adjust_stock (nunca deja el stock en
-- negativo), pero identificado como consumo propio, no como un ajuste
-- manual genérico: así el historial de Inventario y el de Uso personal
-- pueden distinguir un caso del otro sin ambigüedad.
create or replace function register_personal_use(
  p_variant_id uuid,
  p_quantity int,
  p_note text,
  p_used_at date
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

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad tiene que ser mayor a 0';
  end if;

  select product_id into v_product_id from product_variants where id = p_variant_id;
  if v_product_id is null then
    raise exception 'Variante no encontrada';
  end if;

  select stock into v_current_stock
  from variant_stock
  where variant_id = p_variant_id and profile_id = v_profile_id
  for update;

  if coalesce(v_current_stock, 0) < p_quantity then
    raise exception 'No tenés suficiente stock propio de este color';
  end if;

  update variant_stock set stock = stock - p_quantity
  where variant_id = p_variant_id and profile_id = v_profile_id;

  insert into personal_use (variant_id, product_id, profile_id, quantity, note, used_at)
  values (p_variant_id, v_product_id, v_profile_id, p_quantity, nullif(trim(coalesce(p_note, '')), ''), coalesce(p_used_at, current_date));

  insert into stock_movements (variant_id, product_id, profile_id, type, quantity, note, created_by)
  values (p_variant_id, v_product_id, v_profile_id, 'uso_personal', p_quantity, p_note, v_profile_id);
end;
$$;

grant execute on function register_personal_use(uuid, int, text, date) to authenticated;

-- Saldo pendiente por clienta (suma de `balance` de sus apartados
-- 'con_abonos') — mismo criterio que list_customer_totals: agregado del
-- negocio entero, no filtrado por usuaria, para el badge del listado de
-- Clientes. Solo devuelve clientas con saldo > 0 (nada que mostrar si ya
-- no deben nada).
create or replace function list_customer_pending_balances()
returns table (
  customer_id uuid,
  pending_balance numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_claimed_user() then
    raise exception 'No autorizado';
  end if;

  return query
  select s.customer_id, sum(sb.balance) as pending_balance
  from sales s
  join sale_balances sb on sb.sale_id = s.id
  where s.customer_id is not null
    and s.payment_status = 'con_abonos'
  group by s.customer_id
  having sum(sb.balance) > 0;
end;
$$;

grant execute on function list_customer_pending_balances() to authenticated;

-- Apartados de una clienta puntual, con total/abonado/saldo — mismo
-- motivo que get_customer_purchase_history: si Mamá y Yo le vendemos las
-- dos a la misma clienta, las dos necesitamos ver (y poder cobrar) sus
-- apartados sin importar quién de las dos lo vendió. No se reusa la
-- vista `sale_balances` (aunque el cálculo es el mismo) porque esa vista
-- es `security_invoker = true` y queda atada a la RLS de `sales` igual
-- que consultarla directo — acá se calcula lo mismo a mano, adentro de
-- una función `security definer`, por la misma razón que el resto de
-- las funciones de Clientes.
create or replace function get_customer_apartados(p_customer_id uuid)
returns table (
  sale_id uuid,
  sale_date date,
  total_price numeric(12, 2),
  payment_status text,
  amount_paid numeric(12, 2),
  balance numeric(12, 2)
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not is_claimed_user() then
    raise exception 'No autorizado';
  end if;

  return query
  select
    s.id,
    s.sale_date,
    s.total_price,
    s.payment_status,
    coalesce(sum(sp.amount), 0) as amount_paid,
    s.total_price - coalesce(sum(sp.amount), 0) as balance
  from sales s
  left join sale_payments sp on sp.sale_id = s.id
  where s.customer_id = p_customer_id
    and s.payment_status in ('con_abonos', 'completado', 'cancelado')
  group by s.id, s.sale_date, s.total_price, s.payment_status
  order by s.sale_date desc;
end;
$$;

grant execute on function get_customer_apartados(uuid) to authenticated;
