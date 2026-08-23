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
begin
  insert into public.profiles (id, user_id, full_name, sex, date_of_birth, is_default)
  values (
    new.id,
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'sex', 'undisclosed'),
    (new.raw_user_meta_data ->> 'date_of_birth')::date,
    true
  )
  on conflict (id) do nothing;  -- idempotent: don't fail if profile already exists

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
