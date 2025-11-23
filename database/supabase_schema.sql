-- В Supabase это выполняется в SQL Editor

-- 1. БАЗА ДАННЫХ ПОЛЬЗОВАТЕЛЕЙ И API КЛЮЧЕЙ
-- (Включает пользователей, их ключи и счетчики запросов)

-- Таблица пользователей (с сохранением Discord ID как text)
create table public.users (
  id text primary key, -- ID пользователя (например, из Discord)
  username text not null,
  discriminator text,
  avatar text,
  email text,
  is_admin boolean default false,
  ip_address text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Таблица API ключей + статистика запросов
create table public.api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id text references public.users(id) on delete cascade, -- Связь с пользователем
  token text unique not null,    -- Сам ключ (sk_live_...)
  name text default 'Default Key',
  requests_count bigint default 0, -- Счетчик запросов (то, что ты просил)
  last_used_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Индексы для быстрого поиска ключей
create index idx_api_keys_token on public.api_keys(token);
create index idx_api_keys_user_id on public.api_keys(user_id);


-- 2. БАЗА ДАННЫХ ФОТОК (Uploads)
-- (Хранит метаданные всех загруженных файлов)

create table public.uploads (
  id text primary key, -- Твой 10-значный ID файла
  filename text not null,      -- Имя файла на диске Supabase Storage или путь
  original_name text not null, -- Оригинальное имя файла при загрузке
  size bigint not null,        -- Размер в байтах
  mime_type text,              -- Тип (image/png и т.д.)
  url text not null,           -- Публичная ссылка
  
  -- Связи (кто загрузил и через какой токен)
  user_id text references public.users(id) on delete set null,
  token_used text,             -- Сохраняем строку токена для истории
  
  uploaded_at timestamp with time zone default timezone('utc'::text, now())
);

-- Индексы для галереи
create index idx_uploads_user_id on public.uploads(user_id);
create index idx_uploads_uploaded_at on public.uploads(uploaded_at desc);

-- Включение Row Level Security (RLS) - хорошая практика для Supabase
-- По умолчанию закрываем доступ, доступ будет через сервисный ключ (backend)
alter table public.users enable row level security;
alter table public.api_keys enable row level security;
alter table public.uploads enable row level security;

