create table if not exists public.user_active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id text not null,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_active_sessions enable row level security;

drop policy if exists "Users view own active session" on public.user_active_sessions;
drop policy if exists "Users create own active session" on public.user_active_sessions;
drop policy if exists "Users update own active session" on public.user_active_sessions;
drop policy if exists "Users delete own active session" on public.user_active_sessions;

create policy "Users view own active session"
on public.user_active_sessions
for select
to authenticated
using (user_id = auth.uid());

create policy "Users create own active session"
on public.user_active_sessions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users update own active session"
on public.user_active_sessions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users delete own active session"
on public.user_active_sessions
for delete
to authenticated
using (user_id = auth.uid());

create index if not exists user_active_sessions_last_seen_idx
on public.user_active_sessions (last_seen_at desc);
