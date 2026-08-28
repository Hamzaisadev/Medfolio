-- 0017_auto_profile_trigger.sql
--
-- Automatically create a default profile row when a new user signs up via
-- Supabase Auth. This runs as SECURITY DEFINER so it bypasses RLS policies
-- (the profile INSERT happens before the user's JWT is issued).
--
-- The profile uses the user's id as both `id` and `user_id`, and populates
-- `full_name` from the signup metadata or the email local-part as fallback.

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

-- Drop any existing trigger so migration is re-runnable
drop trigger if exists on_auth_user_created on auth.users;

-- Fire the function after every new auth.users row
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
