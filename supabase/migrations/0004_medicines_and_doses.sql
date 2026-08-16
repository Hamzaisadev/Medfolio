-- 0004_medicines_and_doses.sql
create table if not exists medicines (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  profile_id      uuid references profiles(id) on delete cascade,
  visit_id        uuid references visits(id) on delete cascade,
  medicine_name   text not null default '',
  strength        text,
  form            text,
  dose_amount     text,
  frequency_raw   text,
  frequency_code  text check (frequency_code in
                    ('OD','BD','TDS','QID','QHS','PRN','SOS','STAT','WEEKLY','CUSTOM')),
  duration_raw    text,
  duration_days   int check (duration_days > 0),
  start_date      date not null default current_date,
  end_date        date,
  instructions    text,
  with_food       boolean,
  is_ongoing      boolean not null default false,
  is_otc          boolean not null default false,
  unit_cost       numeric(12,2),
  currency        char(3) not null default 'PKR',
  discontinued_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table medicines add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table medicines add column if not exists profile_id uuid references profiles(id) on delete cascade;
alter table medicines add column if not exists visit_id uuid references visits(id) on delete cascade;
alter table medicines add column if not exists medicine_name text default '';
alter table medicines add column if not exists strength text;
alter table medicines add column if not exists form text;
alter table medicines add column if not exists dose_amount text;
alter table medicines add column if not exists frequency_raw text;
alter table medicines add column if not exists frequency_code text;
alter table medicines add column if not exists duration_raw text;
alter table medicines add column if not exists duration_days int;
alter table medicines add column if not exists start_date date default current_date;
alter table medicines add column if not exists end_date date;
alter table medicines add column if not exists instructions text;
alter table medicines add column if not exists with_food boolean;
alter table medicines add column if not exists is_ongoing boolean default false;
alter table medicines add column if not exists is_otc boolean default false;
alter table medicines add column if not exists unit_cost numeric(12,2);
alter table medicines add column if not exists currency char(3) default 'PKR';
alter table medicines add column if not exists discontinued_at timestamptz;
alter table medicines add column if not exists created_at timestamptz default now();
alter table medicines add column if not exists updated_at timestamptz default now();

create index if not exists idx_medicines_user_profile_date on medicines (user_id, profile_id, start_date desc);
create index if not exists idx_medicines_visit_id on medicines (visit_id);

create table if not exists doses (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  profile_id        uuid references profiles(id) on delete cascade,
  medicine_id       uuid references medicines(id) on delete cascade,
  scheduled_date    date not null default current_date,
  scheduled_minutes int not null default 480 check (scheduled_minutes between 0 and 1439),
  status            text not null default 'pending'
                      check (status in ('pending','taken','skipped','missed')),
  taken_at          timestamptz,
  skipped_reason    text,
  snoozed_until     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table doses add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table doses add column if not exists profile_id uuid references profiles(id) on delete cascade;
alter table doses add column if not exists medicine_id uuid references medicines(id) on delete cascade;
alter table doses add column if not exists scheduled_date date default current_date;
alter table doses add column if not exists scheduled_minutes int default 480;
alter table doses add column if not exists status text default 'pending';
alter table doses add column if not exists taken_at timestamptz;
alter table doses add column if not exists skipped_reason text;
alter table doses add column if not exists snoozed_until timestamptz;
alter table doses add column if not exists created_at timestamptz default now();
alter table doses add column if not exists updated_at timestamptz default now();

create index if not exists idx_doses_user_profile_scheduled on doses (user_id, profile_id, scheduled_date);
create index if not exists idx_doses_user_status_scheduled on doses (user_id, status, scheduled_date);
