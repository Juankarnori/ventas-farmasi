-- Líneas (subcategorías) dentro de cada categoría, ej. dentro de
-- "Cuidado de la piel": las líneas "Tea Tree" y "Resurface". Una línea
-- pertenece siempre a una única categoría (jerarquía de 2 niveles).
--
-- `categories` ya era una tabla propia desde 0003_categories.sql (no una
-- columna de texto libre en products), así que no hace falta normalizar
-- nada ahí — product_lines puede referenciarla con FK directo.

create table product_lines (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (category_id, name)
);

create index product_lines_category_idx on product_lines (category_id);

alter table product_lines enable row level security;

create policy product_lines_all on product_lines
  for all to authenticated
  using (is_claimed_user())
  with check (is_claimed_user());

-- line_id vive en el producto padre (mismo nivel que category_id), no en
-- la variante — es opcional: no todo producto pertenece a una línea
-- (ej. maquillaje suelto). `on delete restrict` para que borrar una línea
-- con productos asignados falle con un error controlado que la app
-- traduce a un mensaje claro, en vez de dejar productos huérfanos.
alter table products add column line_id uuid references product_lines (id) on delete restrict;

create index products_line_idx on products (line_id);
