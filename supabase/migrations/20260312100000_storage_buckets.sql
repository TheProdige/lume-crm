-- Storage buckets for file uploads
insert into storage.buckets (id, name, public)
values
  ('company-logos', 'company-logos', true),
  ('job-photos', 'job-photos', true),
  ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Add logo_url column to company_settings
alter table public.company_settings
  add column if not exists logo_url text;

-- ============================================================
-- Storage policies: company-logos (public read, authenticated write)
-- ============================================================

create policy "Anyone can view company logos"
  on storage.objects for select
  using (bucket_id = 'company-logos');

create policy "Authenticated users can upload company logos"
  on storage.objects for insert
  with check (
    bucket_id = 'company-logos'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can update company logos"
  on storage.objects for update
  using (
    bucket_id = 'company-logos'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can delete company logos"
  on storage.objects for delete
  using (
    bucket_id = 'company-logos'
    and auth.role() = 'authenticated'
  );

-- ============================================================
-- Storage policies: job-photos (public read, authenticated write)
-- ============================================================

create policy "Anyone can view job photos"
  on storage.objects for select
  using (bucket_id = 'job-photos');

create policy "Authenticated users can upload job photos"
  on storage.objects for insert
  with check (
    bucket_id = 'job-photos'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can update job photos"
  on storage.objects for update
  using (
    bucket_id = 'job-photos'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can delete job photos"
  on storage.objects for delete
  using (
    bucket_id = 'job-photos'
    and auth.role() = 'authenticated'
  );

-- ============================================================
-- Storage policies: attachments (authenticated read/write only)
-- ============================================================

create policy "Authenticated users can view attachments"
  on storage.objects for select
  using (
    bucket_id = 'attachments'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can upload attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can update attachments"
  on storage.objects for update
  using (
    bucket_id = 'attachments'
    and auth.role() = 'authenticated'
  );

create policy "Authenticated users can delete attachments"
  on storage.objects for delete
  using (
    bucket_id = 'attachments'
    and auth.role() = 'authenticated'
  );
