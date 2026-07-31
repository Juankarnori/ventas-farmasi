create table orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pendiente' check (status in ('pendiente', 'recibido')),
  order_date date not null default current_date,
  received_at timestamptz,
  total_cost numeric(12, 2) not null default 0,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_cost numeric(12, 2) not null
);

create index order_items_order_idx on order_items (order_id);
create index order_items_product_idx on order_items (product_id);
