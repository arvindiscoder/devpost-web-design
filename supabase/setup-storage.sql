-- =============================================================================
-- ClientSync — storage-only bootstrap
--
-- Use this file if you already applied `0001_init.sql` and only need to create
-- or repair the storage bucket. It is idempotent and safe to re-run.
-- =============================================================================

-- Bucket: public read, authenticated write.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'deliverables_bucket',
  'deliverables_bucket',
  true,
  52428800,
  array[
    'application/pdf','image/png','image/jpeg','image/gif','image/webp','image/svg+xml',
    'application/zip','application/x-zip-compressed','application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4','video/quicktime','audio/mpeg','audio/wav','text/plain','text/markdown',
    'application/octet-stream'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Path -> workspace resolver used by the write policies.
create or replace function public.storage_object_workspace(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
exception
  when others then return null;
$$;

drop policy if exists "public read deliverables" on storage.objects;
create policy "public read deliverables"
  on storage.objects for select to public
  using (bucket_id = 'deliverables_bucket');

drop policy if exists "owners upload deliverables" on storage.objects;
create policy "owners upload deliverables"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deliverables_bucket'
    and public.is_workspace_owner(public.storage_object_workspace(name))
  );

drop policy if exists "owners update deliverables" on storage.objects;
create policy "owners update deliverables"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'deliverables_bucket'
    and public.is_workspace_owner(public.storage_object_workspace(name))
  )
  with check (
    bucket_id = 'deliverables_bucket'
    and public.is_workspace_owner(public.storage_object_workspace(name))
  );

drop policy if exists "owners delete deliverables" on storage.objects;
create policy "owners delete deliverables"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'deliverables_bucket'
    and public.is_workspace_owner(public.storage_object_workspace(name))
  );

-- Optional: require a signed-in user to *upload* even though reads stay public.
-- (already enforced by the policies above)
