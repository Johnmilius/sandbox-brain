-- =============================================================================
-- Sandbox Brain — Tier 3 #4b: saved AI agents
--
-- Apply via the Supabase dashboard SQL Editor (like 0001-0003), or `npm run db:push`.
--
-- Agents (Claude subagents, custom GPTs, Cursor rules, …) are first-class:
-- name, system prompt, model, tools. They link to the favorite prompts they
-- use via the existing `links` table, so this migration also widens the
-- entity-type checks on `links` and `taggables` to allow 'agent'.
-- =============================================================================

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  system_prompt text,
  model text,                          -- freeform, e.g. 'claude-opus-4-8'
  tools text[] not null default '{}',  -- freeform capability/tool names
  status text not null default 'active' check (status in ('active', 'archived')),
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_document tsvector generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(system_prompt, ''))
  ) stored
);

create index if not exists agents_search_idx on public.agents using gin (search_document);
create index if not exists agents_project_idx on public.agents (project_id);

create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

alter table public.agents enable row level security;
create policy "team full access on agents"
  on public.agents for all
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- -----------------------------------------------------------------------------
-- Widen the entity-type checks so links/taggables can reference agents.
-- (Column-level checks are auto-named <table>_<column>_check.)
-- -----------------------------------------------------------------------------

alter table public.links drop constraint if exists links_source_type_check;
alter table public.links add constraint links_source_type_check
  check (source_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent'));

alter table public.links drop constraint if exists links_target_type_check;
alter table public.links add constraint links_target_type_check
  check (target_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'agent'));

alter table public.taggables drop constraint if exists taggables_entity_type_check;
alter table public.taggables add constraint taggables_entity_type_check
  check (entity_type in ('project', 'prompt', 'note', 'knowledge_item', 'profile', 'time_entry', 'agent'));
