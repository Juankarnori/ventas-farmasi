create table sales (
  id uuid primary key default gen_random_uuid(),
  sale_date date not null default current_date,
  customer_name text,
  seller_profile_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- sale_price/cost_price son un snapshot al momento de la venta: editar el
-- costo de un producto despues no debe reescribir ganancias historicas.
create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales (id) on delete cascade,
  product_id uuid not null references products (id) on delete restrict,
  quantity int not null check (quantity > 0),
  sale_price numeric(12, 2) not null,
  cost_price numeric(12, 2) not null,
  profit numeric(12, 2) generated always as (
    round((sale_price - cost_price) * quantity, 2)
  ) stored
);

create index sale_items_sale_idx on sale_items (sale_id);
create index sale_items_product_idx on sale_items (product_id);
create index sales_date_idx on sales (sale_date);
create index sales_seller_idx on sales (seller_profile_id);
