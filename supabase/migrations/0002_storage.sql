-- =============================================================================
-- Sandbox Brain — Phase 5: private storage bucket for documents & archives
--
-- Apply via the Supabase dashboard SQL Editor (like 0001).
-- If the storage.objects policies fail with a permissions error, create the
-- same four policies through Dashboard -> Storage -> files -> Policies instead.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

create policy "team can read files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'files' and public.is_team_member());

create policy "team can upload files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'files' and public.is_team_member());

create policy "team can update files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'files' and public.is_team_member());

create policy "team can delete files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'files' and public.is_team_member());
