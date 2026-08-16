-- 0014_vitals.sql: Glucose & Blood Pressure Tracking

create table if not exists glucose_readings (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  measured_at  timestamptz not null default now(),
  type         text not null check (type in ('fasting','post_prandial','random','bedtime')),
  value_mg_dl  numeric not null,
  meal_context text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_glucose_user_profile on glucose_readings (user_id, profile_id, measured_at desc);

create table if not exists blood_pressure_readings (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  measured_at timestamptz not null default now(),
  systolic    numeric not null,
  diastolic   numeric not null,
  pulse_bpm   numeric,
  arm         text check (arm in ('left','right')),
  posture     text check (posture in ('sitting','standing','lying')),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_bp_user_profile on blood_pressure_readings (user_id, profile_id, measured_at desc);

-- RLS
alter table if exists glucose_readings enable row level security;
alter table if exists blood_pressure_readings enable row level security;

drop policy if exists "own rows: select" on glucose_readings;
drop policy if exists "own rows: insert" on glucose_readings;
drop policy if exists "own rows: delete" on glucose_readings;
create policy "own rows: select" on glucose_readings for select using (auth.uid() = user_id);
create policy "own rows: insert" on glucose_readings for insert with check (auth.uid() = user_id);
create policy "own rows: delete" on glucose_readings for delete using (auth.uid() = user_id);

drop policy if exists "own rows: select" on blood_pressure_readings;
drop policy if exists "own rows: insert" on blood_pressure_readings;
drop policy if exists "own rows: delete" on blood_pressure_readings;
create policy "own rows: select" on blood_pressure_readings for select using (auth.uid() = user_id);
create policy "own rows: insert" on blood_pressure_readings for insert with check (auth.uid() = user_id);
create policy "own rows: delete" on blood_pressure_readings for delete using (auth.uid() = user_id);
