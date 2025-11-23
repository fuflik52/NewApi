-- Таблица для отслеживания статуса команд (лобби)
-- Пока упростим: у каждого юзера может быть только одно активное лобби, где он капитан
-- Либо он участник чужого лобби.

-- Для простоты используем таблицу invites, которая связывает sender (капитан) и receiver (приглашенный)
-- А статус 'accepted' означает что они в одной команде.

create table public.team_invites (
  id uuid default gen_random_uuid() primary key,
  sender_id text references public.users(id) on delete cascade,
  receiver_id text references public.users(id) on delete cascade,
  status text default 'pending', -- 'pending', 'accepted', 'rejected'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS
alter table public.team_invites enable row level security;

-- Политики (упрощенно: все видят всё, или только свои)
create policy "Users can see invites sent or received" on public.team_invites
  for all using (auth.uid()::text = sender_id or auth.uid()::text = receiver_id);

