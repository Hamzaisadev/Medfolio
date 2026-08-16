-- 0011_storage_bucket_and_policies.sql
insert into storage.buckets (id, name, public)
values ('medical-images', 'medical-images', false)
on conflict (id) do nothing;

drop policy if exists "User owns medical images folder" on storage.objects;
create policy "User owns medical images folder"
on storage.objects for all
using (
  bucket_id = 'medical-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'medical-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
