-- 0009_reminder_settings.sql
create table if not exists reminder_settings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  profile_id        uuid references profiles(id) on delete cascade,
  enabled           boolean not null default true,
  quiet_hours_start int check (quiet_hours_start between 0 and 1439),
  quiet_hours_end   int check (quiet_hours_end between 0 and 1439),
  snooze_minutes    int not null default 10 check (snooze_minutes between 1 and 120),
  lead_minutes      int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table reminder_settings add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table reminder_settings add column if not exists profile_id uuid references profiles(id) on delete cascade;
alter table reminder_settings add column if not exists enabled boolean default true;
alter table reminder_settings add column if not exists quiet_hours_start int;
alter table reminder_settings add column if not exists quiet_hours_end int;
alter table reminder_settings add column if not exists snooze_minutes int default 10;
alter table reminder_settings add column if not exists lead_minutes int default 0;
alter table reminder_settings add column if not exists created_at timestamptz default now();
alter table reminder_settings add column if not exists updated_at timestamptz default now();
