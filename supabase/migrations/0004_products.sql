create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  category_id uuid references categories (id) on delete set null,
  sale_price numeric(12, 2) not null default 0,
  cost_price numeric(12, 2) not null default 0,
  description text,
  stock int not null default 0,
  low_stock_threshold int not null default 3,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_category_idx on products (category_id);
