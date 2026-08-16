-- 0013_rls_policies.sql

-- Enable RLS on all tables
alter table if exists profiles enable row level security;
alter table if exists visits enable row level security;
alter table if exists visit_images enable row level security;
alter table if exists medicines enable row level security;
alter table if exists doses enable row level security;
alter table if exists test_orders enable row level security;
alter table if exists reports enable row level security;
alter table if exists report_images enable row level security;
alter table if exists report_results enable row level security;
alter table if exists side_effects enable row level security;
alter table if exists extraction_audit enable row level security;
alter table if exists reminder_settings enable row level security;
alter table if exists shares enable row level security;

-- 1. profiles
drop policy if exists "own rows: select" on profiles;
drop policy if exists "own rows: insert" on profiles;
drop policy if exists "own rows: update" on profiles;
drop policy if exists "own rows: delete" on profiles;
drop policy if exists "Users own their profile" on profiles;
create policy "own rows: select" on profiles for select using (auth.uid() = user_id);
create policy "own rows: insert" on profiles for insert with check (auth.uid() = user_id);
create policy "own rows: update" on profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on profiles for delete using (auth.uid() = user_id);

-- 2. visits
drop policy if exists "own rows: select" on visits;
drop policy if exists "own rows: insert" on visits;
drop policy if exists "own rows: update" on visits;
drop policy if exists "own rows: delete" on visits;
drop policy if exists "Users own their visits" on visits;
create policy "own rows: select" on visits for select using (auth.uid() = user_id);
create policy "own rows: insert" on visits for insert with check (auth.uid() = user_id);
create policy "own rows: update" on visits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on visits for delete using (auth.uid() = user_id);

-- 3. visit_images
drop policy if exists "own rows: select" on visit_images;
drop policy if exists "own rows: insert" on visit_images;
drop policy if exists "own rows: update" on visit_images;
drop policy if exists "own rows: delete" on visit_images;
drop policy if exists "Users own their visit images" on visit_images;
create policy "own rows: select" on visit_images for select using (auth.uid() = user_id);
create policy "own rows: insert" on visit_images for insert with check (auth.uid() = user_id);
create policy "own rows: update" on visit_images for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on visit_images for delete using (auth.uid() = user_id);

-- 4. medicines
drop policy if exists "own rows: select" on medicines;
drop policy if exists "own rows: insert" on medicines;
drop policy if exists "own rows: update" on medicines;
drop policy if exists "own rows: delete" on medicines;
drop policy if exists "Users own their medicines" on medicines;
create policy "own rows: select" on medicines for select using (auth.uid() = user_id);
create policy "own rows: insert" on medicines for insert with check (auth.uid() = user_id);
create policy "own rows: update" on medicines for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on medicines for delete using (auth.uid() = user_id);

-- 5. doses
drop policy if exists "own rows: select" on doses;
drop policy if exists "own rows: insert" on doses;
drop policy if exists "own rows: update" on doses;
drop policy if exists "own rows: delete" on doses;
drop policy if exists "Users own their doses" on doses;
create policy "own rows: select" on doses for select using (auth.uid() = user_id);
create policy "own rows: insert" on doses for insert with check (auth.uid() = user_id);
create policy "own rows: update" on doses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on doses for delete using (auth.uid() = user_id);

-- 6. test_orders
drop policy if exists "own rows: select" on test_orders;
drop policy if exists "own rows: insert" on test_orders;
drop policy if exists "own rows: update" on test_orders;
drop policy if exists "own rows: delete" on test_orders;
drop policy if exists "Users own their test orders" on test_orders;
create policy "own rows: select" on test_orders for select using (auth.uid() = user_id);
create policy "own rows: insert" on test_orders for insert with check (auth.uid() = user_id);
create policy "own rows: update" on test_orders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on test_orders for delete using (auth.uid() = user_id);

