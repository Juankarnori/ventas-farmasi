create table expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  category text not null check (category in ('envio', 'empaque', 'publicidad', 'otro')),
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create index expenses_date_idx on expenses (expense_date);
