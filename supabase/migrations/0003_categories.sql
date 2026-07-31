-- Categorias editables (Skincare, Maquillaje, etc.), cada una con un color
-- hex propio usado como "swatch" lateral en las tarjetas de producto.
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#0F6E68',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
