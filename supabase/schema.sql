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

-- Reviewer preview access: which closed courses a signed-in reviewer may open on the site.
-- Keyed by lowercase email so a grant can exist before the reviewer's first sign-in.
-- Readable only by the account whose JWT email matches; there are deliberately no insert,
-- update or delete policies, so grants are made in the SQL Editor (see README).
create table if not exists public.preview_access (
  email      text primary key check (email = lower(email)),
  courses    text[] not null default '{}',
  note       text,
  granted_at timestamptz not null default now()
);

alter table public.preview_access enable row level security;

drop policy if exists "own email select" on public.preview_access;
create policy "own email select" on public.preview_access
  for select using (email = lower(auth.jwt() ->> 'email'));
