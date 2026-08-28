-- =============================================================================
-- MEDFOLIO V2 — UNIFIED & OPTIMIZED SUPABASE DATABASE SCHEMA
-- Single-file deployment. Copy & paste directly into Supabase SQL Editor.
-- =============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================================================
-- 1. PATIENTS & PROFILES
-- =============================================================================
create table if not exists public.profiles (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  full_name               text not null default 'Patient',
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
create index if not exists idx_profiles_user on public.profiles (user_id);

-- =============================================================================
-- 2. CLINIC VISITS & PRESCRIPTIONS
-- =============================================================================
create table if not exists public.visits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  visit_date      date not null default current_date,
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
create index if not exists idx_visits_lookup on public.visits (user_id, profile_id, visit_date desc);

create table if not exists public.visit_images (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  visit_id      uuid not null references public.visits(id) on delete cascade,
  storage_path  text not null,
  page_number   int not null default 1,
  width_px      int,
  height_px     int,
  byte_size     int,
  created_at    timestamptz not null default now(),
  unique (visit_id, page_number)
);
create index if not exists idx_visit_images_visit on public.visit_images (visit_id);

-- =============================================================================
-- 3. MEDICATIONS & DOSE ADHERENCE
-- =============================================================================
create table if not exists public.medicines (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  visit_id         uuid references public.visits(id) on delete set null,
  medicine_name    text not null,
  strength         text,
  form             text,
  dose_amount      text,
  frequency_raw    text,
  frequency_code   text check (frequency_code in ('OD','BD','TDS','QID','QHS','PRN','SOS','STAT','WEEKLY','CUSTOM')),
  duration_raw     text,
  duration_days    int,
  start_date       date not null default current_date,
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
create index if not exists idx_medicines_active on public.medicines (user_id, profile_id, discontinued_at);

create table if not exists public.doses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  medicine_id        uuid not null references public.medicines(id) on delete cascade,
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
create index if not exists idx_doses_daily on public.doses (user_id, profile_id, scheduled_date, scheduled_minutes);

-- =============================================================================
-- 4. LAB REPORTS & BIOMARKER RESULTS
-- =============================================================================
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  report_date  date not null default current_date,
  lab_name     text,
  report_cost  numeric(12,2),
  currency     char(3) not null default 'PKR',
  source_type  text not null default 'image' check (source_type in ('image','pdf','manual')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_reports_lookup on public.reports (user_id, profile_id, report_date desc);

create table if not exists public.report_images (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  report_id    uuid not null references public.reports(id) on delete cascade,
  storage_path text not null,
  page_number  int not null default 1,
  created_at   timestamptz not null default now(),
  unique (report_id, page_number)
);

create table if not exists public.report_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  report_id       uuid not null references public.reports(id) on delete cascade,
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
create index if not exists idx_results_biomarker on public.report_results (user_id, canonical_name, created_at desc);

create table if not exists public.test_orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  visit_id         uuid references public.visits(id) on delete set null,
  test_name        text not null,
  canonical_name   text,
  status           text not null default 'pending' check (status in ('pending','scheduled','completed','cancelled')),
  ordered_date     date not null default current_date,
  scheduled_date   date,
  completed_date   date,
  report_id        uuid references public.reports(id) on delete set null,
  link_method      text check (link_method in ('auto','manual')),
  estimated_cost   numeric(12,2),
  currency         char(3) not null default 'PKR',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_test_orders_status on public.test_orders (user_id, profile_id, status);

-- =============================================================================
-- 5. DAILY VITALS & CLINICAL OBSERVATIONS
-- =============================================================================
create table if not exists public.glucose_readings (
  id           text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  measured_at  timestamptz not null default now(),
  type         text not null check (type in ('fasting','post_prandial','random','bedtime')),
  value_mg_dl  numeric not null,
  meal_context text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_glucose_trends on public.glucose_readings (user_id, profile_id, measured_at desc);

create table if not exists public.blood_pressure_readings (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  measured_at timestamptz not null default now(),
  systolic    numeric not null,
  diastolic   numeric not null,
  pulse_bpm   numeric,
  arm         text check (arm in ('left','right')),
  posture     text check (posture in ('sitting','standing','lying')),
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_bp_trends on public.blood_pressure_readings (user_id, profile_id, measured_at desc);

create table if not exists public.side_effects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  medicine_id   uuid references public.medicines(id) on delete set null,
  medicine_name text not null,
  note          text not null,
  severity      text check (severity in ('mild','moderate','severe')),
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- =============================================================================
-- 6. SECURITY, REMINDERS, AUDIT & SHARING
-- =============================================================================
create table if not exists public.reminder_settings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  profile_id         uuid not null unique references public.profiles(id) on delete cascade,
  enabled            boolean not null default true,
  quiet_hours_start  int check (quiet_hours_start between 0 and 1439),
  quiet_hours_end    int check (quiet_hours_end between 0 and 1439),
  snooze_minutes     int not null default 15 check (snooze_minutes between 1 and 120),
  lead_minutes       int not null default 0 check (lead_minutes >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.shares (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  profile_id     uuid not null references public.profiles(id) on delete cascade,
  token_hash     text not null unique,
  snapshot       jsonb not null,
  expires_at     timestamptz not null,
  revoked_at     timestamptz,
  view_count     int not null default 0,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_shares_token on public.shares (token_hash);

create table if not exists public.extraction_audit (
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

-- =============================================================================
-- 7. CLEAN & SECURE ROW LEVEL SECURITY (RLS)
-- Each user strictly owns and controls their own healthcare data.
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.visits enable row level security;
alter table public.visit_images enable row level security;
alter table public.medicines enable row level security;
alter table public.doses enable row level security;
alter table public.reports enable row level security;
alter table public.report_images enable row level security;
alter table public.report_results enable row level security;
alter table public.test_orders enable row level security;
alter table public.glucose_readings enable row level security;
alter table public.blood_pressure_readings enable row level security;
alter table public.side_effects enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.shares enable row level security;
alter table public.extraction_audit enable row level security;

-- Unified CRUD policies (bypasses repetitive multi-policy boilerplate)
create policy "Users own profiles" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own visits" on public.visits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own visit_images" on public.visit_images for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own medicines" on public.medicines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own doses" on public.doses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own reports" on public.reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own report_images" on public.report_images for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own report_results" on public.report_results for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own test_orders" on public.test_orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own glucose_readings" on public.glucose_readings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own blood_pressure_readings" on public.blood_pressure_readings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own side_effects" on public.side_effects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own reminder_settings" on public.reminder_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own shares" on public.shares for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users own extraction_audit" on public.extraction_audit for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Doctor Share Links: Allow unauthenticated public to view active, non-expired shares
create policy "Public view active shares" on public.shares for select using (
  revoked_at is null and expires_at > now()
);

-- =============================================================================
-- 8. AUTOMATIC PROFILE GENERATION TRIGGER (ON AUTH SIGNUP)
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_dob text;
  parsed_dob date;
  raw_blood text;
begin
  -- Safely parse date_of_birth if valid ISO format
  raw_dob := nullif(trim(new.raw_user_meta_data ->> 'date_of_birth'), '');
  if raw_dob is not null and raw_dob ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      parsed_dob := raw_dob::date;
    exception when others then
      parsed_dob := null;
    end;
  else
    parsed_dob := null;
  end if;

  -- Safely sanitize blood_group
  raw_blood := nullif(trim(new.raw_user_meta_data ->> 'blood_group'), '');
  if raw_blood is not null and raw_blood not in ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown') then
    raw_blood := null;
  end if;

  insert into public.profiles (id, user_id, full_name, sex, date_of_birth, blood_group, is_default)
  values (
    new.id,
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      'Patient'
    ),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'sex'), ''),
      'undisclosed'
    ),
    parsed_dob,
    raw_blood,
    true
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), profiles.full_name),
    sex = coalesce(nullif(trim(new.raw_user_meta_data ->> 'sex'), ''), profiles.sex),
    date_of_birth = coalesce(parsed_dob, profiles.date_of_birth),
    blood_group = coalesce(raw_blood, profiles.blood_group),
    updated_at = now();

  return new;
exception when others then
  -- Fail-safe: Never block user account creation in Supabase Auth if profile insertion fails
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
