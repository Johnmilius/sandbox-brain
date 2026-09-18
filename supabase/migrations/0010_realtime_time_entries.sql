-- =============================================================================
-- Cross-device timer sync
--
-- Postgres Changes only fire for tables added to the supabase_realtime
-- publication — RLS on time_entries ("team full access") already governs who
-- may receive them, this just turns the feed on. Guarded so re-running the
-- migration (or applying it to a project where it's already enabled) doesn't
-- error on a duplicate ADD TABLE.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'time_entries'
  ) then
    alter publication supabase_realtime add table public.time_entries;
  end if;
end $$;
