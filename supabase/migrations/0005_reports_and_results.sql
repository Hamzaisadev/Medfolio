-- 0005_reports_and_results.sql
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  profile_id   uuid references profiles(id) on delete cascade,
  title        text not null default 'Lab Report',
  report_date  date not null default current_date,
  lab_name     text,
  report_cost  numeric(12,2),
  currency     char(3) not null default 'PKR',
  source_type  text not null default 'image' check (source_type in ('image','pdf','manual')),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table reports add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table reports add column if not exists profile_id uuid references profiles(id) on delete cascade;
alter table reports add column if not exists title text default 'Lab Report';
alter table reports add column if not exists report_date date default current_date;
alter table reports add column if not exists lab_name text;
alter table reports add column if not exists report_cost numeric(12,2);
alter table reports add column if not exists currency char(3) default 'PKR';
alter table reports add column if not exists source_type text default 'image';
alter table reports add column if not exists notes text;
alter table reports add column if not exists created_at timestamptz default now();
alter table reports add column if not exists updated_at timestamptz default now();

create index if not exists idx_reports_user_profile_date on reports (user_id, profile_id, report_date desc);

create table if not exists report_images (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  report_id    uuid references reports(id) on delete cascade,
  storage_path text not null default '',
  page_number  int not null default 1,
  created_at   timestamptz not null default now()
);

alter table report_images add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table report_images add column if not exists report_id uuid references reports(id) on delete cascade;
alter table report_images add column if not exists storage_path text default '';
alter table report_images add column if not exists page_number int default 1;
alter table report_images add column if not exists created_at timestamptz default now();

create table if not exists report_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  report_id       uuid references reports(id) on delete cascade,
  test_name       text not null default '',
  canonical_name  text,
  value_text      text not null default '',
  value_numeric   numeric,
  unit            text,
  reference_range text,
  ref_low         numeric,
  ref_high        numeric,
  range_status    text not null default 'unknown'
                    check (range_status in ('within','below','above','unknown')),
  created_at      timestamptz not null default now()
);

alter table report_results add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table report_results add column if not exists report_id uuid references reports(id) on delete cascade;
alter table report_results add column if not exists test_name text default '';
alter table report_results add column if not exists canonical_name text;
alter table report_results add column if not exists value_text text default '';
alter table report_results add column if not exists value_numeric numeric;
alter table report_results add column if not exists unit text;
alter table report_results add column if not exists reference_range text;
alter table report_results add column if not exists ref_low numeric;
alter table report_results add column if not exists ref_high numeric;
alter table report_results add column if not exists range_status text default 'unknown';
alter table report_results add column if not exists created_at timestamptz default now();

create index if not exists idx_report_results_user_canonical on report_results (user_id, canonical_name, created_at);
create index if not exists idx_report_results_report_id on report_results (report_id);
