
-- Добавляем поля для Steam в таблицу users
alter table public.users add column if not exists steam_id text;
alter table public.users add column if not exists steam_name text;
alter table public.users add column if not exists steam_avatar text;






