-- ==========================================================
-- MEDFOLIO V2 — COMPLETE SUPABASE DATABASE SCHEMA DEPLOYMENT
-- Run this in your Supabase Project -> SQL Editor
-- ==========================================================

-- 1. Extensions
create extension if not exists "uuid-ossp";

-- 2. Profiles Table
create table if not exists profiles (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  full_name               text not null,
  relationship            text not null default 'self' check (relationship in ('self','parent','child','spouse','other')),
  date_of_birth           date,
  sex                     text check (sex in ('male','female','other','undisclosed')),
  blood_group             text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  height_cm               numeric(5,1),
  weight_kg               numeric(5,1),
  allergies               text,
  chronic_conditions      text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  is_default              boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists idx_profiles_user on profiles (user_id);

-- 3. Visits & Visit Images
create table if not exists visits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  visit_date      date not null,
  doctor_name     text,
  clinic_name     text,
  specialty       text,
  diagnosis       text,
  doctor_advice   text,
  follow_up_date  date,
  visit_cost      numeric(12,2),
  currency        char(3) not null default 'PKR',
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_visits_user_date on visits (user_id, profile_id, visit_date desc);

create table if not exists visit_images (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  visit_id      uuid not null references visits(id) on delete cascade,
  storage_path  text not null,
  page_number   int not null default 1,
  width_px      int,
  height_px     int,
  byte_size     int,
  created_at    timestamptz not null default now(),
  unique (visit_id, page_number)
);

-- 4. Medicines & Doses
create table if not exists medicines (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  visit_id         uuid references visits(id) on delete set null,
  medicine_name    text not null,
  strength         text,
  form             text,
  dose_amount      text,
  frequency_raw    text,
  frequency_code   text check (frequency_code in ('OD','BD','TDS','QID','QHS','PRN','SOS','STAT','WEEKLY','CUSTOM')),
  duration_raw     text,
  duration_days    int,
  start_date       date not null,
  end_date         date,
  instructions     text,
  with_food        boolean,
  is_ongoing       boolean not null default false,
  is_otc           boolean not null default false,
  unit_cost        numeric(10,2),
  currency         char(3) not null default 'PKR',
  discontinued_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_medicines_user on medicines (user_id, profile_id);

create table if not exists doses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  profile_id         uuid not null references profiles(id) on delete cascade,
  medicine_id        uuid not null references medicines(id) on delete cascade,
  scheduled_date     date not null,
  scheduled_minutes  int not null check (scheduled_minutes between 0 and 1439),
  status             text not null default 'pending' check (status in ('pending','taken','skipped','missed')),
  taken_at           timestamptz,
  skipped_reason     text,
  snoozed_until      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (medicine_id, scheduled_date, scheduled_minutes)
);
create index if not exists idx_doses_user_sched on doses (user_id, profile_id, scheduled_date, scheduled_minutes);

-- 5. Reports & Report Results
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  title        text not null,
  report_date  date not null,
  lab_name     text,
  report_cost  numeric(12,2),
  currency     char(3) not null default 'PKR',
  source_type  text not null default 'image' check (source_type in ('image','pdf','manual')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_reports_user on reports (user_id, profile_id, report_date desc);

create table if not exists report_images (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  report_id    uuid not null references reports(id) on delete cascade,
  storage_path text not null,
  page_number  int not null default 1,
  created_at   timestamptz not null default now(),
  unique (report_id, page_number)
);

create table if not exists report_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  report_id       uuid not null references reports(id) on delete cascade,
  test_name       text not null,
  canonical_name  text,
  value_text      text not null,
  value_numeric   numeric,
  unit            text,
  reference_range text,
  ref_low         numeric,
  ref_high        numeric,
  range_status    text not null default 'unknown' check (range_status in ('within','below','above','unknown')),
  created_at      timestamptz not null default now()
);
create index if not exists idx_results_user_test on report_results (user_id, canonical_name, created_at);

-- 6. Test Orders
create table if not exists test_orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  visit_id         uuid references visits(id) on delete set null,
  test_name        text not null,
  canonical_name   text,
  status           text not null default 'pending' check (status in ('pending','scheduled','completed','cancelled')),
  ordered_date     date not null,
  scheduled_date   date,
  completed_date   date,
  report_id        uuid references reports(id) on delete set null,
  link_method      text check (link_method in ('auto','manual')),
  estimated_cost   numeric(12,2),
  currency         char(3) not null default 'PKR',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_test_orders_user on test_orders (user_id, profile_id, status);

-- 7. Side Effects & Extraction Audit
create table if not exists side_effects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references profiles(id) on delete cascade,
  medicine_id   uuid references medicines(id) on delete set null,
  medicine_name text not null,
  note          text not null,
  severity      text check (severity in ('mild','moderate','severe')),
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create table if not exists extraction_audit (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  entity_type     text not null check (entity_type in ('visit','report')),
  entity_id       uuid not null,
  model           text not null,
  raw_response    jsonb not null,
  confirmed_data  jsonb not null,
  edited_fields   text[] not null default '{}',
  created_at      timestamptz not null default now()
);

-- 8. Reminders & Shares
create table if not exists reminder_settings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  profile_id         uuid not null unique references profiles(id) on delete cascade,
  enabled            boolean not null default true,
  quiet_hours_start  int check (quiet_hours_start between 0 and 1439),
  quiet_hours_end    int check (quiet_hours_end between 0 and 1439),
  snooze_minutes     int not null default 15 check (snooze_minutes between 1 and 120),
  lead_minutes       int not null default 0 check (lead_minutes >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists shares (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  profile_id     uuid not null references profiles(id) on delete cascade,
  token_hash     text not null unique,
  snapshot       jsonb not null,
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  view_count     int not null default 0,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_shares_token on shares (token_hash);

-- 9. Row Level Security (RLS)
alter table profiles enable row level security;
alter table visits enable row level security;
alter table visit_images enable row level security;
alter table medicines enable row level security;
alter table doses enable row level security;
alter table reports enable row level security;
alter table report_images enable row level security;
alter table report_results enable row level security;
alter table test_orders enable row level security;
alter table side_effects enable row level security;
alter table extraction_audit enable row level security;
alter table reminder_settings enable row level security;
alter table shares enable row level security;

-- Policies for Authenticated Users (Own data only)
drop policy if exists "Users own their profiles" on profiles;
create policy "Users own their profiles" on profiles for all using (auth.uid() = user_id);

drop policy if exists "Users own their visits" on visits;
create policy "Users own their visits" on visits for all using (auth.uid() = user_id);

drop policy if exists "Users own their visit images" on visit_images;
create policy "Users own their visit images" on visit_images for all using (auth.uid() = user_id);

drop policy if exists "Users own their medicines" on medicines;
create policy "Users own their medicines" on medicines for all using (auth.uid() = user_id);

drop policy if exists "Users own their doses" on doses;
create policy "Users own their doses" on doses for all using (auth.uid() = user_id);

drop policy if exists "Users own their reports" on reports;
create policy "Users own their reports" on reports for all using (auth.uid() = user_id);

drop policy if exists "Users own their report images" on report_images;
create policy "Users own their report images" on report_images for all using (auth.uid() = user_id);

drop policy if exists "Users own their report results" on report_results;
create policy "Users own their report results" on report_results for all using (auth.uid() = user_id);

drop policy if exists "Users own their test orders" on test_orders;
create policy "Users own their test orders" on test_orders for all using (auth.uid() = user_id);

drop policy if exists "Users own their side effects" on side_effects;
create policy "Users own their side effects" on side_effects for all using (auth.uid() = user_id);

drop policy if exists "Users own their extraction audit" on extraction_audit;
create policy "Users own their extraction audit" on extraction_audit for all using (auth.uid() = user_id);

drop policy if exists "Users own their reminder settings" on reminder_settings;
create policy "Users own their reminder settings" on reminder_settings for all using (auth.uid() = user_id);

drop policy if exists "Users manage their shares" on shares;
create policy "Users manage their shares" on shares for all using (auth.uid() = user_id);

drop policy if exists "Public can view valid unrevoked shares" on shares;
create policy "Public can view valid unrevoked shares" on shares for select using (
  revoked_at is null and expires_at > now()
);
