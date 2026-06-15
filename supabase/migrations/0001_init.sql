-- Forge persistence schema. Row-level security is ON for every table: a user can only
-- reach their own workspaces, sessions, artifacts, and spend rows. The agent-service uses
-- the service-role key (bypasses RLS) and scopes every query by workspace itself.

create extension if not exists "pgcrypto";

-- One profile row per auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null default 'workspace',
  sandbox_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.agent_sessions (id) on delete cascade,
  kind text not null, -- plan | edit | terminal | screenshot | message
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.spend_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  usd numeric(12, 6) not null,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_idx on public.workspaces (owner);
create index if not exists sessions_workspace_idx on public.agent_sessions (workspace_id);
create index if not exists artifacts_session_idx on public.artifacts (session_id);
create index if not exists spend_user_idx on public.spend_ledger (user_id);

-- Row-level security.
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.artifacts enable row level security;
alter table public.spend_ledger enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own workspaces" on public.workspaces
  for all using (owner = auth.uid()) with check (owner = auth.uid());

create policy "own sessions" on public.agent_sessions
  for all using (
    exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner = auth.uid())
  ) with check (
    exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner = auth.uid())
  );

create policy "own artifacts" on public.artifacts
  for all using (
    exists (
      select 1 from public.agent_sessions s
      join public.workspaces w on w.id = s.workspace_id
      where s.id = session_id and w.owner = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.agent_sessions s
      join public.workspaces w on w.id = s.workspace_id
      where s.id = session_id and w.owner = auth.uid()
    )
  );

create policy "own spend" on public.spend_ledger
  for select using (user_id = auth.uid());
