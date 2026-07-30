-- =============================================================================
-- Sandbox Brain — Roadmap Phase 0: the object contract
-- (docs/vision/ROADMAP.md, Pillar 1: "a new type is a row, not a redesign")
--
-- 1. `object_types` registry — the single list of entity types the system
--    knows about. links/taggables now FK to it instead of carrying CHECK
--    constraints, so registering a new type is an INSERT, not ALTERs on two
--    shared tables (retires the 0004–0007 constraint-widening pattern).
-- 2. `objects` view — one addressable surface over every titled content
--    table: (object_type, object_id, title, created_by, created_at).
--    Search-all, the graph, and the timeline consume this; a new type joins
--    by adding one UNION arm.
--
-- Apply via the Supabase dashboard SQL Editor, or `npm run db:push`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Object type registry
-- -----------------------------------------------------------------------------

create table if not exists public.object_types (
  name text primary key check (name = lower(name)),
  label text not null,               -- human singular, e.g. 'Note'
  url_pattern text,                  -- app route; '{id}' is replaced, null = no page
  table_name text,                   -- backing table, null for virtual types
  created_at timestamptz not null default now()
);

alter table public.object_types enable row level security;

-- Registry rows are managed by migrations (service role bypasses RLS);
-- the team only ever reads them. Deliberately no insert/update/delete policy.
create policy "team can read object_types"
  on public.object_types for select
  to authenticated
  using (public.is_team_member());

-- Every type referenced by the (pre-registry) links/taggables constraints.
insert into public.object_types (name, label, url_pattern, table_name) values
    ('project',         'Project',          '/projects',       'projects')
  , ('note',            'Note',             '/notes/{id}',     'notes')
  , ('prompt',          'Prompt',           '/prompts',        'prompts')
  , ('knowledge_item',  'Knowledge item',   '/brain',          'knowledge_items')
  , ('profile',         'Person',           null,              'profiles')
  , ('time_entry',      'Time entry',       '/time',           'time_entries')
  , ('agent',           'Agent',            '/agents',         'agents')
  , ('academy_module',  'Academy module',   '/academy/{id}',   'academy_modules')
  , ('academy_outcome', 'Learning outcome', '/academy',        'academy_outcomes')
  , ('idea',            'Idea',             '/ideas/{id}',     'ideas')
  , ('task',            'Task',             '/tasks',          'tasks')
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- links/taggables: CHECK constraints -> FKs into the registry
-- -----------------------------------------------------------------------------

alter table public.links drop constraint if exists links_source_type_check;
alter table public.links drop constraint if exists links_target_type_check;
alter table public.taggables drop constraint if exists taggables_entity_type_check;

alter table public.links
  add constraint links_source_type_fkey
  foreign key (source_type) references public.object_types (name);

alter table public.links
  add constraint links_target_type_fkey
  foreign key (target_type) references public.object_types (name);

alter table public.taggables
  add constraint taggables_entity_type_fkey
  foreign key (entity_type) references public.object_types (name);

-- -----------------------------------------------------------------------------
-- The objects view: one addressable surface over all titled content.
-- security_invoker so the querying user's RLS applies to every arm.
-- (time_entry is registered above but has no title — activity belongs to
-- the events timeline, not the objects surface.)
-- -----------------------------------------------------------------------------

create or replace view public.objects
  with (security_invoker = on)
as
      select 'project'::text  as object_type, id as object_id, name  as title, created_by,        created_at from public.projects
union all
      select 'note',                          id,              title,          author_id,         created_at from public.notes
union all
      select 'prompt',                        id,              title,          user_id,           created_at from public.prompts
union all
      select 'knowledge_item',                id,              title,          created_by,        created_at from public.knowledge_items
union all
      select 'profile',                       id,              coalesce(full_name, email), id,    created_at from public.profiles
union all
      select 'agent',                         id,              name,           created_by,        created_at from public.agents
union all
      select 'academy_module',                id,              title,          created_by,        created_at from public.academy_modules
union all
      select 'academy_outcome',               id,              name,           null::uuid,        created_at from public.academy_outcomes
union all
      select 'idea',                          id,              title,          created_by,        created_at from public.ideas
union all
      select 'task',                          id,              title,          created_by,        created_at from public.tasks;
