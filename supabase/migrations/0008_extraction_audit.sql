-- 0008_extraction_audit.sql
create table if not exists extraction_audit (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  entity_type    text not null default 'visit' check (entity_type in ('visit','report')),
  entity_id      uuid not null,
  model          text not null default 'gemini',
  raw_response   jsonb not null default '{}'::jsonb,
  confirmed_data jsonb not null default '{}'::jsonb,
  edited_fields  text[] not null default '{}',
  created_at     timestamptz not null default now()
);

alter table extraction_audit add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table extraction_audit add column if not exists entity_type text default 'visit';
alter table extraction_audit add column if not exists entity_id uuid;
alter table extraction_audit add column if not exists model text default 'gemini';
alter table extraction_audit add column if not exists raw_response jsonb default '{}'::jsonb;
alter table extraction_audit add column if not exists confirmed_data jsonb default '{}'::jsonb;
alter table extraction_audit add column if not exists edited_fields text[] default '{}';
alter table extraction_audit add column if not exists created_at timestamptz default now();

create index if not exists idx_extraction_audit_user_entity on extraction_audit (user_id, entity_type, entity_id);
