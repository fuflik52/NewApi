-- Таблица для истории запросов (чтобы строить графики)
create table public.request_logs (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.users(id) on delete set null,
  token_id uuid references public.api_keys(id) on delete set null,
  endpoint text,       -- Куда стучались (например /api/images/upload)
  method text,         -- GET, POST, etc.
  status int,          -- 200, 400, 500
  duration int,        -- Время выполнения в мс
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Индексы для скорости графиков
create index idx_logs_created_at on public.request_logs(created_at);
create index idx_logs_status on public.request_logs(status);

-- Включаем RLS
alter table public.request_logs enable row level security;

