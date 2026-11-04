-- ---------------------------------------------------------------------
-- Institution branding assets
-- Public bucket so logos can be shown on the login and dashboard shells.
-- Uploads are restricted to the institution's own folder; the server action
-- also re-checks the admin's institution before writing.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'institution-assets',
  'institution-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "institution_assets_public_read" on storage.objects;
create policy "institution_assets_public_read"
  on storage.objects
  for select
  using (bucket_id = 'institution-assets');

drop policy if exists "institution_assets_admin_insert" on storage.objects;
create policy "institution_assets_admin_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'institution-assets'
    and (public.is_super_admin() or public.current_app_role() = 'institution_admin')
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "institution_assets_admin_update" on storage.objects;
create policy "institution_assets_admin_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'institution-assets'
    and (public.is_super_admin() or public.current_app_role() = 'institution_admin')
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  )
  with check (
    bucket_id = 'institution-assets'
    and (public.is_super_admin() or public.current_app_role() = 'institution_admin')
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "institution_assets_admin_delete" on storage.objects;
create policy "institution_assets_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'institution-assets'
    and (public.is_super_admin() or public.current_app_role() = 'institution_admin')
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );
