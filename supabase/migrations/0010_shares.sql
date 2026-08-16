-- 0010_shares.sql
create table if not exists shares (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,
  profile_id     uuid references profiles(id) on delete cascade,
  token_hash     text not null default '',
  snapshot       jsonb not null default '{}'::jsonb,
  expires_at     timestamptz not null default now() + interval '1 day',
  revoked_at     timestamptz,
  view_count     int not null default 0,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);

alter table shares add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table shares add column if not exists profile_id uuid references profiles(id) on delete cascade;
alter table shares add column if not exists token_hash text default '';
alter table shares add column if not exists snapshot jsonb default '{}'::jsonb;
alter table shares add column if not exists expires_at timestamptz default now() + interval '1 day';
alter table shares add column if not exists revoked_at timestamptz;
alter table shares add column if not exists view_count int default 0;
alter table shares add column if not exists last_viewed_at timestamptz;
alter table shares add column if not exists created_at timestamptz default now();

create index if not exists idx_shares_token_hash on shares (token_hash);
