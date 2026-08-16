-- 0007_side_effects.sql
create table if not exists side_effects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  profile_id    uuid references profiles(id) on delete cascade,
  medicine_id   uuid references medicines(id) on delete set null,
  medicine_name text not null default '',
  note          text not null default '',
  severity      text check (severity in ('mild','moderate','severe')),
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

alter table side_effects add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table side_effects add column if not exists profile_id uuid references profiles(id) on delete cascade;
alter table side_effects add column if not exists medicine_id uuid references medicines(id) on delete set null;
alter table side_effects add column if not exists medicine_name text default '';
alter table side_effects add column if not exists note text default '';
alter table side_effects add column if not exists severity text;
alter table side_effects add column if not exists occurred_at timestamptz default now();
alter table side_effects add column if not exists created_at timestamptz default now();

create index if not exists idx_side_effects_user_profile_occurred on side_effects (user_id, profile_id, occurred_at desc);
