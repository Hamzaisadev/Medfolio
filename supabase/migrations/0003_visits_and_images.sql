-- 0003_visits_and_images.sql
create table if not exists visits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  profile_id    uuid references profiles(id) on delete cascade,
  visit_date    date not null default current_date,
  doctor_name   text,
  clinic_name   text,
  specialty     text,
  diagnosis     text,
  doctor_advice text,
  follow_up_date date,
  visit_cost    numeric(12,2),
  currency      char(3) not null default 'PKR',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table visits add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table visits add column if not exists profile_id uuid references profiles(id) on delete cascade;
alter table visits add column if not exists visit_date date default current_date;
alter table visits add column if not exists doctor_name text;
alter table visits add column if not exists clinic_name text;
alter table visits add column if not exists specialty text;
alter table visits add column if not exists diagnosis text;
alter table visits add column if not exists doctor_advice text;
alter table visits add column if not exists follow_up_date date;
alter table visits add column if not exists visit_cost numeric(12,2);
alter table visits add column if not exists currency char(3) default 'PKR';
alter table visits add column if not exists notes text;
alter table visits add column if not exists created_at timestamptz default now();
alter table visits add column if not exists updated_at timestamptz default now();

create index if not exists idx_visits_user_profile_date on visits (user_id, profile_id, visit_date desc);

create table if not exists visit_images (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  visit_id     uuid references visits(id) on delete cascade,
  storage_path text not null default '',
  page_number  int not null default 1,
  width_px     int,
  height_px    int,
  byte_size    int,
  created_at   timestamptz not null default now()
);

alter table visit_images add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table visit_images add column if not exists visit_id uuid references visits(id) on delete cascade;
alter table visit_images add column if not exists storage_path text default '';
alter table visit_images add column if not exists page_number int default 1;
alter table visit_images add column if not exists width_px int;
alter table visit_images add column if not exists height_px int;
alter table visit_images add column if not exists byte_size int;
alter table visit_images add column if not exists created_at timestamptz default now();
