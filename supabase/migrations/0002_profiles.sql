-- 0002_profiles.sql
create table if not exists profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  full_name     text not null default 'Patient',
  relationship  text not null default 'self',
  date_of_birth date,
  sex           text check (sex in ('male','female','other','undisclosed')),
  blood_group   text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  height_cm     numeric(5,1),
  weight_kg     numeric(5,1),
  allergies           text,
  chronic_conditions  text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  is_default    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Ensure all columns exist even if profiles table pre-existed
alter table profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table profiles add column if not exists full_name text default 'Patient';
alter table profiles add column if not exists relationship text default 'self';
alter table profiles add column if not exists date_of_birth date;
alter table profiles add column if not exists sex text;
alter table profiles add column if not exists blood_group text;
alter table profiles add column if not exists height_cm numeric(5,1);
alter table profiles add column if not exists weight_kg numeric(5,1);
alter table profiles add column if not exists allergies text;
alter table profiles add column if not exists chronic_conditions text;
alter table profiles add column if not exists emergency_contact_name text;
alter table profiles add column if not exists emergency_contact_phone text;
alter table profiles add column if not exists is_default boolean default true;
alter table profiles add column if not exists created_at timestamptz default now();
alter table profiles add column if not exists updated_at timestamptz default now();

update profiles set user_id = id where user_id is null;

create index if not exists idx_profiles_user_id on profiles (user_id);
