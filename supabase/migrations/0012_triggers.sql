-- 0012_triggers.sql
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists set_visits_updated_at on visits;
create trigger set_visits_updated_at before update on visits
  for each row execute function set_updated_at();

drop trigger if exists set_medicines_updated_at on medicines;
create trigger set_medicines_updated_at before update on medicines
  for each row execute function set_updated_at();

drop trigger if exists set_doses_updated_at on doses;
create trigger set_doses_updated_at before update on doses
  for each row execute function set_updated_at();

drop trigger if exists set_test_orders_updated_at on test_orders;
create trigger set_test_orders_updated_at before update on test_orders
  for each row execute function set_updated_at();

drop trigger if exists set_reports_updated_at on reports;
create trigger set_reports_updated_at before update on reports
  for each row execute function set_updated_at();

drop trigger if exists set_reminder_settings_updated_at on reminder_settings;
create trigger set_reminder_settings_updated_at before update on reminder_settings
  for each row execute function set_updated_at();

-- Automatically create a default profile on user signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, relationship, is_default)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Patient'),
    'self',
    true
  )
  on conflict do nothing;

  insert into public.reminder_settings (user_id, profile_id)
  select new.id, id from public.profiles where user_id = new.id and is_default = true limit 1
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
