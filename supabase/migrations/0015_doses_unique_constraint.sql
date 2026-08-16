-- 0015_doses_unique_constraint.sql
-- Add unique constraint on doses for deterministic upserts and duplicate prevention

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'doses_medicine_slot_unique'
  ) then
    alter table doses
      add constraint doses_medicine_slot_unique unique (medicine_id, scheduled_date, scheduled_minutes);
  end if;
end $$;