-- 7. reports
drop policy if exists "own rows: select" on reports;
drop policy if exists "own rows: insert" on reports;
drop policy if exists "own rows: update" on reports;
drop policy if exists "own rows: delete" on reports;
drop policy if exists "Users own their reports" on reports;
create policy "own rows: select" on reports for select using (auth.uid() = user_id);
create policy "own rows: insert" on reports for insert with check (auth.uid() = user_id);
create policy "own rows: update" on reports for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on reports for delete using (auth.uid() = user_id);

-- 8. report_images
drop policy if exists "own rows: select" on report_images;
drop policy if exists "own rows: insert" on report_images;
drop policy if exists "own rows: update" on report_images;
drop policy if exists "own rows: delete" on report_images;
drop policy if exists "Users own their report images" on report_images;
create policy "own rows: select" on report_images for select using (auth.uid() = user_id);
create policy "own rows: insert" on report_images for insert with check (auth.uid() = user_id);
create policy "own rows: update" on report_images for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on report_images for delete using (auth.uid() = user_id);

-- 9. report_results
drop policy if exists "own rows: select" on report_results;
drop policy if exists "own rows: insert" on report_results;
drop policy if exists "own rows: update" on report_results;
drop policy if exists "own rows: delete" on report_results;
drop policy if exists "Users own their report results" on report_results;
create policy "own rows: select" on report_results for select using (auth.uid() = user_id);
create policy "own rows: insert" on report_results for insert with check (auth.uid() = user_id);
create policy "own rows: update" on report_results for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on report_results for delete using (auth.uid() = user_id);

-- 10. side_effects
drop policy if exists "own rows: select" on side_effects;
drop policy if exists "own rows: insert" on side_effects;
drop policy if exists "own rows: update" on side_effects;
drop policy if exists "own rows: delete" on side_effects;
drop policy if exists "Users own their side effects" on side_effects;
create policy "own rows: select" on side_effects for select using (auth.uid() = user_id);
create policy "own rows: insert" on side_effects for insert with check (auth.uid() = user_id);
create policy "own rows: update" on side_effects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on side_effects for delete using (auth.uid() = user_id);

-- 11. extraction_audit
drop policy if exists "own rows: select" on extraction_audit;
drop policy if exists "own rows: insert" on extraction_audit;
drop policy if exists "own rows: update" on extraction_audit;
drop policy if exists "own rows: delete" on extraction_audit;
drop policy if exists "Users own their extraction audit" on extraction_audit;
create policy "own rows: select" on extraction_audit for select using (auth.uid() = user_id);
create policy "own rows: insert" on extraction_audit for insert with check (auth.uid() = user_id);
create policy "own rows: update" on extraction_audit for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on extraction_audit for delete using (auth.uid() = user_id);

-- 12. reminder_settings
drop policy if exists "own rows: select" on reminder_settings;
drop policy if exists "own rows: insert" on reminder_settings;
drop policy if exists "own rows: update" on reminder_settings;
drop policy if exists "own rows: delete" on reminder_settings;
drop policy if exists "Users own their reminder settings" on reminder_settings;
create policy "own rows: select" on reminder_settings for select using (auth.uid() = user_id);
create policy "own rows: insert" on reminder_settings for insert with check (auth.uid() = user_id);
create policy "own rows: update" on reminder_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on reminder_settings for delete using (auth.uid() = user_id);

-- 13. shares
drop policy if exists "own rows: select" on shares;
drop policy if exists "own rows: insert" on shares;
drop policy if exists "own rows: update" on shares;
drop policy if exists "own rows: delete" on shares;
drop policy if exists "public: view active share" on shares;
drop policy if exists "Users manage their shares" on shares;
drop policy if exists "Public can view valid unrevoked shares" on shares;
create policy "own rows: select" on shares for select using (auth.uid() = user_id);
create policy "own rows: insert" on shares for insert with check (auth.uid() = user_id);
create policy "own rows: update" on shares for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on shares for delete using (auth.uid() = user_id);
create policy "public: view active share" on shares for select using (
  revoked_at is null and expires_at > now()
);
