-- 0018_chat_sessions_and_messages.sql: Supabase-backed Multi-Session Chat & Search

-- =============================================================================
-- 1. CHAT SESSIONS
-- =============================================================================
create table if not exists public.chat_sessions (
  id          text primary key default gen_random_uuid()::text,
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null default 'New Conversation',
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_chat_sessions_user_profile 
  on public.chat_sessions (user_id, profile_id, updated_at desc);

-- =============================================================================
-- 2. CHAT MESSAGES
-- =============================================================================
create table if not exists public.chat_messages (
  id          text primary key default gen_random_uuid()::text,
  session_id  text not null references public.chat_sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null default '',
  image_url   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_chat_messages_session 
  on public.chat_messages (session_id, created_at asc);
create index if not exists idx_chat_messages_user_profile 
  on public.chat_messages (user_id, profile_id);

-- =============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =============================================================================
alter table if exists public.chat_sessions enable row level security;
alter table if exists public.chat_messages enable row level security;

-- Chat Sessions RLS
drop policy if exists "own sessions: select" on public.chat_sessions;
drop policy if exists "own sessions: insert" on public.chat_sessions;
drop policy if exists "own sessions: update" on public.chat_sessions;
drop policy if exists "own sessions: delete" on public.chat_sessions;

create policy "own sessions: select" on public.chat_sessions 
  for select using (auth.uid() = user_id);
create policy "own sessions: insert" on public.chat_sessions 
  for insert with check (auth.uid() = user_id);
create policy "own sessions: update" on public.chat_sessions 
  for update using (auth.uid() = user_id);
create policy "own sessions: delete" on public.chat_sessions 
  for delete using (auth.uid() = user_id);

-- Chat Messages RLS
drop policy if exists "own messages: select" on public.chat_messages;
drop policy if exists "own messages: insert" on public.chat_messages;
drop policy if exists "own messages: update" on public.chat_messages;
drop policy if exists "own messages: delete" on public.chat_messages;

create policy "own messages: select" on public.chat_messages 
  for select using (auth.uid() = user_id);
create policy "own messages: insert" on public.chat_messages 
  for insert with check (auth.uid() = user_id);
create policy "own messages: update" on public.chat_messages 
  for update using (auth.uid() = user_id);
create policy "own messages: delete" on public.chat_messages 
  for delete using (auth.uid() = user_id);
