create extension if not exists "pgcrypto";

create table if not exists public.aura_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  path text not null,
  description text,
  commands jsonb not null default '{}'::jsonb,
  source text not null default 'supabase',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.aura_settings (
  key text primary key,
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.aura_audit_logs (
  id bigint generated always as identity primary key,
  log_id text not null unique,
  actor_id text,
  command text not null,
  status text not null,
  event_timestamp timestamptz not null,
  params jsonb not null default '{}'::jsonb,
  stdout text not null default '',
  stderr text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.aura_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  user_id text,
  project_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.aura_chat_messages (
  id bigint generated always as identity primary key,
  session_id text not null references public.aura_chat_sessions(session_id) on delete cascade,
  role text not null,
  content text not null,
  model text,
  intent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_aura_projects_name on public.aura_projects (name);
create index if not exists idx_aura_audit_logs_created_at on public.aura_audit_logs (created_at desc);
create index if not exists idx_aura_chat_sessions_user_id on public.aura_chat_sessions (user_id);
create index if not exists idx_aura_chat_messages_session_id_created_at on public.aura_chat_messages (session_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_aura_projects_updated_at on public.aura_projects;
create trigger trg_aura_projects_updated_at
before update on public.aura_projects
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_aura_settings_updated_at on public.aura_settings;
create trigger trg_aura_settings_updated_at
before update on public.aura_settings
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_aura_chat_sessions_updated_at on public.aura_chat_sessions;
create trigger trg_aura_chat_sessions_updated_at
before update on public.aura_chat_sessions
for each row execute procedure public.set_updated_at();

alter table public.aura_projects enable row level security;
alter table public.aura_settings enable row level security;
alter table public.aura_audit_logs enable row level security;
alter table public.aura_chat_sessions enable row level security;
alter table public.aura_chat_messages enable row level security;

drop policy if exists "chat_sessions_owner_select" on public.aura_chat_sessions;
create policy "chat_sessions_owner_select"
on public.aura_chat_sessions
for select
to authenticated
using (user_id = auth.uid()::text);

drop policy if exists "chat_messages_owner_select" on public.aura_chat_messages;
create policy "chat_messages_owner_select"
on public.aura_chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.aura_chat_sessions sessions
    where sessions.session_id = aura_chat_messages.session_id
      and sessions.user_id = auth.uid()::text
  )
);

comment on table public.aura_projects is 'Projetos registrados pela Aura; leitura/escrita principal via backend FastAPI com service role.';
comment on table public.aura_settings is 'Configurações operacionais da Aura, persistidas pelo backend.';
comment on table public.aura_audit_logs is 'Logs de auditoria dos comandos executados.';
comment on table public.aura_chat_sessions is 'Sessões de chat persistidas para memória curta e futura observabilidade.';
comment on table public.aura_chat_messages is 'Mensagens de chat ligadas a uma sessão.';

