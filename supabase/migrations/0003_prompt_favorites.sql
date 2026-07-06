-- =============================================================================
-- Sandbox Brain — Tier 3 #4: team-canonical prompt favorites
--
-- Apply via the Supabase dashboard SQL Editor (like 0001/0002), or `npm run db:push`.
--
-- A favorite is a TEAM-level "use this one" flag (distinct from the 1-5 rating,
-- which measures output quality). It curates the canonical prompts the team
-- reuses so AI instructions stay consistent across developers.
-- =============================================================================

alter table public.prompts
  add column if not exists is_favorite boolean not null default false;

-- Partial index: we only ever filter/sort on the favorites.
create index if not exists prompts_favorite_idx
  on public.prompts (is_favorite)
  where is_favorite;
