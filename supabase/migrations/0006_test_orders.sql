-- 0006_test_orders.sql
create table if not exists test_orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  profile_id       uuid references profiles(id) on delete cascade,
  visit_id         uuid references visits(id) on delete set null,
  test_name        text not null default '',
  canonical_name   text,
  status           text not null default 'pending'
                     check (status in ('pending','scheduled','completed','cancelled')),
  ordered_date     date not null default current_date,
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

alter table test_orders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table test_orders add column if not exists profile_id uuid references profiles(id) on delete cascade;
alter table test_orders add column if not exists visit_id uuid references visits(id) on delete set null;
alter table test_orders add column if not exists test_name text default '';
alter table test_orders add column if not exists canonical_name text;
alter table test_orders add column if not exists status text default 'pending';
alter table test_orders add column if not exists ordered_date date default current_date;
alter table test_orders add column if not exists scheduled_date date;
alter table test_orders add column if not exists completed_date date;
alter table test_orders add column if not exists report_id uuid references reports(id) on delete set null;
alter table test_orders add column if not exists link_method text;
alter table test_orders add column if not exists estimated_cost numeric(12,2);
alter table test_orders add column if not exists currency char(3) default 'PKR';
alter table test_orders add column if not exists notes text;
alter table test_orders add column if not exists created_at timestamptz default now();
alter table test_orders add column if not exists updated_at timestamptz default now();

create index if not exists idx_test_orders_user_profile_status on test_orders (user_id, profile_id, status);
