-- Log de todo movimiento de stock. `quantity` siempre es positivo; el
-- efecto sobre el stock lo determina `type`. Las filas tipo 'prestamo' son
-- solo trazabilidad: nunca se usan para recalcular products.stock.
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  type text not null check (
    type in ('entrada_pedido', 'salida_venta', 'ajuste_manual', 'prestamo')
  ),
  quantity int not null check (quantity > 0),
  reference_table text check (reference_table in ('orders', 'sales', 'loans')),
  reference_id uuid,
  note text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index stock_movements_product_idx on stock_movements (product_id);
create index stock_movements_reference_idx on stock_movements (reference_table, reference_id);
