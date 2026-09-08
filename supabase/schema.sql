-- Cortex — progress sync table + security
-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run.

create table if not exists public.progress (
  user_id    uuid primary key references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: every user can only read/write their OWN row.
alter table public.progress enable row level security;

drop policy if exists "own row select" on public.progress;
create policy "own row select" on public.progress
  for select using (auth.uid() = user_id);

drop policy if exists "own row insert" on public.progress;
create policy "own row insert" on public.progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "own row update" on public.progress;
create policy "own row update" on public.progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
